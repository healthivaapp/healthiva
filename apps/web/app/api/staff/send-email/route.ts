import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendStaffInvitationEmail } from '@/lib/email';

function getAuthenticatedClient(token: string): any {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://hhilecvljlzbrdyykpxo.supabase.co';

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

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: missing session token.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const client = getAuthenticatedClient(token);
    const { data: { user }, error: userError } = await client.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized: invalid session.' }, { status: 401 });
    }

    // Fetch user's active clinic organization
    const { data: membership } = await client
      .from('memberships')
      .select('id, organization_id, status, organization:organizations(name)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'No active clinic organization found.' }, { status: 403 });
    }

    const clinicName = (membership.organization as any)?.name || 'Helix care';

    const body = await request.json();
    const { email, name, role, inviteLink, branches } = body;

    if (!email || !inviteLink) {
      return NextResponse.json(
        { error: 'Email address and invitation link are required.' },
        { status: 400 }
      );
    }

    // Fetch sender profile name
    const { data: ownerProfile } = await client
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    const inviterName = ownerProfile?.full_name || 'Clinic Administrator';

    // Resolve human-readable branch names if branch IDs or strings passed
    let branchNames: string[] = [];
    if (Array.isArray(branches) && branches.length > 0) {
      const firstItem = String(branches[0]);
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(firstItem);
      if (isUuid) {
        const { data: cRows } = await client
          .from('clinics')
          .select('name')
          .in('id', branches);
        if (cRows && cRows.length > 0) {
          branchNames = cRows.map((c: any) => c.name);
        }
      } else {
        branchNames = branches.map((b: any) => typeof b === 'string' ? b : b?.name || 'Branch');
      }
    }

    // Dispatch email via Resend
    const result = await sendStaffInvitationEmail({
      to: email,
      recipientName: name || 'Staff Member',
      clinicName,
      roleName: role || 'Staff',
      inviteLink,
      inviterName,
      branches: branchNames,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to dispatch email via Resend.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Invitation email sent successfully to ${email}!`,
      deliveryId: result.id,
    });
  } catch (err: any) {
    console.error('[API Send Email Error]:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to dispatch invitation email.' },
      { status: 500 }
    );
  }
}
