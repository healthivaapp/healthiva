import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendStaffInvitationEmail } from '@/lib/email';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

// System Role UUID dictionary fallback
const ROLE_UUIDS: Record<string, string> = {
  owner: '11111111-1111-1111-1111-111111111111',
  doctor: '22222222-2222-2222-2222-222222222222',
  receptionist: '33333333-3333-3333-3333-333333333333',
  pharmacist: '44444444-4444-4444-4444-444444444444',
};

interface ClinicRow {
  id: string;
  name: string;
  code: string;
  city?: string;
}

interface StaffInvitationRow {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  role?: { id: string; name: string; description?: string } | null;
  branch_ids?: string[] | null;
  specialty?: string | null;
  permission_mode?: 'template' | 'custom' | null;
  custom_permissions?: string[] | null;
  invite_token?: string | null;
  status: string;
  created_at: string;
  expires_at?: string | null;
}

interface ProfileRow {
  id: string;
  full_name?: string | null;
  email?: string | null;
  mobile?: string | null;
  doctor_reg_no?: string | null;
}

interface MembershipRow {
  id: string;
  user_id: string;
  status?: string | null;
  is_primary_owner?: boolean | null;
  org_authority?: string | null;
  permission_mode?: 'template' | 'custom' | null;
  custom_permissions?: string[] | null;
  default_clinic_id?: string | null;
  joined_at?: string | null;
  created_at: string;
  membership_roles?: Array<{
    role?: {
      id: string;
      name: string;
      description?: string;
      icon?: string;
      is_custom?: boolean;
      can_prescribe?: boolean;
    } | null;
  }> | null;
  membership_clinic_scopes?: Array<{ clinic?: ClinicRow | null }> | null;
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

  // Fetch user's active membership
  const { data: membership, error: memError } = await client
    .from('memberships')
    .select('id, organization_id, status, is_primary_owner, org_authority, permission_mode, custom_permissions, default_clinic_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memError || !membership) {
    return { error: 'No active clinic organization found for this user.', status: 403 };
  }

  // Fetch user role
  const { data: memRole } = await client
    .from('membership_roles')
    .select('role_id, role:roles(id, name, description, is_custom, can_prescribe)')
    .eq('membership_id', membership.id)
    .limit(1)
    .maybeSingle();

  // Fetch user profile (for email, mobile, full_name, doctor_reg_no)
  const { data: profile } = await client
    .from('profiles')
    .select('id, full_name, email, mobile, doctor_reg_no')
    .eq('id', user.id)
    .maybeSingle();

  const roleRow = memRole?.role as { name?: string } | null;
  const roleName = (roleRow?.name || 'Owner').toLowerCase();
  const isPrimaryOwner = Boolean(
    membership.is_primary_owner === true || membership.org_authority === 'primary_owner'
  );
  const isOwner =
    isPrimaryOwner ||
    membership.org_authority === 'administrator' ||
    roleName === 'owner';

  return {
    client,
    user,
    profile,
    membership,
    isOwner,
    isPrimaryOwner,
    orgAuthority: membership.org_authority || (isPrimaryOwner ? 'primary_owner' : 'none'),
    userRole: roleName,
    organizationId: membership.organization_id,
  };
}

