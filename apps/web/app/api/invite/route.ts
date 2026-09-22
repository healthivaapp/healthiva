import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getClient(): SupabaseClient {
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
  });
}

// GET: Validate invitation token and fetch invitation preview
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token')?.trim();

    if (!token) {
      return NextResponse.json({ error: 'Missing invitation token.' }, { status: 400 });
    }

    const client = getClient();

    // 1. Try atomic SECURITY DEFINER RPC first (bypasses RLS to fetch real org name & logo securely)
    try {
      const { data: rpcRes, error: rpcErr } = await client.rpc('get_staff_invitation_details', {
        p_token: token,
      });

      if (!rpcErr && rpcRes?.success && rpcRes.invitation) {
        return NextResponse.json({
          success: true,
          invitation: rpcRes.invitation,
        });
      }

      if (!rpcErr && rpcRes?.success === false) {
        return NextResponse.json(
          { error: rpcRes.error || 'This invitation link is invalid, expired, or has already been accepted.' },
          { status: 404 }
        );
      }
    } catch (rpcCatchErr) {
      console.warn('[Note: RPC get_staff_invitation_details fallback]:', rpcCatchErr);
    }

    // 2. Fallback: Direct table queries
    const { data: invitation, error: invError } = await client
      .from('staff_invitations')
      .select('*, organization:organizations(name), role:roles(name, description)')
      .eq('invite_token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (invError || !invitation) {
      return NextResponse.json(
        { error: 'This invitation link is invalid, expired, or has already been accepted.' },
        { status: 404 }
      );
    }

    // Fetch assigned branch names
    let assignedBranchNames: string[] = [];
    if (Array.isArray(invitation.branch_ids) && invitation.branch_ids.length > 0) {
      const { data: branchRows } = await client
        .from('clinics')
        .select('name')
        .in('id', invitation.branch_ids);

      if (branchRows) {
        assignedBranchNames = branchRows.map((b: any) => b.name);
      }
    }

    let logoUrl: string | null = null;
    let resolvedOrgName = (invitation.organization as any)?.name || null;

    if (invitation.organization_id) {
      if (!resolvedOrgName) {
        const { data: orgRow } = await client
          .from('organizations')
          .select('name')
          .eq('id', invitation.organization_id)
          .maybeSingle();
        if (orgRow?.name) {
          resolvedOrgName = orgRow.name;
        }
      }

      const { data: orgSettings } = await client
        .from('organization_settings')
        .select('brand_json')
        .eq('organization_id', invitation.organization_id)
        .maybeSingle();

      if (orgSettings?.brand_json && typeof orgSettings.brand_json === 'object') {
        logoUrl = (orgSettings.brand_json as any).logo_url || null;
      }
    }

    return NextResponse.json({
      success: true,
      invitation: {
        fullName: invitation.full_name,
        email: invitation.email,
        mobile: invitation.mobile,
        roleName: (invitation.role as any)?.name || 'Doctor',
        roleDescription: (invitation.role as any)?.description || '',
        organizationName: resolvedOrgName || 'Helix care',
        logoUrl: logoUrl || null,
        branches: assignedBranchNames,
        doctorRegNo: invitation.doctor_reg_no,
        specialty: invitation.specialty,
        expiresAt: invitation.expires_at,
      },
    });
  } catch (err: any) {
    console.error('[API Invite GET Error]:', err);
    return NextResponse.json({ error: err?.message || 'Failed to validate invitation.' }, { status: 500 });
  }
}

