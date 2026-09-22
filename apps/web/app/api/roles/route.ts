import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PermissionCode, ALL_PERMISSIONS } from '@/lib/permissions';

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

// Verify caller is Primary Owner or Administrator
async function resolveAuthority(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '') || '';

  if (!token) {
    return { error: 'Unauthorized: missing access token.', status: 401 };
  }

  const client = getAuthenticatedClient(token);
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser(token);

  if (userError || !user) {
    return { error: 'Unauthorized: invalid or expired session.', status: 401 };
  }

  // Fetch active membership
  const { data: membership, error: memError } = await client
    .from('memberships')
    .select('id, organization_id, is_primary_owner, org_authority, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (memError || !membership) {
    return { error: 'No active clinic organization found for this user.', status: 403 };
  }

  // Fetch role for legacy 'owner' fallback
  const { data: memRole } = await client
    .from('membership_roles')
    .select('role:roles(name)')
    .eq('membership_id', membership.id)
    .limit(1)
    .maybeSingle();

  const roleName = ((memRole?.role as any)?.name || '').toLowerCase();
  const isAuthorized =
    membership.is_primary_owner === true ||
    membership.org_authority === 'primary_owner' ||
    membership.org_authority === 'administrator' ||
    roleName === 'owner';

  if (!isAuthorized) {
    return {
      error: 'Access denied: Only clinic Owners and Administrators can manage roles.',
      status: 403,
    };
  }

  return {
    client,
    user,
    organizationId: membership.organization_id,
    isPrimaryOwner: membership.is_primary_owner || membership.org_authority === 'primary_owner',
  };
}