// GET: Fetch all active staff members and pending invitations in organization
export async function GET(request: Request) {
  try {
    const authResult = await resolveUserAndOrg(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, organizationId } = authResult;

    // Fetch organization settings for role_overrides
    const { data: orgSettings } = await client
      .from('organization_settings')
      .select('workflow_json')
      .eq('organization_id', organizationId)
      .maybeSingle();

    const roleOverrides = (orgSettings?.workflow_json as any)?.role_overrides || {};
    const docPerms = roleOverrides.Doctor || roleOverrides.doctor || [...DEFAULT_ROLE_PERMISSIONS.doctor];
    const recPerms = roleOverrides.Receptionist || roleOverrides.receptionist || [...DEFAULT_ROLE_PERMISSIONS.receptionist];
    const pharmPerms = roleOverrides.Pharmacist || roleOverrides.pharmacist || [...DEFAULT_ROLE_PERMISSIONS.pharmacist];
    const ownerPerms = [...DEFAULT_ROLE_PERMISSIONS.owner];

    const roleTemplates: Record<string, string[]> = {
      Doctor: docPerms,
      doctor: docPerms,
      Receptionist: recPerms,
      receptionist: recPerms,
      Pharmacist: pharmPerms,
      pharmacist: pharmPerms,
      Owner: ownerPerms,
      owner: ownerPerms,
    };

    // Fetch all clinics in organization to map branches & grant Owner full scope
    const { data: allClinicsData } = await client
      .from('clinics')
      .select('id, name, code, city')
      .eq('organization_id', organizationId);

    const allClinics: ClinicRow[] = (allClinicsData as ClinicRow[]) || [];
    const clinicMap = new Map<string, ClinicRow>(allClinics.map((c) => [c.id, c]));

    // Fetch all staff invitations for this organization (owner has full read permissions)
    let allInvitations: StaffInvitationRow[] = [];
    try {
      const { data: invList } = await client
        .from('staff_invitations')
        .select(`
          id,
          full_name,
          email,
          mobile,
          role:roles(id, name, description),
          branch_ids,
          specialty,
          permission_mode,
          custom_permissions,
          invite_token,
          status,
          created_at,
          expires_at
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (invList) {
        allInvitations = invList as unknown as StaffInvitationRow[];
      }
    } catch (invCatchErr) {
      console.warn('[Note: allInvitations query bypass]:', invCatchErr);
    }

    // 1. Try atomic SECURITY DEFINER RPC first (Bypasses RLS filtering bugs for clinic staff)
    try {
      const { data: rpcData, error: rpcError } = await client.rpc('get_organization_staff', {
        p_org_id: organizationId,
      });

      if (!rpcError && rpcData && rpcData.success) {
        const rawActive = (rpcData.activeStaff || []) as Array<{
          membershipId: string;
          userId: string;
          fullName: string;
          email: string;
          mobile: string;
          roleName: string;
          roleId: string;
          status: string;
          permissionMode: 'template' | 'custom';
          customPermissions: string[] | null;
          assignedBranches: ClinicRow[];
          createdAt: string;
          isInvitation: boolean;
        }>;

        const rawPending = (rpcData.pendingInvitations || []) as Array<{
          membershipId: string;
          invitationId: string;
          inviteToken?: string;
          fullName: string;
          email: string;
          mobile: string;
          roleName: string;
          roleId: string;
          status: string;
          permissionMode: 'template' | 'custom';
          customPermissions: string[] | null;
          assignedBranches: ClinicRow[];
          createdAt: string;
          expiresAt?: string;
          isInvitation: boolean;
        }>;

        const activeStaff = rawActive.map((s) => {
          const roleName = s.roleName || 'Doctor';
          const isOwner = roleName.toLowerCase() === 'owner';
          const assignedBranches = isOwner ? allClinics : (s.assignedBranches || []);

          // Match invitation for specialty if needed
          const matchedInv = allInvitations.find((inv) =>
            (inv.email && s.email && inv.email.toLowerCase() === s.email.toLowerCase()) ||
            (inv.mobile && s.mobile && inv.mobile === s.mobile)
          );

          return {
            membershipId: s.membershipId,
            userId: s.userId,
            fullName: s.fullName || 'Staff Member',
            email: s.email || '',
            mobile: s.mobile || '',
            roleName,
            roleId: s.roleId || '',
            specialty: matchedInv?.specialty || '',
            status: s.status || 'active',
            permissionMode: s.permissionMode || 'template',
            customPermissions: s.customPermissions || null,
            defaultClinicId: assignedBranches?.[0]?.id || '',
            assignedBranches,
            createdAt: s.createdAt,
            isInvitation: false,
            isOwner,
          };
        });

        const nowIso = new Date().toISOString();
        const pendingInvitations = rawPending.map((inv) => {
          const isExpired = Boolean(inv.expiresAt && inv.expiresAt < nowIso);
          const daysLeft = inv.expiresAt
            ? Math.max(0, Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : 7;

          return {
            membershipId: inv.membershipId || inv.invitationId,
            invitationId: inv.invitationId || inv.membershipId,
            inviteToken: inv.inviteToken,
            fullName: inv.fullName,
            email: inv.email,
            mobile: inv.mobile,
            roleName: inv.roleName || 'Doctor',
            roleId: inv.roleId || '',
            specialty: '',
            status: 'pending',
            isExpired,
            daysLeft,
            permissionMode: inv.permissionMode || 'template',
            customPermissions: inv.customPermissions || null,
            assignedBranches: inv.assignedBranches || [],
            createdAt: inv.createdAt,
            expiresAt: inv.expiresAt,
            isInvitation: true,
          };
        });

        return NextResponse.json(
          {
            success: true,
            staff: [...activeStaff, ...pendingInvitations],
            activeStaff,
            pendingInvitations,
            roleTemplates,
            counts: {
              total: activeStaff.length + pendingInvitations.length,
              active: activeStaff.filter((s) => s.status === 'active').length,
              suspended: activeStaff.filter((s) => s.status === 'disabled').length,
              pending: pendingInvitations.length,
            },
          },
          {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            },
          }
        );
      }
    } catch (rpcCatchErr) {
      console.warn('[Note: RPC get_organization_staff bypass, using table queries]:', rpcCatchErr);
    }

    // 2. Fallback: Fetch memberships directly with role and branch scopes
    const { data: memberships, error: memsError } = await client
      .from('memberships')
      .select(`
        id,
        user_id,
        status,
        is_primary_owner,
        org_authority,
        permission_mode,
        custom_permissions,
        default_clinic_id,
        joined_at,
        created_at,
        membership_roles(role:roles(id, name, description, icon, is_custom, can_prescribe)),
        membership_clinic_scopes(clinic:clinics(id, name, code, city))
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (memsError) {
      console.warn('[Warning fetching memberships]:', memsError.message);
    }

    // Fetch profiles separately by user_ids to avoid PostgREST relationship ambiguity
    const rawMemberships = (memberships as unknown as MembershipRow[]) || [];
    const userIds = rawMemberships.map((m) => m.user_id).filter(Boolean);
    const profileMap = new Map<string, ProfileRow>();
    if (userIds.length > 0) {
      const { data: profiles } = await client
        .from('profiles')
        .select('id, full_name, email, mobile, doctor_reg_no')
        .in('id', userIds);

      if (profiles) {
        (profiles as ProfileRow[]).forEach((p) => profileMap.set(p.id, p));
      }
    }

    // Format & Enrich Active Staff
    const activeStaff = rawMemberships.map((m) => {
      const roleObj = m.membership_roles?.[0]?.role;
      const roleName = roleObj?.name || 'Doctor';
      const isPrimaryOwner = Boolean(m.is_primary_owner);
      const isOwner = isPrimaryOwner || m.org_authority === 'administrator' || roleName.toLowerCase() === 'owner';

      // Branch Scopes: Owner ALWAYS has access to ALL clinic branches
      const assignedClinics = isOwner
        ? allClinics
        : (m.membership_clinic_scopes || []).map((s) => s.clinic).filter((c): c is ClinicRow => Boolean(c));

      const prof = profileMap.get(m.user_id);

      // Resolve Name, Mobile, Email & Specialty (Enrich from staff_invitations if profile is blank/blocked)
      let resolvedName = prof?.full_name;
      let resolvedEmail = prof?.email;
      let resolvedMobile = prof?.mobile;
      let resolvedSpecialty = '';

      if (!resolvedName || resolvedName === 'Staff Member' || !resolvedMobile || !resolvedEmail) {
        // Match from invitations by email, mobile, role or accepted status
        const matchedInv = allInvitations.find((inv) =>
          (inv.email && prof?.email && inv.email.toLowerCase() === prof.email.toLowerCase()) ||
          (inv.mobile && prof?.mobile && inv.mobile === prof.mobile) ||
          (inv.status === 'accepted') ||
          (allInvitations.length === 1 && !isOwner)
        );

        if (matchedInv) {
          if (!resolvedName || resolvedName === 'Staff Member') resolvedName = matchedInv.full_name;
          if (!resolvedEmail) resolvedEmail = matchedInv.email;
          if (!resolvedMobile) resolvedMobile = matchedInv.mobile;
          if (!resolvedSpecialty) resolvedSpecialty = matchedInv.specialty || '';
        }
      }

      return {
        membershipId: m.id,
        userId: m.user_id,
        fullName: resolvedName || 'Staff Member',
        email: resolvedEmail || '',
        mobile: resolvedMobile || '',
        doctorRegNo: prof?.doctor_reg_no || '',
        roleName,
        roleId: roleObj?.id || '',
        isCustomRole: Boolean(roleObj?.is_custom),
        canPrescribe: Boolean(roleObj?.can_prescribe),
        specialty: resolvedSpecialty,
        status: m.status || 'active',
        permissionMode: m.permission_mode || 'template',
        customPermissions: m.custom_permissions || null,
        defaultClinicId: m.default_clinic_id || assignedClinics?.[0]?.id || '',
        assignedBranches: assignedClinics,
        createdAt: m.created_at,
        isInvitation: false,
        isOwner,
        isPrimaryOwner,
        orgAuthority: m.org_authority || (isPrimaryOwner ? 'primary_owner' : 'none'),
      };
    });

    // Format Pending Invitations
    const nowIso = new Date().toISOString();
    const pendingInvs = allInvitations.filter((inv) => inv.status === 'pending');

    const invitedStaff = pendingInvs.map((inv) => {
      const roleObj = inv.role;
      const assignedClinics = (inv.branch_ids || [])
        .map((bId) => clinicMap.get(bId))
        .filter((c): c is ClinicRow => Boolean(c));

      const isExpired = Boolean(inv.expires_at && inv.expires_at < nowIso);
      const daysLeft = inv.expires_at
        ? Math.max(0, Math.ceil((new Date(inv.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 7;

      return {
        membershipId: inv.id,
        invitationId: inv.id,
        inviteToken: inv.invite_token,
        fullName: inv.full_name,
        email: inv.email,
        mobile: inv.mobile,
        roleName: roleObj?.name || 'Doctor',
        roleId: roleObj?.id || '',
        specialty: inv.specialty || '',
        status: 'pending',
        isExpired,
        daysLeft,
        permissionMode: inv.permission_mode || 'template',
        customPermissions: inv.custom_permissions || null,
        assignedBranches: assignedClinics,
        createdAt: inv.created_at,
        expiresAt: inv.expires_at,
        isInvitation: true,
      };
    });

    return NextResponse.json(
      {
        success: true,
        staff: [...activeStaff, ...invitedStaff],
        activeStaff,
        pendingInvitations: invitedStaff,
        roleTemplates,
        counts: {
          total: activeStaff.length + invitedStaff.length,
          active: activeStaff.filter((s) => s.status === 'active').length,
          suspended: activeStaff.filter((s) => s.status === 'disabled').length,
          pending: invitedStaff.length,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch staff members.';
    console.error('[API Staff GET error]:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// POST: Invite a new staff member with branch scoping & optional custom permissions
export async function POST(request: Request) {
  try {
    const authResult = await resolveUserAndOrg(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, isOwner, organizationId, user } = authResult;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Access denied: Only clinic owners can invite and manage staff.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      fullName,
      email,
      mobile,
      roleName = 'Doctor',
      branchIds = [],
      doctorRegNo,
      specialty,
      permissionMode = 'template',
      customPermissions = null,
    } = body;

    // Validation
    if (!fullName?.trim() || !email?.trim() || !mobile?.trim()) {
      return NextResponse.json({ error: 'Name, email, and mobile are required.' }, { status: 400 });
    }

    if (!/^\d{10}$/.test(mobile.trim().replace(/\D/g, ''))) {
      return NextResponse.json({ error: 'Mobile number must be a valid 10-digit phone number.' }, { status: 400 });
    }

    if (!Array.isArray(branchIds) || branchIds.length === 0) {
      return NextResponse.json({ error: 'Please assign this staff member to at least one branch location.' }, { status: 400 });
    }

    const cleanRoleName = String(roleName || 'Doctor').trim();
    const lowerRole = cleanRoleName.toLowerCase();

    // 1. Resolve role ID (query DB or use standard UUID fallback)
    let roleId = ROLE_UUIDS[lowerRole];
    const { data: roleRow } = await client
      .from('roles')
      .select('id')
      .ilike('name', cleanRoleName)
      .limit(1)
      .maybeSingle();

    if (roleRow?.id) {
      roleId = roleRow.id;
    }

    if (!roleId) {
      roleId = ROLE_UUIDS.doctor;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = mobile.trim().replace(/\D/g, '');

    // 1. Self-Invite Check (Owner cannot invite themselves)
    const ownerEmail = user?.email?.toLowerCase();
    const ownerMobile = authResult.profile?.mobile?.trim().replace(/\D/g, '');
    const isOwnerEmail = Boolean(ownerEmail && cleanEmail === ownerEmail);
    const isOwnerMobile = Boolean(ownerMobile && cleanMobile === ownerMobile);

    if (isOwnerEmail && isOwnerMobile) {
      return NextResponse.json(
        { error: 'Both this email and mobile number are registered to your clinic owner account. Please enter the new staff member’s own contact details.' },
        { status: 400 }
      );
    }
    if (isOwnerEmail) {
      return NextResponse.json(
        { error: 'This email address is registered to your clinic owner account. Please enter the new staff member’s email address.' },
        { status: 400 }
      );
    }
    if (isOwnerMobile) {
      return NextResponse.json(
        { error: 'This mobile number is registered to your clinic owner account. Please enter the new staff member’s 10-digit mobile number.' },
        { status: 400 }
      );
    }

    // 2. Active Staff Duplicate Check (Check against all active members in this clinic)
    const { data: existingStaff } = await client
      .from('memberships')
      .select('id, profile:profiles(id, full_name, email, mobile)')
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    if (Array.isArray(existingStaff)) {
      for (const m of existingStaff) {
        const rawProf = Array.isArray((m as any).profile) ? (m as any).profile[0] : (m as any).profile;
        const p = rawProf as { full_name?: string | null; email?: string | null; mobile?: string | null } | null | undefined;
        if (!p) continue;
        const pMobile = p.mobile?.trim().replace(/\D/g, '');
        const pEmail = p.email?.trim().toLowerCase();

        if (pMobile && pMobile === cleanMobile) {
          return NextResponse.json(
            {
              error: `Mobile number ${cleanMobile} is already in use by active staff member "${p.full_name || 'Staff'}". Please check the staff directory or use a different number.`,
            },
            { status: 400 }
          );
        }
        if (pEmail && pEmail === cleanEmail) {
          return NextResponse.json(
            {
              error: `Email address "${cleanEmail}" is already registered to active staff member "${p.full_name || 'Staff'}". Please use a different email address.`,
            },
            { status: 400 }
          );
        }
      }
    }

    // 3. Pending Invitation Duplicate Check (Check against existing unexpired invitations in this clinic)
    const { data: pendingInvs } = await client
      .from('staff_invitations')
      .select('id, full_name, email, mobile')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (Array.isArray(pendingInvs)) {
      for (const inv of pendingInvs) {
        const invMobile = inv.mobile?.trim().replace(/\D/g, '');
        const invEmail = inv.email?.trim().toLowerCase();

        if (invMobile && invMobile === cleanMobile) {
          return NextResponse.json(
            {
              error: `An invitation is already pending for mobile number ${cleanMobile} (${inv.full_name}). You can click "Share Invite" in the staff directory below to resend their link.`,
            },
            { status: 400 }
          );
        }
        if (invEmail && invEmail === cleanEmail) {
          return NextResponse.json(
            {
              error: `An invitation is already pending for email "${cleanEmail}" (${inv.full_name}). You can click "Share Invite" in the staff directory below to resend their link.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const inviteToken = crypto.randomUUID();

    const sanitizedCustomPerms =
      permissionMode === 'custom' && Array.isArray(customPermissions)
        ? customPermissions.filter((p: any) => ALL_PERMISSIONS.includes(p))
        : null;

    // 4. Insert into staff_invitations table
    const { data: newInv, error: invError } = await client
      .from('staff_invitations')
      .insert({
        organization_id: organizationId,
        invited_by: user.id,
        full_name: fullName.trim(),
        email: cleanEmail,
        mobile: cleanMobile,
        role_id: roleId,
        branch_ids: branchIds,
        doctor_reg_no: doctorRegNo?.trim() || null,
        specialty: specialty?.trim() || null,
        permission_mode: permissionMode === 'custom' ? 'custom' : 'template',
        custom_permissions: sanitizedCustomPerms,
        invite_token: inviteToken,
        status: 'pending',
      })
      .select()
      .single();

    if (invError) {
      console.error('[staff_invitations insert error]:', invError);
      return NextResponse.json({ error: invError.message || 'Failed to save invitation.' }, { status: 500 });
    }

    // Generate absolute invite link
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const inviteLink = `${origin}/invite/accept?token=${inviteToken}`;

    // Automatic background email delivery via Resend
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { data: orgRow } = await client
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .maybeSingle();

      const orgName = orgRow?.name || 'Helix care';
      const inviterName = authResult.profile?.full_name || 'Clinic Administrator';

      // Resolve human-readable branch names for the invitation email
      let branchNames: string[] = [];
      if (Array.isArray(branchIds) && branchIds.length > 0) {
        const { data: cRows } = await client
          .from('clinics')
          .select('name')
          .in('id', branchIds);
        if (cRows && cRows.length > 0) {
          branchNames = cRows.map((c: { name: string }) => c.name);
        }
      }

      const emailResult = await sendStaffInvitationEmail({
        to: cleanEmail,
        recipientName: fullName.trim(),
        clinicName: orgName,
        roleName: roleName || 'Staff',
        inviteLink,
        inviterName,
        branches: branchNames,
      });

      emailSent = emailResult.success;
      if (!emailResult.success) {
        emailError = emailResult.error || null;
      }
    } catch (mailErr: unknown) {
      const errMsg = mailErr instanceof Error ? mailErr.message : null;
      console.warn('[Auto Email Dispatch Warning]:', mailErr);
      emailError = errMsg;
    }

    return NextResponse.json({
      success: true,
      message: `Invitation created for ${fullName.trim()}!${emailSent ? ' Invitation email was delivered to ' + cleanEmail : ''}`,
      inviteLink,
      inviteToken,
      invitationId: newInv?.id || inviteToken,
      emailSent,
      emailError,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to invite staff member.';
    console.error('[API Staff POST error]:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// PUT: Update staff member or pending invitation (Owner only)
export async function PUT(request: Request) {
  try {
    const authResult = await resolveUserAndOrg(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, isOwner, organizationId, user } = authResult;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Access denied: Only clinic owners can modify staff settings.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 0. SPECIAL ACTION: TRANSFER ORGANIZATION OWNERSHIP (Primary Owner only)
    if (body.action === 'transfer_ownership') {
      const { newOwnerUserId, confirmedOrgName } = body;
      if (!authResult.isPrimaryOwner) {
        return NextResponse.json(
          { error: 'Unauthorized: Only the current Primary Owner can transfer clinic ownership.' },
          { status: 403 }
        );
      }
      if (!newOwnerUserId || !confirmedOrgName) {
        return NextResponse.json(
          { error: 'New owner user ID and confirmed organization name are required.' },
          { status: 400 }
        );
      }

      const { data: xferRes, error: xferErr } = await client.rpc('transfer_organization_ownership', {
        p_org_id: organizationId,
        p_new_owner_user_id: newOwnerUserId,
        p_confirmed_org_name: confirmedOrgName,
      });

      if (xferErr || (xferRes && !xferRes.success)) {
        return NextResponse.json(
          { error: xferErr?.message || xferRes?.error || 'Failed to transfer ownership.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Clinic ownership successfully transferred. You are now an Administrator.',
      });
    }

    const {
      targetType, // 'member' | 'invitation'
      membershipId,
      invitationId,
      fullName,
      email,
      mobile,
      doctorRegNo,
      roleName,
      roleId,
      orgAuthority,
      specialty,
      branchIds,
      defaultClinicId,
      permissionMode,
      customPermissions,
      status,
      renewExpired,
    } = body;

    // Resolve Role UUID if roleName provided
    let resolvedRoleId = roleId;
    if (!resolvedRoleId && roleName) {
      const lower = roleName.toLowerCase();
      resolvedRoleId = ROLE_UUIDS[lower];
      if (!resolvedRoleId) {
        const { data: rRow } = await client.from('roles').select('id').ilike('name', roleName).maybeSingle();
        if (rRow) resolvedRoleId = rRow.id;
      }
    }

    // ==========================================
    // A. UPDATE PENDING INVITATION
    // ==========================================
    if (targetType === 'invitation' || invitationId) {
      const targetInvId = invitationId || membershipId;
      if (!targetInvId) {
        return NextResponse.json({ error: 'Invitation ID is required.' }, { status: 400 });
      }

      const invUpdates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (fullName?.trim()) invUpdates.full_name = fullName.trim();
      if (email?.trim()) invUpdates.email = email.trim().toLowerCase();
      if (mobile?.trim()) invUpdates.mobile = mobile.trim().replace(/\D/g, '');
      if (resolvedRoleId) invUpdates.role_id = resolvedRoleId;
      if (Array.isArray(branchIds) && branchIds.length > 0) invUpdates.branch_ids = branchIds;
      if (specialty !== undefined) invUpdates.specialty = specialty?.trim() || null;
      if (permissionMode) {
        invUpdates.permission_mode = permissionMode === 'custom' ? 'custom' : 'template';
        invUpdates.custom_permissions =
          permissionMode === 'custom' && Array.isArray(customPermissions)
            ? customPermissions.filter((c: any) => ALL_PERMISSIONS.includes(c))
            : null;
      }
      if (renewExpired || body.renewExpiry || body.renewExpired) {
        invUpdates.expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        invUpdates.status = 'pending';
      }

      const { error: invUpErr } = await client
        .from('staff_invitations')
        .update(invUpdates)
        .eq('id', targetInvId)
        .eq('organization_id', organizationId);

      if (invUpErr) {
        return NextResponse.json({ error: invUpErr.message || 'Failed to update invitation.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: (renewExpired || body.renewExpiry || body.renewExpired) ? 'Invitation extended by 7 days successfully.' : 'Invitation details updated successfully.',
      });
    }

    // ==========================================
    // B. UPDATE ACTIVE STAFF MEMBER
    // ==========================================
    if (!membershipId) {
      return NextResponse.json({ error: 'Membership ID is required.' }, { status: 400 });
    }

    // Fetch target membership to get user_id, is_primary_owner, org_authority
    const { data: targetMem, error: memFetchErr } = await client
      .from('memberships')
      .select('id, user_id, organization_id, is_primary_owner, org_authority')
      .eq('id', membershipId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (memFetchErr || !targetMem) {
      return NextResponse.json({ error: 'Staff membership not found.' }, { status: 404 });
    }

    const isTargetPrimaryOwner = Boolean(
      targetMem.is_primary_owner === true || targetMem.org_authority === 'primary_owner'
    );

    // Guardrail: Check if target membership belongs to a Clinic Owner
    const { data: currentRoles } = await client
      .from('membership_roles')
      .select('role_id')
      .eq('membership_id', membershipId);

    const isTargetOwner =
      isTargetPrimaryOwner ||
      targetMem.user_id === user.id ||
      currentRoles?.some((r) => r.role_id === '11111111-1111-1111-1111-111111111111');

    // 1. Update Membership status, permission mode & default clinic
    const memUpdates: Record<string, unknown> = {};
    if (status && (status === 'active' || status === 'disabled' || status === 'suspended')) {
      // Guardrail: Cannot disable or suspend Primary Owner
      if ((status === 'disabled' || status === 'suspended') && isTargetPrimaryOwner) {
        return NextResponse.json(
          { error: 'Primary Owner account cannot be deactivated or suspended.' },
          { status: 400 }
        );
      }
      memUpdates.status = status;
    }

    // Guardrail: Only Primary Owner can promote/demote Administrator authority
    if (orgAuthority !== undefined) {
      if (!authResult.isPrimaryOwner) {
        return NextResponse.json(
          { error: 'Unauthorized: Only the Primary Owner can assign or revoke Administrator authority.' },
          { status: 403 }
        );
      }
      if (isTargetPrimaryOwner && orgAuthority !== 'primary_owner') {
        return NextResponse.json(
          { error: 'Primary Owner cannot be demoted. Use ownership transfer instead.' },
          { status: 400 }
        );
      }
      if (orgAuthority === 'administrator' || orgAuthority === 'none') {
        memUpdates.org_authority = orgAuthority;
      }
    }

    if (permissionMode) {
      memUpdates.permission_mode = permissionMode === 'custom' ? 'custom' : 'template';
      memUpdates.custom_permissions =
        permissionMode === 'custom' && Array.isArray(customPermissions)
          ? customPermissions.filter((c: any) => ALL_PERMISSIONS.includes(c))
          : null;
    }
    if (defaultClinicId) {
      memUpdates.default_clinic_id = defaultClinicId;
    }

    if (Object.keys(memUpdates).length > 0) {
      await client
        .from('memberships')
        .update(memUpdates)
        .eq('id', membershipId)
        .eq('organization_id', organizationId);
    }

    // 2. Update Profile details in public.profiles (Name, Email, Mobile, Doctor Reg No)
    if (targetMem.user_id && (fullName || email || mobile || doctorRegNo !== undefined)) {
      const profUpdates: Record<string, unknown> = {};
      if (fullName?.trim()) profUpdates.full_name = fullName.trim();
      if (email?.trim()) profUpdates.email = email.trim().toLowerCase();
      if (mobile?.trim()) profUpdates.mobile = mobile.trim().replace(/\D/g, '');
      if (doctorRegNo !== undefined) profUpdates.doctor_reg_no = doctorRegNo?.trim() || null;

      await client
        .from('profiles')
        .update(profUpdates)
        .eq('id', targetMem.user_id);
    }

    // 3. Update Role in membership_roles (Owner role is protected and locked)
    const targetRoleId = isTargetOwner
      ? '11111111-1111-1111-1111-111111111111'
      : (resolvedRoleId || currentRoles?.[0]?.role_id || ROLE_UUIDS.doctor);

    await client
      .from('membership_roles')
      .delete()
      .eq('membership_id', membershipId);

    await client
      .from('membership_roles')
      .insert({
        membership_id: membershipId,
        role_id: targetRoleId,
      });

    // 4. Update Branch Scopes in membership_clinic_scopes
    if (Array.isArray(branchIds) && branchIds.length > 0) {
      await client
        .from('membership_clinic_scopes')
        .delete()
        .eq('membership_id', membershipId);

      const scopeInserts = branchIds.map((bId: string) => ({
        membership_id: membershipId,
        clinic_id: bId,
      }));

      await client
        .from('membership_clinic_scopes')
        .insert(scopeInserts);
    }

    // 5. Keep staff_invitations synced if any matching invitation exists
    if (specialty !== undefined || fullName || email || mobile) {
      const syncUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (specialty !== undefined) syncUpdates.specialty = specialty?.trim() || null;
      if (fullName?.trim()) syncUpdates.full_name = fullName.trim();
      if (email?.trim()) syncUpdates.email = email.trim().toLowerCase();
      if (mobile?.trim()) syncUpdates.mobile = mobile.trim().replace(/\D/g, '');
      if (!isTargetOwner && targetRoleId) syncUpdates.role_id = targetRoleId;
      if (Array.isArray(branchIds) && branchIds.length > 0) syncUpdates.branch_ids = branchIds;

      await client
        .from('staff_invitations')
        .update(syncUpdates)
        .eq('organization_id', organizationId)
        .or(`email.eq.${email?.trim().toLowerCase()},mobile.eq.${mobile?.trim().replace(/\D/g, '')}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Staff profile and access permissions updated successfully.',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update staff.';
    console.error('[API Staff PUT error]:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// DELETE: Revoke invitation OR remove staff member (Owner only)
export async function DELETE(request: Request) {
  try {
    const authResult = await resolveUserAndOrg(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, isOwner, organizationId, user } = authResult;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Access denied: Only clinic owners can remove staff or revoke invitations.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('invitationId')?.trim();
    const membershipId = searchParams.get('membershipId')?.trim();

    // 1. Revoke Pending Invitation
    if (invitationId) {
      const { error: delErr } = await client
        .from('staff_invitations')
        .delete()
        .eq('id', invitationId)
        .eq('organization_id', organizationId);

      if (delErr) {
        return NextResponse.json({ error: delErr.message || 'Failed to revoke invitation.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Staff invitation revoked and removed successfully.',
      });
    }

    // 2. Remove Active Staff Member
    if (membershipId) {
      // Fetch target membership and user id
      const { data: targetMem } = await client
        .from('memberships')
        .select('id, user_id, organization_id, is_primary_owner, org_authority')
        .eq('id', membershipId)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (!targetMem) {
        return NextResponse.json({ error: 'Staff membership not found.' }, { status: 404 });
      }

      if (
        targetMem.is_primary_owner === true ||
        targetMem.org_authority === 'primary_owner' ||
        targetMem.user_id === user.id
      ) {
        return NextResponse.json(
          { error: 'Primary Owner cannot be removed from the organization. Transfer organization ownership first.' },
          { status: 400 }
        );
      }

      // If caller is Administrator (not Primary Owner), caller cannot remove another Administrator
      if (!authResult.isPrimaryOwner && targetMem.org_authority === 'administrator') {
        return NextResponse.json(
          { error: 'Unauthorized: Only the Primary Owner can remove an Administrator.' },
          { status: 403 }
        );
      }

      const targetUserId = targetMem.user_id;

      // 1. Execute Atomic SECURITY DEFINER Database RPC
      let deletedProfile = false;
      let hasOtherOrgs = false;

      const { data: rpcRes, error: rpcErr } = await client.rpc('remove_staff_member', {
        p_membership_id: membershipId,
        p_org_id: organizationId,
      });

      if (!rpcErr && rpcRes && rpcRes.success) {
        deletedProfile = Boolean(rpcRes.deleted_profile);
        hasOtherOrgs = Boolean(rpcRes.has_other_orgs);
      } else {
        // Fallback if RPC is not run in database yet: Manual cascade
        await client.from('membership_clinic_scopes').delete().eq('membership_id', membershipId);
        await client.from('membership_roles').delete().eq('membership_id', membershipId);

        const { error: memDelErr } = await client
          .from('memberships')
          .delete()
          .eq('id', membershipId)
          .eq('organization_id', organizationId);

        if (memDelErr) {
          return NextResponse.json({ error: memDelErr.message || 'Failed to remove staff member.' }, { status: 500 });
        }

        const { data: otherMems } = await client
          .from('memberships')
          .select('id')
          .eq('user_id', targetUserId);

        hasOtherOrgs = Array.isArray(otherMems) && otherMems.length > 0;
        if (!hasOtherOrgs && targetUserId) {
          await client.from('profiles').delete().eq('id', targetUserId);
          deletedProfile = true;
        }
      }

      // 2. Auth Offboarding: Delete auth account from auth.users if user has no other clinic memberships
      if (!hasOtherOrgs && targetUserId) {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const url =
          process.env.NEXT_PUBLIC_SUPABASE_URL ||
          process.env.SUPABASE_URL ||
          'https://hhilecvljlzbrdyykpxo.supabase.co';

        if (serviceKey) {
          const adminClient = createClient(url, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { error: authDelErr } = await adminClient.auth.admin.deleteUser(targetUserId);
          if (authDelErr) {
            console.error('[Auth User Deletion Failed]:', authDelErr.message);
          }
        } else {
          console.warn('[Warning]: SUPABASE_SERVICE_ROLE_KEY is missing in process.env. Add it to apps/web/.env.local to purge auth.users automatically.');
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Staff member removed from clinic organization successfully.',
        deletedProfile,
        hasOtherOrgs,
      });
    }

    return NextResponse.json({ error: 'Missing invitationId or membershipId parameter.' }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to process deletion.';
    console.error('[API Staff DELETE error]:', err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
