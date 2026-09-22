/**
 * Healthiva Core Permissions & Role-Based Access Control (RBAC) System
 * Source of Truth: Healthiva Staff Scoping & RBAC Blueprint
 * 
 * Strict 11-key Canonical Foundation:
 * - org.manage
 * - staff.manage
 * - patient.register
 * - queue.manage
 * - visit.read
 * - visit.write
 * - visits.sign
 * - billing.collect
 * - billing.refund
 * - pharmacy.dispense
 * - reports.read
 */

export type PermissionCode =
  | 'org.manage'
  | 'staff.manage'
  | 'patient.register'
  | 'queue.manage'
  | 'visit.read'
  | 'visit.write'
  | 'visits.sign'
  | 'billing.collect'
  | 'billing.refund'
  | 'pharmacy.dispense'
  | 'reports.read';

export const ALL_PERMISSIONS: readonly PermissionCode[] = [
  'org.manage',
  'staff.manage',
  'patient.register',
  'queue.manage',
  'visit.read',
  'visit.write',
  'visits.sign',
  'billing.collect',
  'billing.refund',
  'pharmacy.dispense',
  'reports.read',
] as const;

export interface PermissionDefinition {
  code: PermissionCode;
  title: string;
  desc: string;
  category: PermissionCategoryKey;
  highRisk?: boolean;
}

export type PermissionCategoryKey =
  | 'clinical'
  | 'pharmacy'
  | 'billing'
  | 'analytics'
  | 'administration';

export interface PermissionCategory {
  key: PermissionCategoryKey;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: 'clinical',
    title: 'Clinical & OPD Consultation',
    badge: 'Clinical Care',
    badgeColor: 'bg-sky-50 text-[#009fe3] border-sky-200',
    description: 'Patient queue, clinical consultation notes, and prescription management.',
  },
  {
    key: 'pharmacy',
    title: 'Pharmacy Desk',
    badge: 'Pharmacy Dispense',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    description: 'Dispensing verified doctor prescriptions and managing counter stock.',
  },
  {
    key: 'billing',
    title: 'Billing & Fee Collections',
    badge: 'Financial Desk',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Collecting patient fees, printing receipts, and processing refunds.',
  },
  {
    key: 'analytics',
    title: 'Clinic Analytics & Reports',
    badge: 'Sensitive Practice Data',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Revenue totals, patient turnover trends, and clinic performance stats.',
  },
  {
    key: 'administration',
    title: 'Clinic Administration',
    badge: 'High Security',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Staff member directory, role assignment, and organization settings.',
  },
];

export const MASTER_PERMISSIONS: Record<PermissionCode, PermissionDefinition> = {
  'patient.register': {
    code: 'patient.register',
    title: 'Register & Search Patients',
    desc: 'Look up patient records by 10-digit mobile number and register new patient files.',
    category: 'clinical',
  },
  'queue.manage': {
    code: 'queue.manage',
    title: 'OPD Queue & Token Assignment',
    desc: 'Assign OPD tokens (e.g. T-001) and update waiting room consultation queues.',
    category: 'clinical',
  },
  'visit.read': {
    code: 'visit.read',
    title: 'View Medical History & Past Visits',
    desc: 'Access past consultation records, vitals, diagnosis history, and medical summaries.',
    category: 'clinical',
  },
  'visit.write': {
    code: 'visit.write',
    title: 'Write OPD Consultation Notes',
    desc: 'Record patient symptoms, diagnoses, physical exam findings, and draft prescriptions.',
    category: 'clinical',
  },
  'visits.sign': {
    code: 'visits.sign',
    title: 'Sign & Lock Electronic Prescriptions',
    desc: 'Legally sign and finalize clinical prescriptions for printing or pharmacy dispensing.',
    category: 'clinical',
  },
  'pharmacy.dispense': {
    code: 'pharmacy.dispense',
    title: 'Dispense Prescriptions & Counter Stock',
    desc: 'Mark prescribed medications as dispensed and update dispensing counter records.',
    category: 'pharmacy',
  },
  'billing.collect': {
    code: 'billing.collect',
    title: 'Collect Consultation Fees & Issue Receipts',
    desc: 'Collect cash/UPI payments from patients and print thermal or A4 tax invoices.',
    category: 'billing',
  },
  'billing.refund': {
    code: 'billing.refund',
    title: 'Authorize Invoice Refunds & Cancellations',
    desc: 'Cancel receipts, issue fee refunds, and adjust financial records.',
    category: 'billing',
    highRisk: true,
  },
  'reports.read': {
    code: 'reports.read',
    title: 'View Clinic Revenue Reports & Analytics',
    desc: 'Access daily cash summaries, financial turnover, and operational analytics.',
    category: 'analytics',
    highRisk: true,
  },
  'org.manage': {
    code: 'org.manage',
    title: 'Manage Clinic Configuration & Branding',
    desc: 'Update clinic profile, logo, letterhead headers, and organization preferences.',
    category: 'administration',
    highRisk: true,
  },
  'staff.manage': {
    code: 'staff.manage',
    title: 'Manage Staff Members & Role Scopes',
    desc: 'Invite clinical staff, update branch assignments, and configure permissions.',
    category: 'administration',
    highRisk: true,
  },
};

/**
 * Standard Default Role Permissions (Per Blueprint Section 2)
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  owner: [...ALL_PERMISSIONS],
  doctor: [
    'patient.register',
    'queue.manage',
    'visit.read',
    'visit.write',
    'visits.sign',
  ],
  receptionist: [
    'patient.register',
    'queue.manage',
    'visit.read',
    'billing.collect',
  ],
  pharmacist: [
    'visit.read',
    'pharmacy.dispense',
  ],
};

/**
 * Resolves effective permissions for a staff member based on:
 * 1. Owner status (always 100% permissions)
 * 2. Individual custom override (if permission_mode === 'custom')
 * 3. Organization role overrides (if configured in organization_settings)
 * 4. Standard system role defaults
 */
export function resolveEffectivePermissions(
  roleName: string,
  permissionMode: 'template' | 'custom' = 'template',
  customPermissions?: string[] | null,
  roleOverrides?: Record<string, string[]> | null
): PermissionCode[] {
  const normalized = (roleName || 'doctor').toLowerCase();

  if (normalized === 'owner') {
    return [...ALL_PERMISSIONS];
  }

  if (permissionMode === 'custom' && Array.isArray(customPermissions)) {
    return customPermissions.filter((p): p is PermissionCode =>
      ALL_PERMISSIONS.includes(p as PermissionCode)
    );
  }

  if (roleOverrides) {
    if (Array.isArray(roleOverrides[roleName])) {
      return roleOverrides[roleName].filter((p): p is PermissionCode =>
        ALL_PERMISSIONS.includes(p as PermissionCode)
      );
    }
    if (Array.isArray(roleOverrides[normalized])) {
      return roleOverrides[normalized].filter((p): p is PermissionCode =>
        ALL_PERMISSIONS.includes(p as PermissionCode)
      );
    }
  }

  const defaults = DEFAULT_ROLE_PERMISSIONS[normalized] || [];
  return [...defaults];
}

/**
 * Helper to check if a permission is granted.
 */
export function hasPermission(
  userPermissions: string[],
  permission: PermissionCode,
  isOwner: boolean = false
): boolean {
  if (isOwner) return true;
  return userPermissions.includes(permission);
}
