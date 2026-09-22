import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  PermissionCode,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  MASTER_PERMISSIONS,
  PERMISSION_CATEGORIES,
} from '@/lib/permissions';

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

// Verify caller is Owner or Administrator
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
      error: 'Access denied: Only clinic Owners and Administrators can customize role capabilities.',
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

// Default fallback roles ensuring UI is never blank
const DEFAULT_ROLES = [
  {
    roleId: '22222222-2222-2222-2222-222222222222',
    roleName: 'Doctor',
    description: 'Consulting doctor: queue view, patient history, notes, sign prescriptions',
    permissions: [...DEFAULT_ROLE_PERMISSIONS.doctor],
    icon: 'stethoscope',
    isCustom: false,
    canPrescribe: true,
  },
  {
    roleId: '33333333-3333-3333-3333-333333333333',
    roleName: 'Receptionist',
    description: 'Front desk staff: patient registration, token generation, consultation billing',
    permissions: [...DEFAULT_ROLE_PERMISSIONS.receptionist],
    icon: 'user-check',
    isCustom: false,
    canPrescribe: false,
  },
  {
    roleId: '44444444-4444-4444-4444-444444444444',
    roleName: 'Pharmacist',
    description: 'In-house pharmacy staff: view signed prescriptions, record dispensed items',
    permissions: [...DEFAULT_ROLE_PERMISSIONS.pharmacist],
    icon: 'pill',
    isCustom: false,
    canPrescribe: false,
  },
];

// GET: Fetch system & custom roles and their effective permissions
export async function GET(request: Request) {
  try {
    const authResult = await resolveAuthority(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, organizationId } = authResult;

    // 1. Fetch all roles applicable to this organization (System roles + Custom roles)
    const { data: roles, error: rolesError } = await client
      .from('roles')
      .select('id, name, description, icon, is_custom, can_prescribe, organization_id')
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      .neq('name', 'Owner')
      .order('is_custom', { ascending: true })
      .order('name', { ascending: true });

    // 2. Fetch all canonical permissions
    const { data: allPermissions } = await client
      .from('permissions')
      .select('id, code, description');

    // 3. Fetch organization_role_permissions (Replacement Model Single Source of Truth)
    const { data: orgRolePerms } = await client
      .from('organization_role_permissions')
      .select('role_id, permission:permissions(code)')
      .eq('organization_id', organizationId);

    // 4. Fetch factory default role_permissions
    const { data: defaultRolePerms } = await client
      .from('role_permissions')
      .select('role_id, permission:permissions(code)');

    // 5. Fetch organization_settings workflow_json for legacy fallback
    const { data: orgSettings } = await client
      .from('organization_settings')
      .select('workflow_json')
      .eq('organization_id', organizationId)
      .maybeSingle();

    const legacyOverrides = (orgSettings?.workflow_json as any)?.role_overrides || {};

    // 6. Assemble role list
    let roleMappings = (roles && roles.length > 0)
      ? roles.map((role: any) => {
          // Check if clinic customized this role in organization_role_permissions
          const clinicPermRows = (orgRolePerms || []).filter((orp: any) => orp.role_id === role.id);
          let activeCodes: string[] = [];

          if (clinicPermRows.length > 0) {
            // Clinic has configured overrides in table
            activeCodes = clinicPermRows.map((orp: any) => orp.permission?.code).filter(Boolean);
          } else {
            // Check legacy JSON overrides
            const legacyCodes = legacyOverrides[role.name] || legacyOverrides[role.name.toLowerCase()];
            if (Array.isArray(legacyCodes)) {
              activeCodes = legacyCodes;
            } else {
              // Fallback to factory defaults
              const defRows = (defaultRolePerms || []).filter((drp: any) => drp.role_id === role.id);
              if (defRows.length > 0) {
                activeCodes = defRows.map((drp: any) => drp.permission?.code).filter(Boolean);
              } else {
                const defFallback = DEFAULT_ROLES.find(r => r.roleName.toLowerCase() === role.name.toLowerCase());
                activeCodes = defFallback ? [...defFallback.permissions] : [];
              }
            }
          }

          return {
            roleId: role.id,
            roleName: role.name,
            description: role.description,
            icon: role.icon || 'shield',
            isCustom: Boolean(role.is_custom),
            canPrescribe: Boolean(role.can_prescribe),
            organizationId: role.organization_id,
            permissions: activeCodes,
          };
        })
      : DEFAULT_ROLES;

    return NextResponse.json(
      {
        success: true,
        roles: roleMappings,
        allPermissions: allPermissions || [],
        masterPermissions: MASTER_PERMISSIONS,
        categories: PERMISSION_CATEGORIES,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        },
      }
    );
  } catch (err: any) {
    console.error('[API Roles Permissions GET error]:', err);
    return NextResponse.json(
      {
        success: true,
        roles: DEFAULT_ROLES,
        allPermissions: [],
        masterPermissions: MASTER_PERMISSIONS,
        categories: PERMISSION_CATEGORIES,
        warning: 'Serving default role templates due to database connection.',
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        },
      }
    );
  }
}

