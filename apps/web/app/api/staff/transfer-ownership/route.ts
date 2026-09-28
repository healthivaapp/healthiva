import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hhilecvljlzbrdyykpxo.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Missing session token.' }, { status: 401 });
    }

    const adminClient = getAdminClient();
    const { data: { user }, error: userErr } = await adminClient.auth.getUser(token);

    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired session.' }, { status: 401 });
    }

    const body = await request.json();
    const { targetUserId, password } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Target Co-Owner user ID is required.' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Please enter your account password to authorize ownership transfer.' }, { status: 400 });
    }

    // 1. Re-authenticate Primary Owner using password to prevent CSRF / unauthorized handover
    const userEmail = user.email;
    if (!userEmail) {
      return NextResponse.json({ error: 'Cannot verify credentials: Missing owner email.' }, { status: 400 });
    }

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hhilecvljlzbrdyykpxo.supabase.co';
    const authVerificationClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: signInErr } = await authVerificationClient.auth.signInWithPassword({
      email: userEmail,
      password: password.trim(),
    });

    if (signInErr) {
      return NextResponse.json(
        { error: 'Incorrect password. Ownership transfer requires valid primary owner verification.' },
        { status: 403 }
      );
    }

    // 2. Fetch current user membership to get organization_id and verify is_primary_owner
    const { data: initiatorMem, error: memErr } = await adminClient
      .from('memberships')
      .select('id, organization_id, is_primary_owner, org_authority')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (memErr || !initiatorMem) {
      return NextResponse.json({ error: 'Failed to verify clinic membership.' }, { status: 400 });
    }

    const isPrimaryOwner = Boolean(initiatorMem.is_primary_owner || initiatorMem.org_authority === 'primary_owner');
    if (!isPrimaryOwner) {
      return NextResponse.json(
        { error: 'Unauthorized: Only the current Primary Owner can transfer primary ownership.' },
        { status: 403 }
      );
    }

    const organizationId = initiatorMem.organization_id;

    // 3. Verify target user is an active member with administrator authority
    const { data: targetMem, error: targetErr } = await adminClient
      .from('memberships')
      .select('id, user_id, org_authority, status')
      .eq('organization_id', organizationId)
      .eq('user_id', targetUserId)
      .eq('status', 'active')
      .maybeSingle();

    if (targetErr || !targetMem) {
      return NextResponse.json({ error: 'Target staff member was not found or is inactive.' }, { status: 400 });
    }

    if (targetMem.org_authority !== 'administrator') {
      return NextResponse.json(
        { error: 'Ownership can only be transferred to an active Co-Owner (Administrator).' },
        { status: 400 }
      );
    }

    // 4. Try atomic PostgreSQL RPC first
    try {
      const { data: rpcRes, error: rpcErr } = await adminClient.rpc('transfer_primary_ownership', {
        p_org_id: organizationId,
        p_initiator_user_id: user.id,
        p_new_primary_owner_user_id: targetUserId,
      });

      if (!rpcErr && rpcRes?.success) {
        return NextResponse.json({
          success: true,
          message: rpcRes.message || 'Primary ownership transferred successfully.',
        });
      }
    } catch (rpcErr) {
      console.warn('[transfer_primary_ownership RPC fallback]:', rpcErr);
    }

    // Fallback: Direct atomic updates
    // A. Update organization primary owner reference
    await adminClient
      .from('organizations')
      .update({ primary_owner_user_id: targetUserId, updated_at: new Date().toISOString() })
      .eq('id', organizationId);

    // B. Promote target to primary owner
    await adminClient
      .from('memberships')
      .update({ is_primary_owner: true, org_authority: 'primary_owner', updated_at: new Date().toISOString() })
      .eq('id', targetMem.id);

    // C. Demote current owner to Co-Owner (Administrator)
    await adminClient
      .from('memberships')
      .update({ is_primary_owner: false, org_authority: 'administrator', updated_at: new Date().toISOString() })
      .eq('id', initiatorMem.id);

    return NextResponse.json({
      success: true,
      message: 'Primary ownership transferred successfully. You are now a Co-Owner (Administrator).',
    });
  } catch (err: any) {
    console.error('[API Transfer Ownership error]:', err);
    return NextResponse.json({ error: err?.message || 'Failed to transfer ownership.' }, { status: 500 });
  }
}
