import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendPasswordResetEmail } from '@/lib/email';

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
      return NextResponse.json({ error: 'Unauthorized: invalid or expired session.' }, { status: 401 });
    }

    // Verify caller is active owner
    const { data: membership } = await client
      .from('memberships')
      .select('id, organization_id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'No active clinic organization found.' }, { status: 403 });
    }

    const { data: memRole } = await client
      .from('membership_roles')
      .select('role:roles(name)')
      .eq('membership_id', membership.id)
      .maybeSingle();

    const roleRow = memRole?.role as { name?: string } | null;
    const roleName = (roleRow?.name || 'Owner').toLowerCase();
    if (roleName !== 'owner') {
      return NextResponse.json({ error: 'Only clinic owners can send password resets.' }, { status: 403 });
    }

    const body = await request.json();
    const { email, name } = body;

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Staff email address is required.' }, { status: 400 });
    }

    // Fetch clinic organization name
    const { data: org } = await client
      .from('organizations')
      .select('name')
      .eq('id', membership.organization_id)
      .maybeSingle();

    const clinicName = org?.name || 'Your Clinic';
    const origin = request.headers.get('origin') || 'https://healthiva.in';
    const cleanEmail = email.trim().toLowerCase();

    // Trigger Supabase Auth password recovery (if configured)
    try {
      await client.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${origin}/auth/update-password`,
      });
    } catch (sbErr) {
      console.warn('[Supabase resetPasswordForEmail fallback]:', sbErr);
    }

    // Dispatch branded Healthiva HTML reset email via Resend
    const resetLink = `${origin}/auth/reset-password?email=${encodeURIComponent(cleanEmail)}`;
    const emailRes = await sendPasswordResetEmail({
      to: cleanEmail,
      recipientName: name?.trim() || 'Staff Member',
      clinicName,
      resetLink,
    });

    if (!emailRes.success) {
      return NextResponse.json({ error: emailRes.error || 'Failed to dispatch email.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Password reset instructions delivered to ${cleanEmail} via Resend!`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to process password reset.';
    console.error('[API Staff Reset Password error]:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