// GET: Fetch all roles available for this organization
export async function GET(request: Request) {
  try {
    const authResult = await resolveAuthority(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, organizationId } = authResult;

    // 1. Try unified RPC get_organization_roles
    const { data: rpcRoles, error: rpcError } = await client.rpc('get_organization_roles', {
      p_org_id: organizationId,
    });

    if (!rpcError && Array.isArray(rpcRoles) && rpcRoles.length > 0) {
      return NextResponse.json({ success: true, roles: rpcRoles });
    }

    // 2. Direct query fallback
    const { data: roles, error: rolesError } = await client
      .from('roles')
      .select('id, name, description, icon, is_custom, can_prescribe, organization_id')
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      .neq('name', 'Owner')
      .order('is_custom', { ascending: true })
      .order('name', { ascending: true });

    if (rolesError) {
      return NextResponse.json({ error: rolesError.message }, { status: 500 });
    }

    // Fetch effective permissions from organization_role_permissions or role_permissions
    const { data: orgRolePerms } = await client
      .from('organization_role_permissions')
      .select('role_id, permission:permissions(code)')
      .eq('organization_id', organizationId);

    const { data: defaultRolePerms } = await client
      .from('role_permissions')
      .select('role_id, permission:permissions(code)');

    const mapped = (roles || []).map((r) => {
      const clinicPerms = (orgRolePerms || [])
        .filter((orp: any) => orp.role_id === r.id)
        .map((orp: any) => orp.permission?.code)
        .filter(Boolean);

      const defaultPerms = (defaultRolePerms || [])
        .filter((drp: any) => drp.role_id === r.id)
        .map((drp: any) => drp.permission?.code)
        .filter(Boolean);

      return {
        id: r.id,
        name: r.name,
        description: r.description,
        icon: r.icon || 'shield',
        is_custom: Boolean(r.is_custom),
        can_prescribe: Boolean(r.can_prescribe),
        organization_id: r.organization_id,
        permissions: clinicPerms.length > 0 ? clinicPerms : defaultPerms,
      };
    });

    return NextResponse.json({ success: true, roles: mapped });
  } catch (err: any) {
    console.error('[API Roles GET error]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// POST: Create or update a custom role
export async function POST(request: Request) {
  try {
    const authResult = await resolveAuthority(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, organizationId } = authResult;
    const body = await request.json();
    const { roleId, name, description, icon, permissionCodes } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Role name is required.' }, { status: 400 });
    }

    const trimmedName = name.trim();
    if (trimmedName.toLowerCase() === 'owner') {
      return NextResponse.json({ error: 'Cannot create or modify the Owner role.' }, { status: 400 });
    }

    // Sanitize permission codes
    const sanitizedCodes: PermissionCode[] = Array.isArray(permissionCodes)
      ? permissionCodes.filter((c: any): c is PermissionCode => ALL_PERMISSIONS.includes(c))
      : [];

    // Block org.manage from being assigned to operational roles
    if (sanitizedCodes.includes('org.manage')) {
      return NextResponse.json(
        { error: 'Security Policy Violation: org.manage cannot be assigned to operational roles.' },
        { status: 400 }
      );
    }

    // Custom roles cannot prescribe
    const finalCodes = sanitizedCodes.filter((c) => c !== 'visits.sign');

    // 1. Try RPC save_role_capabilities
    const { data: rpcResult, error: rpcError } = await client.rpc('save_role_capabilities', {
      p_org_id: organizationId,
      p_role_id: roleId || null,
      p_role_name: trimmedName,
      p_description: description || '',
      p_icon: icon || 'shield',
      p_is_custom: true,
      p_permission_codes: finalCodes,
    });

    if (!rpcError && rpcResult && rpcResult.success) {
      return NextResponse.json({ success: true, roleId: rpcResult.role_id });
    }

    // If RPC failed with business logic violation
    if (rpcResult && rpcResult.success === false) {
      return NextResponse.json({ error: rpcResult.error }, { status: 400 });
    }

    // 2. Direct fallback
    let targetRoleId = roleId;
    if (!targetRoleId) {
      const { data: newRole, error: insErr } = await client
        .from('roles')
        .insert({
          name: trimmedName,
          description: description || '',
          icon: icon || 'shield',
          organization_id: organizationId,
          is_custom: true,
          can_prescribe: false,
        })
        .select('id')
        .single();

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      targetRoleId = newRole.id;
    } else {
      const { error: updErr } = await client
        .from('roles')
        .update({
          name: trimmedName,
          description: description || '',
          icon: icon || 'shield',
        })
        .eq('id', targetRoleId)
        .eq('organization_id', organizationId);

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    }

    // Update organization_role_permissions
    await client
      .from('organization_role_permissions')
      .delete()
      .eq('organization_id', organizationId)
      .eq('role_id', targetRoleId);

    if (finalCodes.length > 0) {
      const { data: permRows } = await client
        .from('permissions')
        .select('id, code')
        .in('code', finalCodes);

      if (permRows && permRows.length > 0) {
        const toInsert = permRows.map((p) => ({
          organization_id: organizationId,
          role_id: targetRoleId,
          permission_id: p.id,
        }));
        await client.from('organization_role_permissions').insert(toInsert);
      }
    }

    return NextResponse.json({ success: true, roleId: targetRoleId });
  } catch (err: any) {
    console.error('[API Roles POST error]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete a custom role
export async function DELETE(request: Request) {
  try {
    const authResult = await resolveAuthority(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, organizationId } = authResult;
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('id');

    if (!roleId) {
      return NextResponse.json({ error: 'Role id parameter is required.' }, { status: 400 });
    }

    // 1. Try RPC delete_custom_role
    const { data: rpcResult, error: rpcError } = await client.rpc('delete_custom_role', {
      p_org_id: organizationId,
      p_role_id: roleId,
    });

    if (!rpcError && rpcResult && rpcResult.success) {
      return NextResponse.json({ success: true });
    }

    if (rpcResult && rpcResult.success === false) {
      return NextResponse.json({ error: rpcResult.error }, { status: 400 });
    }

    // 2. Direct fallback with dependency check
    const { data: assignedStaff } = await client
      .from('membership_roles')
      .select('membership:memberships!inner(organization_id)')
      .eq('role_id', roleId)
      .eq('membership.organization_id', organizationId);

    if (assignedStaff && assignedStaff.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete role: Currently assigned to ${assignedStaff.length} staff member(s). Reassign them first.`,
        },
        { status: 400 }
      );
    }

    const { data: pendingInvites } = await client
      .from('staff_invitations')
      .select('id')
      .eq('role_id', roleId)
      .eq('organization_id', organizationId)
      .eq('status', 'pending');

    if (pendingInvites && pendingInvites.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete role: Referenced by ${pendingInvites.length} pending invitation(s). Cancel or update them first.`,
        },
        { status: 400 }
      );
    }

    await client
      .from('organization_role_permissions')
      .delete()
      .eq('organization_id', organizationId)
      .eq('role_id', roleId);

    const { error: delErr } = await client
      .from('roles')
      .delete()
      .eq('id', roleId)
      .eq('organization_id', organizationId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API Roles DELETE error]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