// POST: Accept invitation and provision staff account
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token?.trim()) {
      return NextResponse.json({ error: 'Invitation token is required.' }, { status: 400 });
    }

    const client = getClient();

    // 1. Fetch pending invitation
    const { data: invitation, error: invError } = await client
      .from('staff_invitations')
      .select('*')
      .eq('invite_token', token.trim())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (invError || !invitation) {
      return NextResponse.json(
        { error: 'This invitation is invalid, expired, or has already been accepted.' },
        { status: 400 }
      );
    }

    let targetUserId: string | null = null;

    // Check if caller sent an auth token (user already logged in)
    const authHeader = request.headers.get('Authorization');
    const userToken = authHeader?.replace(/^Bearer\s+/i, '') || '';

    if (userToken) {
      const { data: { user } } = await client.auth.getUser(userToken);
      if (user) {
        targetUserId = user.id;
      }
    }

    // If not logged in, provision or update staff user with chosen password
    if (!targetUserId) {
      if (!password || password.length < 8) {
        return NextResponse.json(
          { error: 'Please choose a secure password of at least 8 characters.' },
          { status: 400 }
        );
      }

      const cleanEmail = invitation.email.trim().toLowerCase();
      const cleanPassword = password.trim();
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (serviceRoleKey) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hhilecvljlzbrdyykpxo.supabase.co';
        const adminClient = createClient(url, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // 1. Try to create user with email_confirm: true (bypasses email confirmation lock)
        const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password: cleanPassword,
          email_confirm: true,
          user_metadata: {
            full_name: invitation.full_name,
            name: invitation.full_name,
            phone: invitation.mobile,
            mobile: invitation.mobile,
          },
        });

        if (createdUser?.user) {
          targetUserId = createdUser.user.id;
        } else if (createError) {
          // 2. If user already exists, find by email and update password & confirm email status
          const { data: userList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
          const existing = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
          if (existing) {
            targetUserId = existing.id;
            await adminClient.auth.admin.updateUserById(existing.id, {
              password: cleanPassword,
              email_confirm: true,
              user_metadata: {
                ...existing.user_metadata,
                full_name: invitation.full_name,
                mobile: invitation.mobile,
              },
            });
          } else {
            return NextResponse.json({ error: createError.message || 'Failed to create staff account.' }, { status: 400 });
          }
        }
      } else {
        // Fallback to standard client sign up
        const { data: signUpData, error: signUpError } = await client.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: invitation.full_name,
              name: invitation.full_name,
              phone: invitation.mobile,
              mobile: invitation.mobile,
            },
          },
        });

        if (signUpError) {
          if (signUpError.message.includes('already registered') || signUpError.message.includes('User already registered')) {
            const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
              email: cleanEmail,
              password: cleanPassword,
            });

            if (!signInError && signInData?.user) {
              targetUserId = signInData.user.id;
            } else {
              // Fetch user profile if existing
              const { data: prof } = await client
                .from('profiles')
                .select('id')
                .eq('email', cleanEmail)
                .maybeSingle();

              if (prof?.id) {
                targetUserId = prof.id;
              } else {
                return NextResponse.json(
                  { error: 'An account with this email already exists. Please sign in with your existing Healthiva password to link this clinic.' },
                  { status: 400 }
                );
              }
            }
          } else {
            return NextResponse.json({ error: signUpError.message }, { status: 400 });
          }
        } else if (signUpData?.user) {
          targetUserId = signUpData.user.id;
        }
      }
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'Failed to authenticate or create staff user.' }, { status: 400 });
    }

    // 2. Call the atomic accept_staff_invitation RPC in PostgreSQL
    const { data: rpcResult, error: rpcError } = await client.rpc('accept_staff_invitation', {
      p_invite_token: token.trim(),
      p_user_id: targetUserId,
    });

    if (rpcError || (rpcResult && rpcResult.success === false)) {
      console.warn('[RPC accept_staff_invitation failed, falling back to direct linking]:', rpcError || rpcResult);

      // Direct fallback linking
      await client
        .from('profiles')
        .upsert({
          id: targetUserId,
          full_name: invitation.full_name,
          email: invitation.email,
          mobile: invitation.mobile,
        });

      const { data: mem } = await client
        .from('memberships')
        .upsert({
          organization_id: invitation.organization_id,
          user_id: targetUserId,
          status: 'active',
          permission_mode: invitation.permission_mode || 'template',
          custom_permissions: invitation.custom_permissions || null,
        })
        .select('id')
        .single();

      if (mem?.id) {
        // Guardrail: Do not overwrite role if user is already an Owner
        const { data: existingRoles } = await client
          .from('membership_roles')
          .select('role_id')
          .eq('membership_id', mem.id);

        const isOwnerAccount = existingRoles?.some((r) => r.role_id === '11111111-1111-1111-1111-111111111111');

        if (!isOwnerAccount) {
          await client
            .from('membership_roles')
            .upsert({
              membership_id: mem.id,
              role_id: invitation.role_id,
            });
        }

        if (Array.isArray(invitation.branch_ids)) {
          for (const bId of invitation.branch_ids) {
            await client.from('membership_clinic_scopes').upsert({
              membership_id: mem.id,
              clinic_id: bId,
            });
          }
        }
      }

      await client
        .from('staff_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);
    }

    return NextResponse.json({
      success: true,
      message: `Welcome to the team! You have successfully joined the clinic.`,
      redirectUrl: '/dashboard',
    });
  } catch (err: any) {
    console.error('[API Invite POST Error]:', err);
    return NextResponse.json({ error: err?.message || 'Failed to accept invitation.' }, { status: 500 });
  }
}
