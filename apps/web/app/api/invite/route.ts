import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getClient(): SupabaseClient {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://hhilecvljlzbrdyykpxo.supabase.co';

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    return createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

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
        // Enrich RPC result with requiresAuthCode and orgAuthority from table
        const { data: invRow } = await client
          .from('staff_invitations')
          .select('*')
          .eq('invite_token', token)
          .maybeSingle();

        const hasCode = Boolean(invRow?.auth_code || rpcRes.invitation.requiresAuthCode);
        const resolvedAuthority = invRow?.org_authority || rpcRes.invitation.orgAuthority || 'none';

        return NextResponse.json({
          success: true,
          invitation: {
            ...rpcRes.invitation,
            orgAuthority: resolvedAuthority,
            requiresAuthCode: hasCode,
          },
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
        orgAuthority: invitation.org_authority || 'none',
        requiresAuthCode: Boolean(invitation.auth_code),
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
    const { token, password, authCode } = body;

    if (!token?.trim()) {
      return NextResponse.json({ error: 'Invitation token is required.' }, { status: 400 });
    }

    const client = getClient();

    // 1. Fetch pending invitation with role details
    const { data: invitation, error: invError } = await client
      .from('staff_invitations')
      .select('*, role:roles(id, name, can_prescribe)')
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

    // Verify 6-digit email verification code if one was assigned
    if (invitation.auth_code && String(invitation.auth_code).trim()) {
      const cleanInputCode = authCode ? String(authCode).trim() : '';
      if (!cleanInputCode || cleanInputCode !== String(invitation.auth_code).trim()) {
        return NextResponse.json(
          { error: 'Invalid or missing 6-digit email verification code. Please check your invitation email.' },
          { status: 400 }
        );
      }
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
                name: invitation.full_name,
                phone: invitation.mobile,
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

    const targetAuthority = invitation.org_authority === 'administrator' ? 'administrator' : 'none';
    const defaultClinicId =
      Array.isArray(invitation.branch_ids) && invitation.branch_ids.length > 0
        ? invitation.branch_ids[0]
        : null;

    // 2. Call the atomic accept_staff_invitation RPC in PostgreSQL
    let rpcSucceeded = false;
    const { data: rpcResult, error: rpcError } = await client.rpc('accept_staff_invitation', {
      p_invite_token: token.trim(),
      p_user_id: targetUserId,
      p_auth_code: authCode ? String(authCode).trim() : null,
    });

    if (!rpcError && rpcResult && rpcResult.success === true) {
      rpcSucceeded = true;
    } else {
      console.warn('[RPC accept_staff_invitation fallback triggered]:', rpcError || rpcResult);
    }

    // 3. Ensure profile, membership, role, branch scopes, and invitation status are 100% synced
    if (!rpcSucceeded) {
      // A. Upsert profile with doctor_reg_no
      const { error: profErr } = await client
        .from('profiles')
        .upsert({
          id: targetUserId,
          full_name: invitation.full_name,
          email: invitation.email.trim().toLowerCase(),
          mobile: invitation.mobile,
          doctor_reg_no: invitation.doctor_reg_no || null,
        });

      if (profErr) {
        console.error('[Profile upsert error in invite accept]:', profErr);
      }

      // B. Create or update membership
      let membershipId: string | null = null;
      const { data: existingMem } = await client
        .from('memberships')
        .select('id, is_primary_owner, org_authority')
        .eq('organization_id', invitation.organization_id)
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (!existingMem) {
        const { data: insertedMem, error: memInsErr } = await client
          .from('memberships')
          .insert({
            organization_id: invitation.organization_id,
            user_id: targetUserId,
            status: 'active',
            org_authority: targetAuthority,
            permission_mode: invitation.permission_mode || 'template',
            custom_permissions: invitation.custom_permissions || null,
            default_clinic_id: defaultClinicId,
            joined_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (memInsErr || !insertedMem) {
          console.error('[Membership insert error in invite accept]:', memInsErr);
          return NextResponse.json(
            { error: memInsErr?.message || 'Failed to provision clinic membership.' },
            { status: 500 }
          );
        }
        membershipId = insertedMem.id;
      } else {
        membershipId = existingMem.id;
        const resolvedAuth = existingMem.is_primary_owner ? 'primary_owner' : targetAuthority;
        const { error: memUpdErr } = await client
          .from('memberships')
          .update({
            status: 'active',
            org_authority: resolvedAuth,
            permission_mode: invitation.permission_mode || 'template',
            custom_permissions: invitation.custom_permissions || null,
            default_clinic_id: defaultClinicId,
          })
          .eq('id', existingMem.id);

        // If BEFORE UPDATE trigger blocks org_authority change (pre-Migration 10), recreate non-primary membership row
        if (memUpdErr && !existingMem.is_primary_owner) {
          await client.from('membership_clinic_scopes').delete().eq('membership_id', existingMem.id);
          await client.from('membership_roles').delete().eq('membership_id', existingMem.id);
          await client.from('memberships').delete().eq('id', existingMem.id);

          const { data: recreatedMem, error: recErr } = await client
            .from('memberships')
            .insert({
              id: existingMem.id,
              organization_id: invitation.organization_id,
              user_id: targetUserId,
              status: 'active',
              org_authority: targetAuthority,
              permission_mode: invitation.permission_mode || 'template',
              custom_permissions: invitation.custom_permissions || null,
              default_clinic_id: defaultClinicId,
              joined_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (!recErr && recreatedMem) {
            membershipId = recreatedMem.id;
          }
        }
      }

      if (!membershipId) {
        return NextResponse.json(
          { error: 'Failed to link staff account to clinic organization.' },
          { status: 500 }
        );
      }

      // C. Assign role in membership_roles (protect Owner role if already an Owner)
      const { data: existingRoles } = await client
        .from('membership_roles')
        .select('role_id')
        .eq('membership_id', membershipId);

      const isOwnerAccount = existingRoles?.some((r) => r.role_id === '11111111-1111-1111-1111-111111111111');

      if (!isOwnerAccount && invitation.role_id) {
        await client.from('membership_roles').delete().eq('membership_id', membershipId);
        await client.from('membership_roles').insert({
          membership_id: membershipId,
          role_id: invitation.role_id,
        });
      }

      // D. Assign branch scopes in membership_clinic_scopes
      await client.from('membership_clinic_scopes').delete().eq('membership_id', membershipId);
      if (Array.isArray(invitation.branch_ids) && invitation.branch_ids.length > 0) {
        const scopeRows = invitation.branch_ids.map((bId: string) => ({
          membership_id: membershipId,
          clinic_id: bId,
        }));
        await client.from('membership_clinic_scopes').insert(scopeRows);
      }

      // E. Mark invitation accepted and clear auth_code (keep invite_token NOT NULL)
      const updateAcceptedPayload: Record<string, any> = {
        status: 'accepted',
        updated_at: new Date().toISOString(),
      };

      const updRes = await client
        .from('staff_invitations')
        .update({
          ...updateAcceptedPayload,
          auth_code: null,
        })
        .eq('id', invitation.id);

      if (
        updRes.error &&
        (updRes.error.message?.includes('auth_code') || updRes.error.message?.includes('schema cache'))
      ) {
        await client
          .from('staff_invitations')
          .update(updateAcceptedPayload)
          .eq('id', invitation.id);
      }
    } else {
      // Even when RPC succeeded, ensure doctor_reg_no is synced to profiles if present
      if (invitation.doctor_reg_no) {
        await client
          .from('profiles')
          .update({ doctor_reg_no: invitation.doctor_reg_no })
          .eq('id', targetUserId);
      }
    }

    // Determine role/authority-appropriate landing portal
    const resolvedRoleName = ((invitation.role as any)?.name || '').toLowerCase();
    let redirectUrl = '/dashboard';
    if (targetAuthority !== 'administrator') {
      if (resolvedRoleName === 'receptionist') {
        redirectUrl = '/reception';
      } else if (resolvedRoleName === 'pharmacist') {
        redirectUrl = '/pharmacy';
      } else if (resolvedRoleName === 'doctor') {
        redirectUrl = '/doctor';
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Welcome to the team! You have successfully joined the clinic.',
      redirectUrl,
    });
  } catch (err: any) {
    console.error('[API Invite POST Error]:', err);
    return NextResponse.json({ error: err?.message || 'Failed to accept invitation.' }, { status: 500 });
  }
}
