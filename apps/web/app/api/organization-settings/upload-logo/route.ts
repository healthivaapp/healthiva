import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '') || '';

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: missing access token.' }, { status: 401 });
    }

    const client = getAuthenticatedClient(token);
    const { data: { user }, error: userError } = await client.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized: invalid session. Please log in again.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const organizationId = (formData.get('organizationId') as string)?.trim();

    if (!file) {
      return NextResponse.json({ error: 'No logo image file provided.' }, { status: 400 });
    }

    // Verify user belongs to this organization
    const { data: membership } = await client
      .from('memberships')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: 'You do not have permission to upload assets for this clinic organization.' },
        { status: 403 }
      );
    }

    // Convert file to Buffer for Supabase Storage upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const bucketName = 'clinic-assets';
    const filePath = `org/${organizationId}/logo.webp`;

    // Upload / Overwrite logo
    const { error: uploadError } = await client.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: 'image/webp',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('[Supabase Storage Upload Error]:', uploadError);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Get public URL (with cache-busting timestamp query for fresh display)
    const { data: { publicUrl } } = client.storage.from(bucketName).getPublicUrl(filePath);
    const stampedUrl = `${publicUrl}?v=${Date.now()}`;

    // Update brand_json in organization_settings
    const { data: existingSettings } = await client
      .from('organization_settings')
      .select('brand_json')
      .eq('organization_id', organizationId)
      .maybeSingle();

    const updatedBrand = {
      ...(existingSettings?.brand_json || {}),
      logo_url: publicUrl,
    };

    await client
      .from('organization_settings')
      .update({ brand_json: updatedBrand, updated_at: new Date().toISOString() })
      .eq('organization_id', organizationId);

    return NextResponse.json({
      success: true,
      logoUrl: stampedUrl,
      rawUrl: publicUrl,
      message: 'Clinic logo uploaded and compressed successfully.',
    });
  } catch (err: any) {
    console.error('[API Logo Upload Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to upload clinic logo.' },
      { status: 500 }
    );
  }
}
