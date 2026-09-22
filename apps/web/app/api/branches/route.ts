import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ALL_PERMISSIONS, resolveEffectivePermissions } from '@/lib/permissions';

function getFriendlyErrorMessage(error: any): string {
  if (!error) return '';
  const msg = typeof error === 'string' ? error : error.message || '';

  if (msg.includes('row-level security') || msg.includes('RLS')) {
    return 'Permission denied: You need owner privileges to perform this branch action.';
  }
  if (msg.includes('single JSON object') || msg.includes('PGRST116')) {
    return 'Branch updated successfully!';
  }
  if (msg.includes('duplicate key') || msg.includes('uq_clinic_org_code')) {
    return 'A branch with this Short Code (e.g. MAIN) already exists in your clinic.';
  }

  return 'Failed to save branch. Please check all required fields and try again.';
}

function getAuthenticatedClient(token: string): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://hhilecvljlzbrdyykpxo.supabase.co';

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
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

// Helper to resolve user, membership, role, and organization
async function resolveUserAndOrg(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '') || '';

  if (!token) {
    return { error: 'Unauthorized: missing access token.', status: 401 };
  }

  const client = getAuthenticatedClient(token);
  const { data: { user }, error: userError } = await client.auth.getUser(token);

  if (userError || !user) {
    return { error: 'Unauthorized: invalid or expired session.', status: 401 };
  }

  // Fetch user's membership
  const { data: membership, error: memError } = await client
    .from('memberships')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (memError || !membership) {
    return { error: 'No active clinic organization found for this user.', status: 403 };
  }

  // Check if staff member is suspended or deactivated
  if (membership.status === 'suspended' || membership.status === 'disabled') {
    return {
      error: 'Your staff access account has been suspended by the clinic owner. Please contact your clinic administrator.',
      isSuspended: true,
      status: 403,
    };
  }

  // Fetch user role
  const { data: memRole } = await client
    .from('membership_roles')
    .select('role_id, role:roles(id, name, description)')
    .eq('membership_id', membership.id)
    .limit(1)
    .maybeSingle();

  const roleName = ((memRole?.role as any)?.name || 'Owner').toLowerCase();
  const isOwner =
    membership.is_primary_owner === true ||
    membership.org_authority === 'primary_owner' ||
    roleName === 'owner';
  const isOwnerOrAdmin = isOwner || membership.org_authority === 'administrator';

  // Fetch organization name
  const { data: org } = await client
    .from('organizations')
    .select('id, name, slug')
    .eq('id', membership.organization_id)
    .maybeSingle();

  // Fetch real user profile from public.profiles
  const { data: profile } = await client
    .from('profiles')
    .select('id, full_name, mobile, email')
    .eq('id', user.id)
    .maybeSingle();

  // Fetch organization settings for specialty_template, brand_json (logo), and workflow_json
  const { data: orgSettings } = await client
    .from('organization_settings')
    .select('specialty_template, brand_json, workflow_json')
    .eq('organization_id', membership.organization_id)
    .maybeSingle();

  const logoUrl = (orgSettings?.brand_json as any)?.logo_url || user.user_metadata?.logo_url || null;

  const roleOverrides = (orgSettings?.workflow_json as any)?.role_overrides || null;

  // Resolve user permissions
  const userPermissions = isOwnerOrAdmin
    ? [...ALL_PERMISSIONS]
    : resolveEffectivePermissions(
        roleName,
        membership.permission_mode as any,
        membership.custom_permissions,
        roleOverrides
      );

  return {
    client,
    user,
    profile,
    membership,
    isOwner: isOwnerOrAdmin,
    isPrimaryOwner: isOwner,
    userRole: roleName,
    userPermissions,
    organizationId: membership.organization_id,
    organizationName: org?.name || 'My Clinic',
    specialty: orgSettings?.specialty_template || 'general_opd',
    logoUrl,
  };
}

