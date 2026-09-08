import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@healthiva/supabase';
import type { TrialRegistrationPayload } from '@healthiva/types';

export async function POST(request: Request) {
  try {
    const body: TrialRegistrationPayload = await request.json();
    const { clinicName, ownerName, mobile, email, password, specialty, customSpecialty } = body;

    // 1. Validate Required Fields
    if (!clinicName?.trim() || !ownerName?.trim() || !mobile?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: 'All fields are required. Please complete the form.' },
        { status: 400 }
      );
    }

    if (!/^\d{10}$/.test(mobile.trim())) {
      return NextResponse.json(
        { error: 'Mobile number must be exactly 10 digits.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const finalSpecialty = specialty === 'other' && customSpecialty?.trim() 
      ? customSpecialty.trim() 
      : specialty || 'General OPD';

    const client = getSupabaseClient();

    // 2. Pre-check: Verify mobile number and email are not already registered with another clinic (Anti-abuse)
    const { data: existingMobile } = await client
      .from('profiles')
      .select('id')
      .eq('mobile', mobile.trim())
      .maybeSingle();

    if (existingMobile) {
      return NextResponse.json(
        { error: 'This mobile number is already registered with an existing account. Please log in or use a different mobile number.' },
        { status: 400 }
      );
    }

    const { data: existingEmail } = await client
      .from('profiles')
      .select('id')
      .eq('email', email.trim())
      .maybeSingle();

    if (existingEmail) {
      return NextResponse.json(
        { error: 'This email address is already registered with an existing account. Please log in or use a different email address.' },
        { status: 400 }
      );
    }

    // 3. Step 1: Create Supabase Auth User
    const { data: authData, error: authError } = await client.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        data: {
          full_name: ownerName.trim(),
          name: ownerName.trim(),
          phone: mobile.trim(),
          mobile: mobile.trim(),
          clinic_name: clinicName.trim(),
          specialty: finalSpecialty,
        },
      },
    });

    if (authError || !authData?.user) {
      const msg = authError?.message || 'Failed to create user account. Please check your email and password.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Check if user already exists (Supabase returns empty identities array for existing users or error)
    if (authData.user.identities && authData.user.identities.length === 0) {
      return NextResponse.json(
        { error: 'This email address is already registered with an existing account. Please log in or use a different email address.' },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // 3. Step 2: Execute Atomic Provisioning via PostgreSQL Stored Procedure (RPC)
    const { data: rpcData, error: rpcError } = await client.rpc('register_trial_clinic', {
      p_user_id: userId,
      p_clinic_name: clinicName.trim(),
      p_owner_name: ownerName.trim(),
      p_mobile: mobile.trim(),
      p_email: email.trim(),
      p_specialty: finalSpecialty,
    });

    if (rpcError) {
      console.error('[Healthiva Stored Procedure RPC Error]:', rpcError);
      return NextResponse.json(
        { error: rpcError.message || 'Failed to provision clinic records. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: authData.user,
      session: authData.session,
      provisioning: rpcData,
      redirectUrl: '/dashboard',
    });
  } catch (error: any) {
    console.error('[Healthiva Trial Registration Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred while starting your free trial. Please try again.' },
      { status: 500 }
    );
  }
}
