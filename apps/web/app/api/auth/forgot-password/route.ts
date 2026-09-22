import { NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseAdminClient } from '@healthiva/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    // 1. Validate Input
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { error: 'Please enter your registered email address.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const client = getSupabaseClient();
    let emailExists = false;

    // 2. Pre-Check: Verify if email exists in database
    try {
      // First attempt: Call the SECURITY DEFINER RPC
      const { data: rpcResult, error: rpcError } = await client.rpc('check_user_email_exists', {
        p_email: cleanEmail,
      });

      if (!rpcError && typeof rpcResult === 'boolean') {
        emailExists = rpcResult;
      } else {
        // Fallback: Query profiles directly via admin client
        const adminClient = getSupabaseAdminClient();
        const { data: profile } = await adminClient
          .from('profiles')
          .select('id')
          .ilike('email', cleanEmail)
          .maybeSingle();

        emailExists = !!profile;
      }
    } catch (checkErr) {
      console.warn('[Forgot Password] Warning verifying email:', checkErr);
      // Fallback query
      try {
        const adminClient = getSupabaseAdminClient();
        const { data: profile } = await adminClient
          .from('profiles')
          .select('id')
          .ilike('email', cleanEmail)
          .maybeSingle();
        emailExists = !!profile;
      } catch {
        emailExists = false;
      }
    }

    // 3. If email does not exist, return explicit error
    if (!emailExists) {
      return NextResponse.json(
        { error: 'No account found with this email address. Please check your email or register for a free trial.' },
        { status: 404 }
      );
    }

    // 4. Email exists! Send the secure Supabase recovery link
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const redirectUrl = `${origin}/reset-password`;

    const { error: resetError } = await client.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectUrl,
    });

    if (resetError) {
      return NextResponse.json(
        { error: resetError.message || 'Failed to send password reset email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset link sent to your email.',
    });
  } catch (error: any) {
    console.error('[Healthiva Forgot Password Error]:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your request. Please try again.' },
      { status: 500 }
    );
  }
}