// GET: Fetch all branches for user's organization
export async function GET(request: Request) {
  try {
    const authResult = await resolveUserAndOrg(request);
    if ('error' in authResult) {
      return NextResponse.json(
        {
          error: authResult.error,
          isSuspended: Boolean((authResult as any).isSuspended),
        },
        { status: authResult.status || 400 }
      );
    }

    const { client, isOwner, userRole, userPermissions, organizationId, organizationName, membership } = authResult;

    const { data: branches, error: fetchError } = await client
      .from('clinics')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: getFriendlyErrorMessage(fetchError) }, { status: 400 });
    }

    let scopedBranches = branches || [];
    // If not owner, filter by membership_clinic_scopes if defined
    if (!isOwner && membership?.id) {
      const { data: scopes } = await client
        .from('membership_clinic_scopes')
        .select('clinic_id')
        .eq('membership_id', membership.id);

      if (scopes && scopes.length > 0) {
        const allowedIds = new Set(scopes.map((s: any) => s.clinic_id));
        scopedBranches = scopedBranches.filter((b: any) => allowedIds.has(b.id));
      }
    }

    return NextResponse.json({
      success: true,
      branches: scopedBranches,
      allBranches: branches || [],
      isOwner,
      userRole,
      userPermissions,
      organizationId,
      organizationName,
      defaultClinicId: membership?.default_clinic_id || null,
      logoUrl: authResult.logoUrl,
      profile: authResult.profile,
      specialty: authResult.specialty,
    });
  } catch (err: any) {
    console.error('[API Branches GET error]:', err);
    return NextResponse.json({ error: getFriendlyErrorMessage(err) }, { status: 500 });
  }
}

// POST: Add a new branch (Owner only)
export async function POST(request: Request) {
  try {
    const authResult = await resolveUserAndOrg(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, isOwner, organizationId, membership } = authResult;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Access denied: Only clinic owners can create branches.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, code, address, phone, email, city, state, pincode, is_active } = body;

    if (!name?.trim() || !code?.trim()) {
      return NextResponse.json(
        { error: 'Branch name and branch code are required.' },
        { status: 400 }
      );
    }

    // Clean branch code (e.g. SUNRISE-ADJ)
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    // Insert into clinics
    const { data: newBranch, error: insertError } = await client
      .from('clinics')
      .insert({
        organization_id: organizationId,
        name: name.trim(),
        code: cleanCode,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        city: city?.trim() || 'Surat',
        state: state?.trim() || 'Gujarat',
        pincode: pincode?.trim() || null,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
      })
      .select()
      .maybeSingle();

    if (insertError) {
      return NextResponse.json({ error: getFriendlyErrorMessage(insertError) }, { status: 400 });
    }

    // Automatically assign owner to new branch scope if newBranch was returned
    if (newBranch?.id && membership?.id) {
      await client
        .from('membership_clinic_scopes')
        .insert({
          membership_id: membership.id,
          clinic_id: newBranch.id,
        });
    }

    return NextResponse.json({
      success: true,
      branch: newBranch,
      message: 'Branch created successfully.',
    });
  } catch (err: any) {
    console.error('[API Branches POST error]:', err);
    return NextResponse.json({ error: getFriendlyErrorMessage(err) }, { status: 500 });
  }
}

// PUT: Update branch details (Owner only)
export async function PUT(request: Request) {
  try {
    const authResult = await resolveUserAndOrg(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, isOwner, organizationId } = authResult;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Access denied: Only clinic owners can update branches.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, code, address, phone, email, city, state, pincode, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Branch ID is required.' }, { status: 400 });
    }

    const updatePayload: any = {};
    if (name) updatePayload.name = name.trim();
    if (code) updatePayload.code = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (address !== undefined) updatePayload.address = address?.trim() || null;
    if (phone !== undefined) updatePayload.phone = phone?.trim() || null;
    if (email !== undefined) updatePayload.email = email?.trim() || null;
    if (city !== undefined) updatePayload.city = city?.trim() || 'Surat';
    if (state !== undefined) updatePayload.state = state?.trim() || 'Gujarat';
    if (pincode !== undefined) updatePayload.pincode = pincode?.trim() || null;
    if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);

    const { data: updatedBranch, error: updateError } = await client
      .from('clinics')
      .update(updatePayload)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: getFriendlyErrorMessage(updateError) }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      branch: updatedBranch,
      message: 'Branch updated successfully.',
    });
  } catch (err: any) {
    console.error('[API Branches PUT error]:', err);
    return NextResponse.json({ error: getFriendlyErrorMessage(err) }, { status: 500 });
  }
}