// POST: Update permission codes for a role
export async function POST(request: Request) {
  try {
    const authResult = await resolveAuthority(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status || 400 });
    }

    const { client, organizationId } = authResult;
    const body = await request.json();
    const { roleId, roleName, permissionCodes } = body;

    if ((!roleId && !roleName) || !Array.isArray(permissionCodes)) {
      return NextResponse.json({ error: 'Role identifier and permissionCodes array are required.' }, { status: 400 });
    }

    // Sanitize incoming permission codes to canonical 11 keys
    let sanitizedCodes: PermissionCode[] = permissionCodes.filter((c: any): c is PermissionCode =>
      ALL_PERMISSIONS.includes(c)
    );

    // SECURITY: org.manage cannot be assigned to operational roles
    if (sanitizedCodes.includes('org.manage')) {
      return NextResponse.json(
        { error: 'Security Policy Violation: org.manage cannot be delegated to operational roles.' },
        { status: 400 }
      );
    }

    // 1. Resolve role record
    let targetRoleId = roleId;
    let targetRoleRow: any = null;

    if (targetRoleId) {
      const { data: rRow } = await client
        .from('roles')
        .select('id, name, is_custom, can_prescribe, organization_id')
        .eq('id', targetRoleId)
        .maybeSingle();
      targetRoleRow = rRow;
    } else if (roleName) {
      const { data: rRow } = await client
        .from('roles')
        .select('id, name, is_custom, can_prescribe, organization_id')
        .ilike('name', roleName.trim())
        .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
        .maybeSingle();
      targetRoleRow = rRow;
      if (targetRoleRow) targetRoleId = targetRoleRow.id;
    }

    if (!targetRoleRow) {
      return NextResponse.json({ error: 'Role not found.' }, { status: 404 });
    }

    // Cross-tenant verification: If role has organization_id, it MUST match caller org
    if (targetRoleRow.organization_id && targetRoleRow.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Cross-tenant security violation: Target role belongs to another clinic organization.' },
        { status: 403 }
      );
    }

    // Medical Prescriber Rule: Only certified prescribers can hold visits.sign
    if (!targetRoleRow.can_prescribe && sanitizedCodes.includes('visits.sign')) {
      sanitizedCodes = sanitizedCodes.filter(c => c !== 'visits.sign');
    }

    const effectiveRoleName = targetRoleRow.name;

    // 2. Try atomic RPC save_role_capabilities first
    try {
      const { data: rpcRes, error: rpcErr } = await client.rpc('save_role_capabilities', {
        p_org_id: organizationId,
        p_role_id: targetRoleId,
        p_role_name: effectiveRoleName,
        p_description: null,
        p_icon: null,
        p_is_custom: Boolean(targetRoleRow.is_custom),
        p_permission_codes: sanitizedCodes,
      });

      if (!rpcErr && rpcRes && rpcRes.success) {
        // Also sync legacy organization_settings for zero-risk backward compatibility
        syncLegacyRoleOverrides(client, organizationId, effectiveRoleName, sanitizedCodes).catch(() => {});
        return NextResponse.json({
          success: true,
          message: `Capabilities updated for ${effectiveRoleName} role in your clinic!`,
        });
      }
    } catch (rpcCatchErr) {
      console.warn('[Note: save_role_capabilities RPC fallback]:', rpcCatchErr);
    }

    // 3. Direct Relational Upsert: Replacement Model on organization_role_permissions
    // Delete existing clinic overrides for this role
    await client
      .from('organization_role_permissions')
      .delete()
      .eq('organization_id', organizationId)
      .eq('role_id', targetRoleId);

    // Insert new sanitized codes
    if (sanitizedCodes.length > 0) {
      const { data: perms } = await client
        .from('permissions')
        .select('id, code')
        .in('code', sanitizedCodes);

      if (perms && perms.length > 0) {
        const inserts = perms.map((p: any) => ({
          organization_id: organizationId,
          role_id: targetRoleId,
          permission_id: p.id,
        }));
        await client.from('organization_role_permissions').insert(inserts);
      }
    }

    // Sync legacy organization_settings
    await syncLegacyRoleOverrides(client, organizationId, effectiveRoleName, sanitizedCodes);

    return NextResponse.json({
      success: true,
      message: `Capabilities updated for ${effectiveRoleName} role in your clinic!`,
    });
  } catch (err: any) {
    console.error('[API Roles Permissions POST error]:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update role permissions.' }, { status: 500 });
  }
}

// Helper to keep organization_settings.workflow_json in sync
async function syncLegacyRoleOverrides(
  client: SupabaseClient,
  organizationId: string,
  roleName: string,
  sanitizedCodes: string[]
) {
  try {
    const { data: currentSettings } = await client
      .from('organization_settings')
      .select('workflow_json')
      .eq('organization_id', organizationId)
      .maybeSingle();

    const currentWorkflow = (currentSettings?.workflow_json as any) || {};
    const currentOverrides = currentWorkflow.role_overrides || {};

    const updatedWorkflow = {
      ...currentWorkflow,
      role_overrides: {
        ...currentOverrides,
        [roleName]: sanitizedCodes,
        [roleName.toLowerCase()]: sanitizedCodes,
      },
    };

    if (currentSettings) {
      await client
        .from('organization_settings')
        .update({
          workflow_json: updatedWorkflow,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId);
    }
  } catch (err) {
    console.warn('[syncLegacyRoleOverrides non-critical error]:', err);
  }
}
