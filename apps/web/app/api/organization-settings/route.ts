import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper to create a Supabase client authenticated with the caller's Bearer JWT
function getAuthenticatedClient(token: string): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://hhilecvljlzbrdyykpxo.supabase.co';

  // Prefer Service Role key if configured, otherwise use Anon key with forwarded Bearer JWT
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

// Helper to authenticate request and resolve active organization ID
async function resolveAuthAndOrg(
  request: Request,
  bodyOrgId?: string
): Promise<{
  client: SupabaseClient;
  userId: string;
  organizationId: string;
  user: any;
  error?: string;
  status?: number;
}> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '') || '';

  if (!token) {
    return {
      client: null as any,
      userId: '',
      organizationId: '',
      user: null,
      error: 'Unauthorized: missing access token.',
      status: 401,
    };
  }

  const client = getAuthenticatedClient(token);
  const { data: { user }, error: userError } = await client.auth.getUser(token);

  if (userError || !user) {
    return {
      client,
      userId: '',
      organizationId: '',
      user: null,
      error: 'Unauthorized: invalid or expired session. Please log in again.',
      status: 401,
    };
  }

  // 1. Query user's active organization membership using the authenticated client
  let query = client
    .from('memberships')
    .select('organization_id, status')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (bodyOrgId) {
    query = query.eq('organization_id', bodyOrgId);
  }

  const { data: membership, error: memError } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membership?.organization_id) {
    return { client, userId: user.id, organizationId: membership.organization_id, user };
  }

  return {
    client,
    userId: user.id,
    organizationId: '',
    user,
    error: 'No active clinic organization found for this user account. Please register your clinic on the Free Trial page.',
    status: 403,
  };
}

// GET: Fetch organization settings for the current user's organization
export async function GET(request: Request) {
  try {
    const authResult = await resolveAuthAndOrg(request);
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, organizationId, user } = authResult;

    // 1. Fetch organization details
    const { data: org } = await client
      .from('organizations')
      .select('id, name, slug, status')
      .eq('id', organizationId)
      .maybeSingle();

    // 2. Fetch organization settings
    const { data: settings } = await client
      .from('organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    // 3. Fallback to defaults if record not yet created
    const workflow = settings?.workflow_json || {};
    const brand = settings?.brand_json || {};
    const modules = settings?.modules_json || {};

    const formattedData = {
      organizationId,
      organizationName: org?.name || user?.user_metadata?.clinic_name || 'Clinic',
      organizationSlug: org?.slug || '',
      specialtyTemplate: settings?.specialty_template || user?.user_metadata?.specialty || 'General OPD',
      workflow: {
        // Expose amounts in Rupees for frontend convenience, derived from stored paise
        consultationFeeRupees: typeof workflow.consultation_fee === 'number' ? workflow.consultation_fee / 100 : 300,
        followupFeeRupees: typeof workflow.followup_fee === 'number' ? workflow.followup_fee / 100 : 150,
        emergencyFeeRupees: typeof workflow.emergency_fee === 'number' ? workflow.emergency_fee / 100 : 500,
        tokenStyle: workflow.token_style || 'T-###',
        resetDaily: workflow.reset_daily !== false,
      },
      brand: {
        logoUrl: brand.logo_url || null,
        printHeader: brand.print_header || org?.name || user?.user_metadata?.clinic_name || '',
      },
      modules: {
        reception: modules.reception !== false,
        billing: modules.billing !== false,
        whatsappReminders: modules.whatsapp_reminders !== false,
        pharmacy: Boolean(modules.pharmacy),
      },
      rawSettings: settings,
    };

    return NextResponse.json({ success: true, settings: formattedData });
  } catch (err: any) {
    console.error('[API Organization Settings GET Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch organization settings.' },
      { status: 500 }
    );
  }
}

// POST/PUT: Update organization settings
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const authResult = await resolveAuthAndOrg(request, body.organizationId);

    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, organizationId } = authResult;

    const {
      specialtyTemplate,
      workflow = {},
      brand = {},
      modules = {},
    } = body;

    // Ensure all fees are converted to integer paise to eliminate decimal errors
    const consultation_fee = Math.round(Number(workflow.consultationFeeRupees ?? 300) * 100);
    const followup_fee = Math.round(Number(workflow.followupFeeRupees ?? 150) * 100);
    const emergency_fee = Math.round(Number(workflow.emergencyFeeRupees ?? 500) * 100);

    const token_style = String(workflow.tokenStyle || 'T-###').trim();
    const reset_daily = workflow.resetDaily !== false;

    const print_header = String(brand.printHeader || '').trim();
    const logo_url = brand.logoUrl ? String(brand.logoUrl).trim() : null;

    const reception = modules.reception !== false;
    const billing = modules.billing !== false;
    const whatsapp_reminders = modules.whatsappReminders !== false;
    const pharmacy = Boolean(modules.pharmacy);

    const specialty_template = String(specialtyTemplate || 'General OPD').trim();

    // Update existing settings row (or insert if not yet created)
    const { data: existing } = await client
      .from('organization_settings')
      .select('id, workflow_json')
      .eq('organization_id', organizationId)
      .maybeSingle();

    const existingWorkflow = (existing?.workflow_json as any) || {};
    const existingOverrides = existingWorkflow.role_overrides;

    const payload = {
      organization_id: organizationId,
      specialty_template,
      workflow_json: {
        ...existingWorkflow,
        consultation_fee,
        followup_fee,
        emergency_fee,
        token_style,
        reset_daily,
        ...(existingOverrides ? { role_overrides: existingOverrides } : {}),
      },
      brand_json: {
        print_header,
        logo_url,
      },
      modules_json: {
        reception,
        billing,
        whatsapp_reminders,
        pharmacy,
      },
      updated_at: new Date().toISOString(),
    };

    let updatedSettings: any = null;
    let saveError: any = null;

    if (existing) {
      const { data, error } = await client
        .from('organization_settings')
        .update(payload)
        .eq('organization_id', organizationId)
        .select()
        .single();
      updatedSettings = data;
      saveError = error;
    } else {
      const { data, error } = await client
        .from('organization_settings')
        .insert(payload)
        .select()
        .single();
      updatedSettings = data;
      saveError = error;
    }

    if (saveError) {
      console.error('[API Organization Settings Save Error]:', saveError);
      return NextResponse.json({ error: saveError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Organization settings updated successfully.',
      settings: updatedSettings,
    });
  } catch (err: any) {
    console.error('[API Organization Settings POST Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to update organization settings.' },
      { status: 500 }
    );
  }
}
