'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SettingsLayout } from '../../../components/settings-layout';
import { useBranch, Branch } from '../../../context/branch-context';
import { StaffTableSkeleton } from '../../../components/staff-table-skeleton';
import { getCurrentUser, getSupabaseClient } from '@healthiva/supabase';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  BuildingIcon,
  CrownIcon,
  StethoscopeIcon,
  MonitorIcon,
  PillIcon,
  XIcon,
  PlusIcon,
  SearchIcon,
  PencilIcon,
  PhoneIcon,
  MailIcon,
  LockIcon,
  ClockIcon,
  UserCheckIcon,
  ShieldCheckIcon,
} from '../../../components/icons';
import {
  PermissionCode,
  ALL_PERMISSIONS,
  MASTER_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CATEGORIES,
} from '@/lib/permissions';

interface StaffMember {
  membershipId?: string;
  userId?: string;
  invitationId?: string;
  inviteToken?: string;
  fullName: string;
  email: string;
  mobile: string;
  roleName: string;
  roleId?: string;
  status: string; // 'active' | 'suspended' | 'pending'
  permissionMode: 'template' | 'custom';
  customPermissions?: string[] | null;
  defaultClinicId?: string | null;
  specialty?: string | null;
  assignedBranches: Branch[];
  createdAt: string;
  expiresAt?: string;
  isExpired?: boolean;
  daysRemaining?: number;
  isInvitation?: boolean;
  isOwner?: boolean;
  isPrimaryOwner?: boolean;
  orgAuthority?: 'primary_owner' | 'administrator' | 'none';
  doctorRegNo?: string;
  isCustomRole?: boolean;
  canPrescribe?: boolean;
}

const CAPABILITY_TIERS = PERMISSION_CATEGORIES.map((cat) => ({
  tierKey: cat.key,
  tierName: cat.title,
  badge: cat.badge,
  badgeColor: cat.badgeColor,
  description: cat.description,
  warning:
    cat.key === 'analytics' || cat.key === 'administration'
      ? 'Warning: Grants access to confidential practice turnover or administrative control.'
      : undefined,
  capabilities: ALL_PERMISSIONS
    .map((code) => MASTER_PERMISSIONS[code])
    .filter((p) => p.category === cat.key),
}));

export interface AvailableRole {
  id: string;
  name: string;
  description?: string;
  is_custom?: boolean;
}

export default function StaffSettingsPage() {
  const { branches, organizationName, isPrimaryOwner, refreshBranches } = useBranch();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic Clinic Roles (fetched from /api/roles)
  const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>([
    { id: 'doctor', name: 'Doctor', description: 'OPD & Prescriptions' },
    { id: 'receptionist', name: 'Receptionist', description: 'Patient Queue & Billing' },
    { id: 'pharmacist', name: 'Pharmacist', description: 'Dispensing & Inventory' },
  ]);

  // Dynamic Clinic Role Templates (synced live from /api/roles/permissions and /api/staff)
  const [roleTemplates, setRoleTemplates] = useState<Record<string, string[]>>({});

  const getRoleTemplate = useCallback(
    (role: string): string[] => {
      if (!role) return [];
      const normalized = role.toLowerCase();
      const capitalized = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

      // Check live dynamic templates from clinic settings first
      if (Array.isArray(roleTemplates[role])) return roleTemplates[role];
      if (Array.isArray(roleTemplates[capitalized])) return roleTemplates[capitalized];
      if (Array.isArray(roleTemplates[normalized])) return roleTemplates[normalized];

      // Fallback only if dynamic templates have not yet returned from API
      return (DEFAULT_ROLE_PERMISSIONS[normalized] as string[]) || [];
    },
    [roleTemplates]
  );

  // Directory Tabs: 'active' (Active Staff Members) vs 'pending' (Pending Invitations)
  const [activeDirectoryTab, setActiveDirectoryTab] = useState<'active' | 'pending'>('active');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');

  // Modals & UI states
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editActiveModalOpen, setEditActiveModalOpen] = useState(false);
  const [editInviteModalOpen, setEditInviteModalOpen] = useState(false);
  const [revokeConfirmModalOpen, setRevokeConfirmModalOpen] = useState(false);
  const [removeConfirmModalOpen, setRemoveConfirmModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  // Primary Ownership Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTargetStaff, setTransferTargetStaff] = useState<StaffMember | null>(null);
  const [transferPassword, setTransferPassword] = useState('');
  const [transferConfirmChecked, setTransferConfirmChecked] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  // General Toast / Feedback
  const [submitting, setSubmitting] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // State for Sharing Invite Link
  const [generatedInviteLink, setGeneratedInviteLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [invitedStaffData, setInvitedStaffData] = useState<{
    name: string;
    mobile: string;
    email: string;
    role: string;
  } | null>(null);
  const [emailSentNotice, setEmailSentNotice] = useState(false);
  const [whatsAppNotice, setWhatsAppNotice] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Fields for NEW Invite
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [roleName, setRoleName] = useState<string>('Doctor');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [specialty, setSpecialty] = useState('');
  const [permissionMode, setPermissionMode] = useState<'template' | 'custom'>('template');
  const [selectedCustomPerms, setSelectedCustomPerms] = useState<string[]>([]);
  const [newOrgAuthority, setNewOrgAuthority] = useState<'none' | 'administrator'>('none');

  // State for EDIT ACTIVE STAFF MEMBER
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editRoleName, setEditRoleName] = useState<string>('Doctor');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editDefaultClinicId, setEditDefaultClinicId] = useState<string>('');
  const [editSelectedBranchIds, setEditSelectedBranchIds] = useState<string[]>([]);
  const [editPermissionMode, setEditPermissionMode] = useState<'template' | 'custom'>('template');
  const [editSelectedCustomPerms, setEditSelectedCustomPerms] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editOrgAuthority, setEditOrgAuthority] = useState<'none' | 'administrator'>('none');

  // State for EDIT PENDING INVITATION
  const [editingInvite, setEditingInvite] = useState<StaffMember | null>(null);
  const [inviteEditFullName, setInviteEditFullName] = useState('');
  const [inviteEditEmail, setInviteEditEmail] = useState('');
  const [inviteEditMobile, setInviteEditMobile] = useState('');
  const [inviteEditRoleName, setInviteEditRoleName] = useState<string>('Doctor');
  const [inviteEditSpecialty, setInviteEditSpecialty] = useState('');
  const [inviteEditBranchIds, setInviteEditBranchIds] = useState<string[]>([]);

  // State for Destructive Confirmation Dialogs
  const [targetInviteToRevoke, setTargetInviteToRevoke] = useState<StaffMember | null>(null);
  const [targetMemberToRemove, setTargetMemberToRemove] = useState<StaffMember | null>(null);

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) return;

      const timestamp = Date.now();
      const res = await fetch(`/api/staff?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-store, no-cache',
        },
      });
      const data = await res.json();

      let dynamicTemplates: Record<string, string[]> = {};
      if (data.roleTemplates && typeof data.roleTemplates === 'object') {
        dynamicTemplates = { ...data.roleTemplates };
      }

      if (data.success && Array.isArray(data.staff)) {
        setStaffList(data.staff);
      }

      // Direct synchronization with /api/roles and /api/roles/permissions
      try {
        const [rolesRes, listRes] = await Promise.all([
          fetch(`/api/roles/permissions?t=${timestamp}`, {
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${token}`,
              'Cache-Control': 'no-store, no-cache',
            },
          }),
          fetch(`/api/roles?t=${timestamp}`, {
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${token}`,
              'Cache-Control': 'no-store, no-cache',
            },
          }),
        ]);

        const rolesData = await rolesRes.json();
        if (rolesData.success && Array.isArray(rolesData.roles)) {
          rolesData.roles.forEach((r: any) => {
            if (r.roleName && Array.isArray(r.permissions)) {
              dynamicTemplates[r.roleName] = r.permissions;
            }
          });
        }

        const listData = await listRes.json();
        if (listData.success && Array.isArray(listData.roles) && listData.roles.length > 0) {
          setAvailableRoles(listData.roles);
        }
      } catch (rolesErr) {
        console.warn('[Note: role templates load bypass]:', rolesErr);
      }

      if (Object.keys(dynamicTemplates).length > 0) {
        const dualCased: Record<string, string[]> = { ...dynamicTemplates };
        Object.entries(dynamicTemplates).forEach(([k, v]) => {
          dualCased[k.toLowerCase()] = v;
          dualCased[k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()] = v;
        });
        setRoleTemplates(dualCased);
      }
    } catch (err) {
      console.error('[Load Staff Error]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const u = await getCurrentUser();
      setUser(u);
      await loadStaff();
    }
    init();

    // Auto-refresh only when roles are saved in another tab (NOT on window focus to prevent flickering)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'healthiva_roles_updated') {
        loadStaff();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadStaff]);

  // ==================== NEW INVITATION HANDLERS ====================
  const openInviteModal = () => {
    setFullName('');
    setEmail('');
    setMobile('');
    setRoleName('Doctor');
    setSelectedBranchIds(branches.map((b) => b.id)); // Default: select all branches
    setSpecialty('');
    setPermissionMode('template');
    setSelectedCustomPerms([...getRoleTemplate('Doctor')]);
    setErrorMessage(null);
    setModalErrorMessage(null);
    setInviteModalOpen(true);
  };

  const handleRoleChange = (newRole: string) => {
    setRoleName(newRole);
    if (permissionMode === 'custom') {
      setSelectedCustomPerms([...getRoleTemplate(newRole)]);
    }
  };

  const toggleBranchSelection = (branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  };

  const handleSelectAllBranches = () => {
    if (selectedBranchIds.length === branches.length) {
      setSelectedBranchIds([]);
    } else {
      setSelectedBranchIds(branches.map((b) => b.id));
    }
  };

  const toggleCustomPermission = (code: string) => {
    setSelectedCustomPerms((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !mobile.trim()) {
      setModalErrorMessage('Please enter the staff member’s full name, email address, and mobile number.');
      return;
    }
    const cleanPhone = mobile.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setModalErrorMessage('Please enter a valid 10-digit mobile number (e.g. 9876543210).');
      return;
    }
    if (selectedBranchIds.length === 0) {
      setModalErrorMessage('Please select at least one branch for this staff member.');
      return;
    }

    try {
      setSubmitting(true);
      setModalErrorMessage(null);
      setErrorMessage(null);

      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          mobile: cleanPhone,
          roleName,
          branchIds: selectedBranchIds,
          orgAuthority: newOrgAuthority,
          specialty: roleName === 'Doctor' ? specialty.trim() : undefined,
          permissionMode,
          customPermissions: permissionMode === 'custom' ? selectedCustomPerms : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to invite staff member.');
      }

      setSuccessMessage(data.message || 'Staff member invitation generated successfully!');
      setInviteModalOpen(false);
      setModalErrorMessage(null);

      if (data.inviteLink) {
        setGeneratedInviteLink(data.inviteLink);
        setCopiedLink(false);
        setInvitedStaffData({
          name: fullName.trim(),
          mobile: cleanPhone,
          email: email.trim(),
          role: roleName,
        });
        setEmailSentNotice(Boolean(data.emailSent));
        if (data.emailSent) {
          setEmailStatus({
            type: 'success',
            message: `Invitation email was automatically delivered to ${email.trim()} via Resend!`,
          });
        } else if (data.emailError) {
          setEmailStatus({
            type: 'error',
            message: data.emailError,
          });
        } else {
          setEmailStatus(null);
        }
        setWhatsAppNotice(null);
        setActiveDirectoryTab('pending');
        setLinkModalOpen(true);
      }

      await loadStaff();
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : 'Error sending invitation. Please try again.';
      if (msg.includes('duplicate key') || msg.includes('violates unique constraint')) {
        msg = 'An active account or invitation already exists for this email or mobile number.';
      }
      setModalErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== EDIT ACTIVE STAFF HANDLERS ====================
  const openEditActiveModal = (staff: StaffMember) => {
    setEditingStaff(staff);
    setEditFullName(staff.fullName || '');
    setEditEmail(staff.email || '');
    setEditMobile(staff.mobile || '');
    const isOwnerRole = staff.roleName?.toLowerCase() === 'owner' || Boolean(staff.isOwner);
    const validRole = (['Doctor', 'Receptionist', 'Pharmacist'].includes(staff.roleName)
      ? staff.roleName
      : (isOwnerRole ? 'Owner' : 'Doctor')) as any;
    setEditRoleName(validRole);
    setEditSpecialty(staff.specialty || '');
    setEditDefaultClinicId(staff.defaultClinicId || (staff.assignedBranches[0]?.id ?? ''));
    setEditSelectedBranchIds(staff.assignedBranches.map((b) => b.id));
    setEditPermissionMode(staff.permissionMode || 'template');
    setEditSelectedCustomPerms(
      staff.customPermissions && staff.customPermissions.length > 0
        ? [...staff.customPermissions]
        : [...getRoleTemplate(validRole)]
    );
    setEditStatus(staff.status === 'suspended' ? 'suspended' : 'active');
    setEditOrgAuthority(staff.orgAuthority === 'administrator' ? 'administrator' : 'none');
    setModalErrorMessage(null);
    setEditActiveModalOpen(true);
  };

  const toggleEditBranchSelection = (branchId: string) => {
    setEditSelectedBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  };

  const handleSelectAllEditBranches = () => {
    if (editSelectedBranchIds.length === branches.length) {
      setEditSelectedBranchIds([]);
    } else {
      setEditSelectedBranchIds(branches.map((b) => b.id));
    }
  };

  const toggleEditCustomPermission = (code: string) => {
    setEditSelectedCustomPerms((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSaveActiveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff?.membershipId) return;

    if (!editFullName.trim() || !editEmail.trim() || !editMobile.trim()) {
      setModalErrorMessage('Please enter full name, email address, and mobile number.');
      return;
    }
    const cleanPhone = editMobile.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setModalErrorMessage('Mobile number must be exactly 10 digits.');
      return;
    }
    if (editSelectedBranchIds.length === 0) {
      setModalErrorMessage('Please assign at least one clinic branch.');
      return;
    }

    try {
      setSubmitting(true);
      setModalErrorMessage(null);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const isOwnerAccount = editingStaff.roleName?.toLowerCase() === 'owner' || Boolean(editingStaff.isOwner);

      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: 'member',
          membershipId: editingStaff.membershipId,
          fullName: editFullName.trim(),
          email: editEmail.trim(),
          mobile: cleanPhone,
          roleName: isOwnerAccount ? 'Owner' : editRoleName,
          ...(isPrimaryOwner ? { orgAuthority: isOwnerAccount ? 'primary_owner' : editOrgAuthority } : {}),
          specialty: editRoleName === 'Doctor' ? editSpecialty.trim() : null,
          branchIds: editSelectedBranchIds,
          defaultClinicId: editDefaultClinicId || editSelectedBranchIds[0],
          status: editStatus,
          permissionMode: editPermissionMode,
          customPermissions: editPermissionMode === 'custom' ? editSelectedCustomPerms : null,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update staff member.');
      }

      setSuccessMessage(`Profile & access successfully updated for ${editFullName.trim()}.`);
      setEditActiveModalOpen(false);
      await loadStaff();
    } catch (err: unknown) {
      setModalErrorMessage(err instanceof Error ? err.message : 'Error updating staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== EDIT PENDING INVITATION HANDLERS ====================
  const openEditInviteModal = (invite: StaffMember) => {
    setEditingInvite(invite);
    setInviteEditFullName(invite.fullName || '');
    setInviteEditEmail(invite.email || '');
    setInviteEditMobile(invite.mobile || '');
    const validRole = invite.roleName || 'Doctor';
    setInviteEditRoleName(validRole);
    setInviteEditSpecialty(invite.specialty || '');
    setInviteEditBranchIds(invite.assignedBranches.map((b) => b.id));
    setModalErrorMessage(null);
    setEditInviteModalOpen(true);
  };

  const toggleInviteEditBranchSelection = (branchId: string) => {
    setInviteEditBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  };

  const handleSelectAllInviteEditBranches = () => {
    if (inviteEditBranchIds.length === branches.length) {
      setInviteEditBranchIds([]);
    } else {
      setInviteEditBranchIds(branches.map((b) => b.id));
    }
  };

  const handleSavePendingInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvite?.invitationId) return;

    if (!inviteEditFullName.trim() || !inviteEditEmail.trim() || !inviteEditMobile.trim()) {
      setModalErrorMessage('Please enter candidate name, email, and mobile number.');
      return;
    }
    const cleanPhone = inviteEditMobile.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setModalErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (inviteEditBranchIds.length === 0) {
      setModalErrorMessage('Please assign at least one branch for this invitation.');
      return;
    }

    try {
      setSubmitting(true);
      setModalErrorMessage(null);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: 'invitation',
          invitationId: editingInvite.invitationId,
          fullName: inviteEditFullName.trim(),
          email: inviteEditEmail.trim(),
          mobile: cleanPhone,
          roleName: inviteEditRoleName,
          specialty: inviteEditRoleName === 'Doctor' ? inviteEditSpecialty.trim() : null,
          branchIds: inviteEditBranchIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update invitation details.');
      }

      setSuccessMessage(`Invitation details updated for ${inviteEditFullName.trim()}.`);
      setEditInviteModalOpen(false);
      await loadStaff();
    } catch (err: unknown) {
      setModalErrorMessage(err instanceof Error ? err.message : 'Error updating invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== QUICK SAAS ACTIONS ====================
  // 1-Click Renew Expired Invitation (7-day extension)
  const handleRenewInvite = async (invite: StaffMember) => {
    if (!invite.invitationId) return;
    try {
      setActionInProgress(invite.invitationId);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: 'invitation',
          invitationId: invite.invitationId,
          renewExpiry: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to renew invitation.');
      }

      setSuccessMessage(`Invitation for ${invite.fullName} extended by 7 days!`);
      await loadStaff();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to renew invitation.');
    } finally {
      setActionInProgress(null);
    }
  };

  // Revoke / Cancel Pending Invitation
  const handleConfirmRevokeInvite = async () => {
    if (!targetInviteToRevoke?.invitationId) return;
    try {
      setSubmitting(true);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/staff?invitationId=${targetInviteToRevoke.invitationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to revoke invitation.');
      }

      setSuccessMessage(`Invitation for ${targetInviteToRevoke.fullName} has been revoked.`);
      setRevokeConfirmModalOpen(false);
      setTargetInviteToRevoke(null);
      await loadStaff();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to revoke invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Suspend / Reactivate Active Staff
  const handleToggleStaffStatus = async (staff: StaffMember) => {
    if (!staff.membershipId || staff.isPrimaryOwner || staff.orgAuthority === 'primary_owner' || staff.roleName?.toLowerCase() === 'owner') return;
    const newStatus = staff.status === 'active' ? 'suspended' : 'active';
    try {
      setActionInProgress(staff.membershipId);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: 'member',
          membershipId: staff.membershipId,
          status: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to change staff status.');
      }

      setSuccessMessage(
        newStatus === 'suspended'
          ? `${staff.fullName} has been suspended from clinic access.`
          : `${staff.fullName} has been reactivated.`
      );
      await loadStaff();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to toggle status.');
    } finally {
      setActionInProgress(null);
    }
  };

  // Dispatch Password Reset Email
  const handleSendPasswordReset = async (staff: StaffMember) => {
    if (!staff.email) {
      setErrorMessage(`No registered email address found for ${staff.fullName}.`);
      return;
    }
    try {
      setActionInProgress(staff.membershipId || staff.email);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/staff/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: staff.email,
          name: staff.fullName,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to send password reset email.');
      }

      setSuccessMessage(`Password reset link sent to ${staff.email}!`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send password reset email.');
    } finally {
      setActionInProgress(null);
    }
  };

  // Remove Staff Member from Clinic
  const handleConfirmRemoveStaff = async () => {
    if (!targetMemberToRemove?.membershipId) return;
    try {
      setSubmitting(true);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/staff?membershipId=${targetMemberToRemove.membershipId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to remove staff member.');
      }

      setSuccessMessage(`${targetMemberToRemove.fullName} has been removed from the clinic.`);
      setRemoveConfirmModalOpen(false);
      setTargetMemberToRemove(null);
      if (editActiveModalOpen) setEditActiveModalOpen(false);
      await loadStaff();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to remove staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== TRANSFER OWNERSHIP HANDLERS ====================
  const openTransferOwnershipModal = (staff: StaffMember) => {
    setTransferTargetStaff(staff);
    setTransferPassword('');
    setTransferConfirmChecked(false);
    setTransferError(null);
    setTransferModalOpen(true);
  };

  const handleExecuteTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTargetStaff?.userId) {
      setTransferError('No user ID found for this Co-Owner.');
      return;
    }
    if (!transferPassword.trim()) {
      setTransferError('Please enter your primary owner password to authorize transfer.');
      return;
    }
    if (!transferConfirmChecked) {
      setTransferError('Please confirm the acknowledgment checkbox to authorize ownership transfer.');
      return;
    }

    try {
      setTransferring(true);
      setTransferError(null);
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/staff/transfer-ownership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUserId: transferTargetStaff.userId,
          password: transferPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to transfer ownership.');
      }

      setSuccessMessage(data.message || `Primary clinic ownership successfully transferred to ${transferTargetStaff.fullName}!`);
      setTransferModalOpen(false);
      setTransferTargetStaff(null);
      await loadStaff();
      if (refreshBranches) {
        await refreshBranches();
      }
    } catch (err: unknown) {
      setTransferError(err instanceof Error ? err.message : 'Error transferring ownership.');
    } finally {
      setTransferring(false);
    }
  };

  // Share Modal & Links
  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const openShareModal = (staff: StaffMember) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/invite/accept?token=${staff.inviteToken}`;
    setGeneratedInviteLink(link);
    setCopiedLink(false);
    setInvitedStaffData({
      name: staff.fullName,
      mobile: staff.mobile,
      email: staff.email,
      role: staff.roleName,
    });
    setEmailSentNotice(false);
    setEmailStatus(null);
    setWhatsAppNotice(null);
    setLinkModalOpen(true);
  };

  const handleShareWhatsApp = () => {
    const phone = invitedStaffData?.mobile?.replace(/\D/g, '') || '';
    const name = invitedStaffData?.name || 'there';
    const role = invitedStaffData?.role || 'team member';
    const clinic = organizationName || 'our clinic';
    const text = `Hello ${name}! You have been invited to join the clinic team at ${clinic} as a ${role} on Healthiva.\n\nPlease click this link to set your password and access your account:\n${generatedInviteLink}`;

    setWhatsAppNotice(`Opening WhatsApp chat with ${name} (${phone ? `+91 ${phone}` : 'staff'}). Direct automated background WhatsApp bot delivery is coming soon!`);

    const waUrl = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    if (typeof window !== 'undefined') {
      window.open(waUrl, '_blank');
    }
  };

  const handleShareEmail = async () => {
    if (!invitedStaffData?.email) {
      setEmailStatus({ type: 'error', message: 'No email address available for this staff member.' });
      return;
    }
    if (!generatedInviteLink) {
      setEmailStatus({ type: 'error', message: 'Invitation link is not ready.' });
      return;
    }

    try {
      setSendingEmail(true);
      setEmailStatus(null);

      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/staff/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: invitedStaffData.email,
          name: invitedStaffData.name,
          role: invitedStaffData.role,
          inviteLink: generatedInviteLink,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to dispatch email via Resend.');
      }

      setEmailSentNotice(true);
      setEmailStatus({
        type: 'success',
        message: `Invitation email sent directly to ${invitedStaffData.email} via Resend!`,
      });
    } catch (err: unknown) {
      setEmailStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send email. Please check the email address or try again.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Partition staff list into Active Members vs Pending Invitations
  const allActiveStaff = staffList.filter((s) => !s.isInvitation && s.status !== 'pending');
  const allPendingStaff = staffList.filter((s) => s.isInvitation || s.status === 'pending');

  const filterStaff = (staff: StaffMember) => {
    const matchesSearch =
      (staff.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (staff.mobile || '').includes(searchQuery) ||
      (staff.email || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      roleFilter === 'All'
        ? true
        : roleFilter.toLowerCase() === 'owner'
        ? Boolean(
            staff.isOwner ||
            staff.isPrimaryOwner ||
            staff.orgAuthority === 'administrator' ||
            staff.orgAuthority === 'primary_owner' ||
            staff.roleName?.toLowerCase() === 'owner'
          )
        : (staff.roleName || '').toLowerCase() === roleFilter.toLowerCase();

    const matchesBranch =
      branchFilter === 'All' ||
      staff.assignedBranches.some((b) => b.id === branchFilter || b.name === branchFilter);

    return matchesSearch && matchesRole && matchesBranch;
  };

  const filteredActiveStaff = allActiveStaff.filter(filterStaff);
  const filteredPendingStaff = allPendingStaff.filter(filterStaff);
  const displayedStaff = activeDirectoryTab === 'active' ? filteredActiveStaff : filteredPendingStaff;
  const isPendingView = activeDirectoryTab === 'pending';

  return (
    <SettingsLayout
      user={user}
      activeTab="staff"
      title="Staff Directory & Branch Scoping"
      description="Invite doctors, receptionists, and pharmacists. Assign hospital branches and manage role capabilities."
      action={
        <button
          onClick={openInviteModal}
          className="inline-flex items-center justify-center gap-2 bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer shadow-sm shrink-0"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Invite Staff Member</span>
        </button>
      }
    >
      {/* Toast Alerts */}
      {successMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangleIcon className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 text-xs font-bold cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Directory Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        <div className="inline-flex p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveDirectoryTab('active')}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeDirectoryTab === 'active'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <UserCheckIcon className={`w-4 h-4 ${activeDirectoryTab === 'active' ? 'text-[#009fe3]' : 'text-slate-400'}`} />
            <span>Active Staff Members</span>
            <span
              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                activeDirectoryTab === 'active'
                  ? 'bg-sky-50 text-[#009fe3] border border-sky-100'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {allActiveStaff.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDirectoryTab('pending')}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeDirectoryTab === 'pending'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <ClockIcon className={`w-4 h-4 ${activeDirectoryTab === 'pending' ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>Pending Invitations</span>
            <span
              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                activeDirectoryTab === 'pending'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : allPendingStaff.length > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-200/80 text-slate-600'
              }`}
            >
              {allPendingStaff.length}
            </span>
          </button>
        </div>

        {/* Informational Scope Hint */}
        <div className="text-xs text-slate-500 font-medium px-1 flex items-center gap-1.5">
          {activeDirectoryTab === 'active' ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Verified clinic staff members with active branch access</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span>Unaccepted invitations awaiting candidate registration</span>
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 mb-6 shadow-2xs flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              isPendingView
                ? "Search pending invitations by name, mobile, or email..."
                : "Search active staff by name, mobile, or email..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#009fe3] focus:ring-2 focus:ring-[#009fe3]/20"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#009fe3]"
            >
              <option value="All">All Roles</option>
              <option value="Owner">Owner / Co-Owner</option>
              {availableRoles.map((r) => (
                <option key={r.id || r.name} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Branch:</span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#009fe3]"
            >
              <option value="All">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Staff Directory Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <StaffTableSkeleton rows={4} />
        ) : displayedStaff.length === 0 ? (
          activeDirectoryTab === 'active' ? (
            allActiveStaff.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#009fe3] flex items-center justify-center mx-auto mb-3">
                  <UserCheckIcon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">No Active Staff Members Yet</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5">
                  {allPendingStaff.length > 0
                    ? `You have ${allPendingStaff.length} pending staff invitation(s) awaiting acceptance. Once they accept their invitation link, they will appear here as active staff.`
                    : 'Invite your consulting doctors, receptionists, and pharmacists to start assigning branch scopes and managing patient queues.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {allPendingStaff.length > 0 && (
                    <button
                      onClick={() => setActiveDirectoryTab('pending')}
                      className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm"
                    >
                      <ClockIcon className="w-4 h-4" />
                      <span>View Pending Invitations ({allPendingStaff.length})</span>
                    </button>
                  )}
                  <button
                    onClick={openInviteModal}
                    className="inline-flex items-center gap-2 bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>Invite Staff Member</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <SearchIcon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">No Active Staff Match Your Filters</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-5">
                  No active members match your search keyword or selected role/branch filters.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setRoleFilter('All');
                    setBranchFilter('All');
                  }}
                  className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <span>Clear Filters</span>
                </button>
              </div>
            )
          ) : (
            allPendingStaff.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircleIcon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">No Pending Invitations</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5">
                  All invited staff have accepted their invitations, or no pending invites are outstanding.
                </p>
                <button
                  onClick={openInviteModal}
                  className="inline-flex items-center gap-2 bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Invite New Staff Member</span>
                </button>
              </div>
            ) : (
              <div className="py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <SearchIcon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">No Pending Invites Match Your Filters</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-5">
                  No pending invitations match your search keyword or selected role/branch filters.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setRoleFilter('All');
                    setBranchFilter('All');
                  }}
                  className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  <span>Clear Filters</span>
                </button>
              </div>
            )
          )
        ) : (
          <>
            {/* Mobile View: Touch Cards (< md screens) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {displayedStaff.map((staff) => {
                const roleLower = (staff.roleName || '').toLowerCase();
                const isDoctor = roleLower === 'doctor';
                const isReceptionist = roleLower === 'receptionist';
                const isPharmacist = roleLower === 'pharmacist';
                const isOwnerRole = Boolean(
                  staff.isPrimaryOwner || staff.orgAuthority === 'primary_owner' || roleLower === 'owner'
                );
                const isSuspended = staff.status === 'suspended' || staff.status === 'disabled';

                return (
                  <div key={staff.membershipId || staff.invitationId} className="p-4 space-y-3">
                    {/* Header: Avatar, Name, Role Badge, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${
                            isOwnerRole
                              ? 'bg-amber-50 text-amber-600 border border-amber-200'
                              : isDoctor
                              ? 'bg-sky-50 text-[#009fe3] border border-sky-100'
                              : isReceptionist
                              ? 'bg-purple-50 text-purple-600 border border-purple-100'
                              : isPharmacist
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {(staff.fullName || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate flex items-center gap-1.5 text-sm">
                            <span>{staff.fullName || 'Unnamed Staff'}</span>
                            {staff.isPrimaryOwner ? (
                              <span title="Primary Owner">
                                <CrownIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              </span>
                            ) : staff.orgAuthority === 'administrator' ? (
                              <span title="Administrator / Co-Owner">
                                <ShieldCheckIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              </span>
                            ) : isOwnerRole ? (
                              <CrownIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                staff.isPrimaryOwner
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : staff.orgAuthority === 'administrator'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : isDoctor
                                  ? 'bg-sky-50 text-[#009fe3]'
                                  : isReceptionist
                                  ? 'bg-purple-50 text-purple-600'
                                  : isPharmacist
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {staff.isPrimaryOwner ? (
                                <CrownIcon className="w-3 h-3" />
                              ) : staff.orgAuthority === 'administrator' ? (
                                <ShieldCheckIcon className="w-3 h-3" />
                              ) : isDoctor ? (
                                <StethoscopeIcon className="w-3 h-3" />
                              ) : isReceptionist ? (
                                <MonitorIcon className="w-3 h-3" />
                              ) : isPharmacist ? (
                                <PillIcon className="w-3 h-3" />
                              ) : null}
                              <span>{staff.isPrimaryOwner ? 'Primary Owner' : staff.orgAuthority === 'administrator' ? 'Administrator' : staff.roleName}</span>
                            </span>

                            {staff.doctorRegNo && (
                              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded">
                                NMC: {staff.doctorRegNo}
                              </span>
                            )}

                            {staff.specialty && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {staff.specialty}
                              </span>
                            )}

                            {!isOwnerRole && !staff.isPrimaryOwner && !isPendingView && (
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                                  staff.permissionMode === 'custom'
                                    ? 'bg-purple-50/60 text-purple-700 border-purple-200'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}
                              >
                                {staff.permissionMode === 'custom'
                                  ? `Custom (${staff.customPermissions?.length || 0})`
                                  : 'Role Defaults'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {isPendingView ? (
                          staff.isExpired ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>Expired</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span>{typeof staff.daysRemaining === 'number' ? `${staff.daysRemaining}d left` : 'Invited'}</span>
                            </span>
                          )
                        ) : isOwnerRole ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            <CrownIcon className="w-3 h-3 text-amber-600" />
                            <span>Owner</span>
                          </span>
                        ) : isSuspended ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Suspended</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Active</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contact Info & Branches */}
                    <div className="text-xs text-slate-600 space-y-1 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      {staff.mobile && (
                        <div className="flex items-center gap-2">
                          <PhoneIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>+91 {staff.mobile}</span>
                        </div>
                      )}
                      {staff.email && (
                        <div className="flex items-center gap-2">
                          <MailIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{staff.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/60 mt-1 flex-wrap">
                        <BuildingIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-[11px] font-semibold text-slate-600">Branches:</span>
                        {isOwnerRole ? (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 font-bold">
                            <BuildingIcon className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>All Branches (Clinic Owner)</span>
                          </span>
                        ) : staff.assignedBranches.length === 0 ? (
                          <span className="text-[11px] text-rose-500 font-medium">None</span>
                        ) : (
                          staff.assignedBranches.map((b) => (
                            <span
                              key={b.id}
                              className="text-[11px] bg-white text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 font-medium"
                            >
                              {b.name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Touch Card Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                      {isPendingView ? (
                        <>
                          <button
                            onClick={() => openShareModal(staff)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#009fe3] bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-100 cursor-pointer"
                          >
                            <MailIcon className="w-3.5 h-3.5" />
                            <span>Share</span>
                          </button>
                          <button
                            onClick={() => openEditInviteModal(staff)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg cursor-pointer"
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          {staff.isExpired && (
                            <button
                              onClick={() => handleRenewInvite(staff)}
                              disabled={actionInProgress === staff.invitationId}
                              className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg border border-amber-300 cursor-pointer"
                            >
                              <ClockIcon className="w-3.5 h-3.5" />
                              <span>Renew (7d)</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setTargetInviteToRevoke(staff);
                              setRevokeConfirmModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 cursor-pointer"
                          >
                            <XIcon className="w-3.5 h-3.5" />
                            <span>Revoke</span>
                          </button>
                        </>
                      ) : isOwnerRole ? (
                        isPrimaryOwner ? (
                          <button
                            onClick={() => openEditActiveModal(staff)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg cursor-pointer"
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                            <span>Edit Profile</span>
                          </button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-200/80"
                            title="Primary Owner account is protected"
                          >
                            <LockIcon className="w-3.5 h-3.5 text-amber-600" />
                            <span>Protected</span>
                          </span>
                        )
                      ) : staff.orgAuthority === 'administrator' && !isPrimaryOwner ? (
                        staff.userId === user?.id ? (
                          <button
                            onClick={() => openEditActiveModal(staff)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg cursor-pointer"
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                            <span>Edit Profile</span>
                          </button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50/80 px-2.5 py-1.5 rounded-lg border border-indigo-200/80"
                            title="Only the Primary Owner can manage Co-Owner accounts"
                          >
                            <LockIcon className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Protected</span>
                          </span>
                        )
                      ) : (
                        <>
                          <button
                            onClick={() => openEditActiveModal(staff)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg cursor-pointer"
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                            <span>Edit Profile</span>
                          </button>
                          {isPrimaryOwner && staff.orgAuthority === 'administrator' && (
                            <button
                              onClick={() => openTransferOwnershipModal(staff)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg border border-amber-200 cursor-pointer"
                              title="Transfer Primary Clinic Ownership"
                            >
                              <CrownIcon className="w-3.5 h-3.5 text-amber-600" />
                              <span>Transfer Ownership</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleStaffStatus(staff)}
                            disabled={actionInProgress === staff.membershipId}
                            className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer ${
                              isSuspended
                                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                            }`}
                          >
                            {actionInProgress === staff.membershipId ? (
                              <>
                                <svg className="animate-spin h-3.5 w-3.5 text-current" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>Updating...</span>
                              </>
                            ) : (
                              <span>{isSuspended ? 'Reactivate' : 'Suspend'}</span>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setTargetMemberToRemove(staff);
                              setRemoveConfirmModalOpen(true);
                            }}
                            className="inline-flex items-center justify-center p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Remove Staff"
                          >
                            <XIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md screens) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">
                      {isPendingView ? 'Invited Candidate' : 'Active Staff Member'}
                    </th>
                    <th className="py-3.5 px-4">Role & Specialization</th>
                    <th className="py-3.5 px-4">Assigned Branches</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {displayedStaff.map((staff) => {
                    const roleLower = (staff.roleName || '').toLowerCase();
                    const isDoctor = roleLower === 'doctor';
                    const isReceptionist = roleLower === 'receptionist';
                    const isPharmacist = roleLower === 'pharmacist';
                    const isOwnerRole = Boolean(
                      staff.isPrimaryOwner || staff.orgAuthority === 'primary_owner' || roleLower === 'owner'
                    );
                    const isCoOwner = staff.orgAuthority === 'administrator' && !isOwnerRole;
                    const isSuspended = staff.status === 'suspended' || staff.status === 'disabled';

                    return (
                      <tr key={staff.membershipId || staff.invitationId} className="hover:bg-slate-50/50 transition-colors">
                        {/* Name & Contact */}
                        <td className="py-4 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                isOwnerRole
                                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                  : isCoOwner
                                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                                  : isDoctor
                                  ? 'bg-sky-50 text-[#009fe3]'
                                  : isReceptionist
                                  ? 'bg-purple-50 text-purple-600'
                                  : isPharmacist
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {(staff.fullName || 'S').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                                <span>{staff.fullName || 'Unnamed Staff'}</span>
                                {isOwnerRole ? (
                                  <CrownIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                ) : isCoOwner ? (
                                  <span title="Co-Owner (Administrator)">
                                    <ShieldCheckIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                {staff.mobile && <span>+91 {staff.mobile}</span>}
                                {staff.email && <span>• {staff.email}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role & Specialization */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-md ${
                                  isOwnerRole
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : isDoctor
                                    ? 'bg-sky-50 text-[#009fe3]'
                                    : isReceptionist
                                    ? 'bg-purple-50 text-purple-600'
                                    : isPharmacist
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {isOwnerRole ? (
                                  <CrownIcon className="w-3.5 h-3.5" />
                                ) : isDoctor ? (
                                  <StethoscopeIcon className="w-3.5 h-3.5" />
                                ) : isReceptionist ? (
                                  <MonitorIcon className="w-3.5 h-3.5" />
                                ) : isPharmacist ? (
                                  <PillIcon className="w-3.5 h-3.5" />
                                ) : null}
                                <span>{staff.roleName}</span>
                              </span>

                              {isCoOwner && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  <ShieldCheckIcon className="w-3 h-3 text-indigo-600" />
                                  <span>Co-Owner</span>
                                </span>
                              )}
                            </div>

                            {staff.specialty ? (
                              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                {staff.specialty}
                              </span>
                            ) : !isOwnerRole && !isCoOwner && !isPendingView ? (
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                  staff.permissionMode === 'custom'
                                    ? 'bg-purple-50/60 text-purple-700 border-purple-200'
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}
                              >
                                {staff.permissionMode === 'custom'
                                  ? `Custom (${staff.customPermissions?.length || 0})`
                                  : 'Role Defaults'}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Assigned Branches */}
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {isOwnerRole ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200">
                                <CrownIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <BuildingIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>All Branches (Clinic Owner)</span>
                              </span>
                            ) : isCoOwner ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-50 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-200">
                                <ShieldCheckIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <BuildingIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>All Branches (Co-Owner)</span>
                              </span>
                            ) : staff.assignedBranches.length === 0 ? (
                              <span className="text-xs text-rose-500 font-medium">No branch assigned</span>
                            ) : (
                              staff.assignedBranches.map((b) => (
                                <span
                                  key={b.id}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/80"
                                >
                                  <BuildingIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{b.name}</span>
                                </span>
                              ))
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {isPendingView ? (
                            staff.isExpired ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span>Expired</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                <span>
                                  {typeof staff.daysRemaining === 'number'
                                    ? `Expires in ${staff.daysRemaining}d`
                                    : 'Invitation Sent'}
                                </span>
                              </span>
                            )
                          ) : isOwnerRole ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                              <CrownIcon className="w-3.5 h-3.5 text-amber-600" />
                              <span>Owner Account</span>
                            </span>
                          ) : isSuspended ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>Suspended</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Active Member</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                          {isPendingView ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Share */}
                              <button
                                onClick={() => openShareModal(staff)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#009fe3] hover:text-[#008bc7] bg-sky-50 hover:bg-sky-100 px-2.5 py-1.5 rounded-lg border border-sky-100 transition-colors cursor-pointer"
                                title="Share invitation link"
                              >
                                <MailIcon className="w-3.5 h-3.5" />
                                <span>Share</span>
                              </button>

                              {/* Edit Invite */}
                              <button
                                onClick={() => openEditInviteModal(staff)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Edit invite details"
                              >
                                <PencilIcon className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {/* Renew if expired */}
                              {staff.isExpired && (
                                <button
                                  onClick={() => handleRenewInvite(staff)}
                                  disabled={actionInProgress === staff.invitationId}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg border border-amber-300 transition-colors cursor-pointer"
                                  title="Extend 7 days"
                                >
                                  <ClockIcon className="w-3.5 h-3.5" />
                                  <span>Renew (7d)</span>
                                </button>
                              )}

                              {/* Revoke */}
                              <button
                                onClick={() => {
                                  setTargetInviteToRevoke(staff);
                                  setRevokeConfirmModalOpen(true);
                                }}
                                className="inline-flex items-center justify-center p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Revoke Invitation"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ) : isOwnerRole ? (
                            <div className="flex items-center justify-end gap-2">
                              {isPrimaryOwner ? (
                                <button
                                  onClick={() => openEditActiveModal(staff)}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Profile & Contact Details"
                                >
                                  <PencilIcon className="w-3.5 h-3.5" />
                                  <span>Edit Profile</span>
                                </button>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-200/80"
                                  title="Primary Owner profile can only be edited by the Primary Owner"
                                >
                                  <LockIcon className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Protected</span>
                                </span>
                              )}
                            </div>
                          ) : isCoOwner && !isPrimaryOwner ? (
                            <div className="flex items-center justify-end gap-2">
                              {staff.userId === user?.id ? (
                                <button
                                  onClick={() => openEditActiveModal(staff)}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Your Profile & Contact Details"
                                >
                                  <PencilIcon className="w-3.5 h-3.5" />
                                  <span>Edit Profile</span>
                                </button>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50/80 px-2.5 py-1.5 rounded-lg border border-indigo-200/80"
                                  title="Only the Primary Owner can manage Co-Owner accounts"
                                >
                                  <LockIcon className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Protected</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Transfer Primary Ownership to Co-Owner */}
                              {isPrimaryOwner && staff.orgAuthority === 'administrator' && (
                                <button
                                  onClick={() => openTransferOwnershipModal(staff)}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                                  title="Transfer Primary Clinic Ownership to this Co-Owner"
                                >
                                  <CrownIcon className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Transfer Ownership</span>
                                </button>
                              )}

                              {/* Edit Profile & Capabilities */}
                              <button
                                onClick={() => openEditActiveModal(staff)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Edit Profile & Capabilities"
                              >
                                <PencilIcon className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>

                              {/* Suspend / Reactivate */}
                              <button
                                onClick={() => handleToggleStaffStatus(staff)}
                                disabled={actionInProgress === staff.membershipId}
                                className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isSuspended
                                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                                }`}
                                title={isSuspended ? 'Reactivate Staff Access' : 'Suspend Staff Access'}
                              >
                                {actionInProgress === staff.membershipId ? (
                                  <>
                                    <svg className="animate-spin h-3.5 w-3.5 text-current" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Updating...</span>
                                  </>
                                ) : (
                                  <span>{isSuspended ? 'Reactivate' : 'Suspend'}</span>
                                )}
                              </button>

                              {/* Remove Staff */}
                              <button
                                onClick={() => {
                                  setTargetMemberToRemove(staff);
                                  setRemoveConfirmModalOpen(true);
                                }}
                                className="inline-flex items-center justify-center p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Remove Staff Member from Clinic"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ==================== MODAL 1: Invite New Staff Member ==================== */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Invite New Staff Member</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign role, specialization, and multi-branch clinic scopes.
                </p>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {modalErrorMessage && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-start justify-between shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangleIcon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-rose-900">Please Check Details</div>
                      <div className="mt-0.5 text-rose-700 leading-relaxed">{modalErrorMessage}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalErrorMessage(null)}
                    className="text-rose-500 hover:text-rose-800 text-xs font-bold cursor-pointer ml-3 p-1"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Basic Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  1. Staff Information
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Prakash Rathod or Mona Sharma"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (modalErrorMessage) setModalErrorMessage(null);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. staff@clinic.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (modalErrorMessage) setModalErrorMessage(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Mobile Number (10 Digits) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={mobile}
                      onChange={(e) => {
                        setMobile(e.target.value);
                        if (modalErrorMessage) setModalErrorMessage(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. System Role
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {availableRoles.map((r) => {
                    const isSelected = roleName.toLowerCase() === r.name.toLowerCase();
                    const isDoctor = r.name.toLowerCase() === 'doctor';
                    const isReceptionist = r.name.toLowerCase() === 'receptionist';
                    const isPharmacist = r.name.toLowerCase() === 'pharmacist';

                    return (
                      <button
                        key={r.id || r.name}
                        type="button"
                        onClick={() => handleRoleChange(r.name)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                          isSelected
                            ? 'border-[#009fe3] bg-sky-50/50 ring-2 ring-[#009fe3]/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isDoctor
                            ? 'bg-sky-100 text-[#009fe3]'
                            : isReceptionist
                            ? 'bg-purple-100 text-purple-600'
                            : isPharmacist
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-indigo-100 text-indigo-600'
                        }`}>
                          {isDoctor ? (
                            <StethoscopeIcon className="w-4 h-4" />
                          ) : isReceptionist ? (
                            <MonitorIcon className="w-4 h-4" />
                          ) : isPharmacist ? (
                            <PillIcon className="w-4 h-4" />
                          ) : (
                            <ShieldCheckIcon className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{r.name}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                            {isDoctor ? 'OPD & Rx' : isReceptionist ? 'Queue & Bill' : isPharmacist ? 'Dispensing' : (r.description || 'Custom Role')}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Specialization / Degree (Doctor Only) */}
                {roleName === 'Doctor' && (
                  <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-100 space-y-2 mt-3">
                    <div className="text-xs font-bold text-[#009fe3] flex items-center gap-1.5">
                      <StethoscopeIcon className="w-3.5 h-3.5" />
                      <span>Doctor Specialization & Qualifications</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Specialty / Degree
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MBBS, MD General Medicine, DNB Cardiology"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Governance Authority Level */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Governance Authority Level
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      newOrgAuthority === 'none'
                        ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="new_authority"
                      checked={newOrgAuthority === 'none'}
                      onChange={() => setNewOrgAuthority('none')}
                      className="w-4 h-4 text-[#009fe3] mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Operational Staff</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Follows assigned role permissions across their branch access
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      newOrgAuthority === 'administrator'
                        ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="new_authority"
                      checked={newOrgAuthority === 'administrator'}
                      onChange={() => {
                        setNewOrgAuthority('administrator');
                        setSelectedBranchIds(branches.map((b) => b.id));
                      }}
                      className="w-4 h-4 text-indigo-600 mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Co-Owner (Administrator)</span>
                        <ShieldCheckIcon className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Full clinic governance across all branches, staff & roles
                      </div>
                    </div>
                  </label>
                </div>

                {newOrgAuthority === 'administrator' && (
                  <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200/80 flex items-start gap-2.5">
                    <ShieldCheckIcon className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-indigo-950 leading-relaxed">
                      <span className="font-bold text-indigo-900">Co-Owner Authority:</span> Full clinic governance across all hospital branches, staff invitations, and capability configuration.
                    </div>
                  </div>
                )}
              </div>

              {/* Branch Scoping */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    3. Branch Access Scoping *
                  </h3>
                  <button
                    type="button"
                    onClick={handleSelectAllBranches}
                    className="text-xs font-bold text-[#009fe3] hover:underline cursor-pointer"
                  >
                    {selectedBranchIds.length === branches.length ? 'Deselect All' : 'Select All Branches'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {branches.map((b) => {
                    const isChecked = selectedBranchIds.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-[#009fe3] bg-sky-50/40 text-slate-900'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleBranchSelection(b.id)}
                          className="w-4 h-4 rounded text-[#009fe3] focus:ring-[#009fe3] border-slate-300"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate">{b.name}</div>
                          <div className="text-[10px] text-slate-500">{b.city || 'Surat'} ({b.code})</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Permission Mode Choice */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  4. Capability Governance
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition-colors ${
                      permissionMode === 'template'
                        ? 'border-[#009fe3] bg-sky-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="perm_mode"
                      checked={permissionMode === 'template'}
                      onChange={() => setPermissionMode('template')}
                      className="w-4 h-4 text-[#009fe3] mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Standard Role Template</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Inherit standard {roleName} permissions configured for your clinic.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition-colors ${
                      permissionMode === 'custom'
                        ? 'border-purple-500 bg-purple-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="perm_mode"
                      checked={permissionMode === 'custom'}
                      onChange={() => {
                        setPermissionMode('custom');
                        if (selectedCustomPerms.length === 0) {
                          setSelectedCustomPerms([...getRoleTemplate(roleName)]);
                        }
                      }}
                      className="w-4 h-4 text-purple-600 mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Custom Capabilities</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Fine-tune specific rights for this staff member.
                      </div>
                    </div>
                  </label>
                </div>

                {permissionMode === 'template' && (
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ShieldCheckIcon className="w-4 h-4 text-[#009fe3]" />
                        <span>Inherited Role Capabilities ({roleName})</span>
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-[#009fe3] border border-sky-200">
                        {getRoleTemplate(roleName).length} Granted by Default
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {getRoleTemplate(roleName).map((code) => {
                        const def = MASTER_PERMISSIONS[code as PermissionCode];
                        return (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs"
                          >
                            <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{def?.title || code}</span>
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-500 pt-0.5 leading-relaxed">
                      Staff member will automatically receive the capabilities above. Choose &quot;Custom Capabilities&quot; if you need to grant or restrict specific rights.
                    </p>
                  </div>
                )}

                {permissionMode === 'custom' && (
                  <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                      <div>
                        <div className="text-xs font-bold text-slate-900">Custom Capability Matrix</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Configure exact rights across all 5 clinical and administrative categories.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomPerms([...getRoleTemplate(roleName)])}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                      >
                        Reset to {roleName} Defaults
                      </button>
                    </div>

                    {CAPABILITY_TIERS.map((tier, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{tier.tierName}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${tier.badgeColor}`}>
                            {tier.badge}
                          </span>
                        </div>

                        {tier.warning && (
                          <div className="text-[11px] text-amber-700 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60">
                            {tier.warning}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {tier.capabilities.map((cap) => {
                            const isChecked = selectedCustomPerms.includes(cap.code);
                            return (
                              <label
                                key={cap.code}
                                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors flex items-start gap-2.5 ${
                                  isChecked
                                    ? 'bg-white border-purple-300 shadow-2xs'
                                    : 'bg-slate-100/60 border-slate-200'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCustomPermission(cap.code)}
                                  className="w-3.5 h-3.5 rounded text-purple-600 mt-0.5"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-800">{cap.title}</div>
                                  <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{cap.desc}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setInviteModalOpen(false);
                    setModalErrorMessage(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Generating Invitation...' : 'Send Staff Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: Edit Active Staff Member ==================== */}
      {editActiveModalOpen && editingStaff && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Edit Staff Profile & Access: {editingStaff.fullName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update personal profile, contact information, role, branch scopes, and status.
                </p>
              </div>
              <button
                onClick={() => setEditActiveModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveActiveStaff} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {modalErrorMessage && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-start justify-between shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangleIcon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-rose-900">Update Error</div>
                      <div className="mt-0.5 text-rose-700 leading-relaxed">{modalErrorMessage}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalErrorMessage(null)}
                    className="text-rose-500 hover:text-rose-800 text-xs font-bold cursor-pointer ml-3 p-1"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Profile Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  1. Profile Details
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Mobile Number (10 Digits) *
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={editMobile}
                      onChange={(e) => setEditMobile(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Role & Specialization */}
              {editingStaff.roleName?.toLowerCase() === 'owner' || editingStaff.isOwner ? (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    2. Role & System Level
                  </h3>
                  <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
                        <CrownIcon className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-amber-900">Clinic Owner</div>
                        <div className="text-[11px] text-amber-700">Full administrative, financial & clinical access</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-800">
                      Protected Role
                    </span>
                  </div>
                </div>
              ) : (
                <>
                {/* Governance Authority Level */}
                {!editingStaff.isOwner && !editingStaff.isPrimaryOwner && (
                  isPrimaryOwner ? (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Governance Authority Level
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label
                          className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                            editOrgAuthority === 'none'
                              ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="edit_authority"
                            checked={editOrgAuthority === 'none'}
                            onChange={() => setEditOrgAuthority('none')}
                            className="w-4 h-4 text-[#009fe3] mt-0.5"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900">Operational Staff</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Follows assigned role permissions and branch scoping
                            </div>
                          </div>
                        </label>

                        <label
                          className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                            editOrgAuthority === 'administrator'
                              ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="edit_authority"
                            checked={editOrgAuthority === 'administrator'}
                            onChange={() => {
                              setEditOrgAuthority('administrator');
                              setEditSelectedBranchIds(branches.map((b) => b.id));
                            }}
                            className="w-4 h-4 text-indigo-600 mt-0.5"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span>Co-Owner (Administrator)</span>
                              <ShieldCheckIcon className="w-3.5 h-3.5 text-indigo-600" />
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Full clinic governance across all branches, staff & roles
                            </div>
                          </div>
                        </label>
                      </div>

                      {editOrgAuthority === 'administrator' && (
                        <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200/80 flex items-start gap-2.5">
                          <ShieldCheckIcon className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <div className="text-[11px] text-indigo-950 leading-relaxed">
                            <span className="font-bold text-indigo-900">Co-Owner Authority:</span> Full clinic governance across all hospital branches, staff invitations, and capability configuration.
                          </div>
                        </div>
                      )}
                    </div>
                  ) : editingStaff.orgAuthority === 'administrator' ? (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Governance Authority Level
                      </h3>
                      <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold">
                            <ShieldCheckIcon className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-indigo-900">Co-Owner (Administrator)</div>
                            <div className="text-[11px] text-indigo-700">Full administrative & operational access across all branches</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200/60 text-indigo-800">
                          Protected Authority
                        </span>
                      </div>
                    </div>
                  ) : null
                )}

                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    2. Role & Specialization
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {availableRoles.map((r) => {
                      const isSelected = editRoleName.toLowerCase() === r.name.toLowerCase();
                      const isDoctor = r.name.toLowerCase() === 'doctor';
                      const isReceptionist = r.name.toLowerCase() === 'receptionist';
                      const isPharmacist = r.name.toLowerCase() === 'pharmacist';

                      return (
                        <button
                          key={r.id || r.name}
                          type="button"
                          onClick={() => {
                            setEditRoleName(r.name);
                            if (editPermissionMode === 'custom') {
                              setEditSelectedCustomPerms(getRoleTemplate(r.name));
                            }
                          }}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                            isSelected
                              ? 'border-[#009fe3] bg-sky-50/50 ring-2 ring-[#009fe3]/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isDoctor
                              ? 'bg-sky-100 text-[#009fe3]'
                              : isReceptionist
                              ? 'bg-purple-100 text-purple-600'
                              : isPharmacist
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-indigo-100 text-indigo-600'
                          }`}>
                            {isDoctor ? (
                              <StethoscopeIcon className="w-4 h-4" />
                            ) : isReceptionist ? (
                              <MonitorIcon className="w-4 h-4" />
                            ) : isPharmacist ? (
                              <PillIcon className="w-4 h-4" />
                            ) : (
                              <ShieldCheckIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">{r.name}</div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                              {isDoctor ? 'OPD & Rx' : isReceptionist ? 'Queue & Bill' : isPharmacist ? 'Dispensing' : (r.description || 'Custom Role')}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {editRoleName === 'Doctor' && (
                    <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-100 space-y-1.5 mt-2">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Doctor Specialization / Degree
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MBBS, MD General Medicine, DNB Cardiology"
                        value={editSpecialty}
                        onChange={(e) => setEditSpecialty(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                      />
                    </div>
                  )}
                </div>
                </>
              )}

              {/* Branch Scoping & Default Primary Branch */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    3. Hospital Branch Scoping *
                  </h3>
                  <button
                    type="button"
                    onClick={handleSelectAllEditBranches}
                    className="text-xs font-bold text-[#009fe3] hover:underline cursor-pointer"
                  >
                    {editSelectedBranchIds.length === branches.length ? 'Deselect All' : 'Select All Branches'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {branches.map((b) => {
                    const isChecked = editSelectedBranchIds.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-[#009fe3] bg-sky-50/40 text-slate-900'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEditBranchSelection(b.id)}
                          className="w-4 h-4 rounded text-[#009fe3] focus:ring-[#009fe3] border-slate-300"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold truncate">{b.name}</div>
                          <div className="text-[10px] text-slate-500">{b.city || 'Surat'} ({b.code})</div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Default Primary Branch */}
                {editSelectedBranchIds.length > 0 && (
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Default Primary Branch (Auto-selected on login)
                    </label>
                    <select
                      value={editDefaultClinicId}
                      onChange={(e) => setEditDefaultClinicId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#009fe3]"
                    >
                      {branches
                        .filter((b) => editSelectedBranchIds.includes(b.id))
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Capability Governance */}
              {!editingStaff.isOwner && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      4. Capability Governance
                    </h3>
                    {editPermissionMode === 'custom' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditPermissionMode('template');
                          setEditSelectedCustomPerms([...getRoleTemplate(editRoleName)]);
                        }}
                        className="text-xs font-bold text-[#009fe3] hover:underline cursor-pointer"
                      >
                        Reset to Default Template
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition-colors ${
                        editPermissionMode === 'template'
                          ? 'border-[#009fe3] bg-sky-50/40'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="edit_perm_mode"
                        checked={editPermissionMode === 'template'}
                        onChange={() => setEditPermissionMode('template')}
                        className="w-4 h-4 text-[#009fe3] mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Standard Role Template</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Follows clinic-wide {editRoleName} capabilities.
                        </div>
                      </div>
                    </label>

                    <label
                      className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition-colors ${
                        editPermissionMode === 'custom'
                          ? 'border-purple-500 bg-purple-50/40'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="edit_perm_mode"
                        checked={editPermissionMode === 'custom'}
                        onChange={() => {
                          setEditPermissionMode('custom');
                          if (editSelectedCustomPerms.length === 0) {
                            setEditSelectedCustomPerms([...getRoleTemplate(editRoleName)]);
                          }
                        }}
                        className="w-4 h-4 text-purple-600 mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Custom Capabilities</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Specific customized rights for this staff member.
                        </div>
                      </div>
                    </label>
                  </div>

                  {editPermissionMode === 'template' && (
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <ShieldCheckIcon className="w-4 h-4 text-[#009fe3]" />
                          <span>Inherited Role Capabilities ({editRoleName})</span>
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-[#009fe3] border border-sky-200">
                          {getRoleTemplate(editRoleName).length} Active by Default
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {getRoleTemplate(editRoleName).map((code) => {
                          const def = MASTER_PERMISSIONS[code as PermissionCode];
                          return (
                            <span
                              key={code}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs"
                            >
                              <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{def?.title || code}</span>
                            </span>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-500 pt-0.5 leading-relaxed">
                        This staff member automatically follows the clinic template for <span className="font-semibold text-slate-700">{editRoleName}</span>. Choose &quot;Custom Capabilities&quot; above to grant or revoke specific privileges.
                      </p>
                    </div>
                  )}

                  {editPermissionMode === 'custom' && (
                    <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                        <div>
                          <div className="text-xs font-bold text-slate-900">Custom Capability Matrix</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Fine-tune individual rights across all 5 operational categories.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditSelectedCustomPerms([...getRoleTemplate(editRoleName)])}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                        >
                          Reset to {editRoleName} Defaults
                        </button>
                      </div>

                      {CAPABILITY_TIERS.map((tier, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">{tier.tierName}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${tier.badgeColor}`}>
                              {tier.badge}
                            </span>
                          </div>

                          {tier.warning && (
                            <div className="text-[11px] text-amber-700 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60">
                              {tier.warning}
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {tier.capabilities.map((cap) => {
                              const isChecked = editSelectedCustomPerms.includes(cap.code);
                              return (
                                <label
                                  key={cap.code}
                                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-colors flex items-start gap-2.5 ${
                                    isChecked
                                      ? 'bg-white border-purple-300 shadow-2xs'
                                      : 'bg-slate-100/60 border-slate-200'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleEditCustomPermission(cap.code)}
                                    className="w-3.5 h-3.5 rounded text-purple-600 mt-0.5"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-slate-800">{cap.title}</div>
                                    <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{cap.desc}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Status & Account Governance */}
              {!editingStaff.isOwner && editingStaff.userId !== user?.id && (isPrimaryOwner || editingStaff.orgAuthority !== 'administrator') && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    5. Account Access Status
                  </h3>
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {editStatus === 'active' ? 'Account Active' : 'Account Suspended'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {editStatus === 'active'
                          ? 'Staff member can log in and access clinic operations across assigned branches.'
                          : 'Staff member is blocked from logging in. Past clinical records remain preserved.'}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={actionInProgress === editingStaff.membershipId}
                      onClick={async () => {
                        await handleToggleStaffStatus(editingStaff);
                        setEditStatus((prev) => (prev === 'active' ? 'suspended' : 'active'));
                      }}
                      className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer border inline-flex items-center gap-1.5 ${
                        editStatus === 'active'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {actionInProgress === editingStaff.membershipId ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-current" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Updating...</span>
                        </>
                      ) : (
                        <span>{editStatus === 'active' ? 'Suspend Access' : 'Reactivate Access'}</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Danger Zone */}
              {!editingStaff.isOwner && editingStaff.userId !== user?.id && (isPrimaryOwner || editingStaff.orgAuthority !== 'administrator') && (
                <div className="pt-2 border-t border-rose-100">
                  <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200/80 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-rose-900">Remove from Clinic</div>
                      <div className="text-[11px] text-rose-700 mt-0.5">
                        Permanently revoke this staff member&apos;s clinic membership and branch scopes.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditActiveModalOpen(false);
                        setTargetMemberToRemove(editingStaff);
                        setRemoveConfirmModalOpen(true);
                      }}
                      className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      Remove Staff
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditActiveModalOpen(false);
                    setModalErrorMessage(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving Changes...' : 'Save Staff Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: Edit Pending Invitation ==================== */}
      {editInviteModalOpen && editingInvite && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Edit Pending Invitation: {editingInvite.fullName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update candidate contact details or assigned branches before they accept.
                </p>
              </div>
              <button
                onClick={() => setEditInviteModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePendingInvite} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {modalErrorMessage && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-start justify-between shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangleIcon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-rose-900">Update Error</div>
                      <div className="mt-0.5 text-rose-700 leading-relaxed">{modalErrorMessage}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalErrorMessage(null)}
                    className="text-rose-500 hover:text-rose-800 text-xs font-bold cursor-pointer ml-3 p-1"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Candidate Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={inviteEditFullName}
                  onChange={(e) => setInviteEditFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEditEmail}
                    onChange={(e) => setInviteEditEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={inviteEditMobile}
                    onChange={(e) => setInviteEditMobile(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Invited Role *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {availableRoles.map((r) => (
                    <button
                      key={r.id || r.name}
                      type="button"
                      onClick={() => setInviteEditRoleName(r.name)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer truncate ${
                        inviteEditRoleName.toLowerCase() === r.name.toLowerCase()
                          ? 'border-[#009fe3] bg-sky-50/60 text-[#009fe3] ring-1 ring-[#009fe3]'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>

              {inviteEditRoleName === 'Doctor' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Doctor Specialization / Degree
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MBBS, MS Ophthalmology"
                    value={inviteEditSpecialty}
                    onChange={(e) => setInviteEditSpecialty(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                  />
                </div>
              )}

              {/* Branch Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Assigned Branches *
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllInviteEditBranches}
                    className="text-xs font-bold text-[#009fe3] hover:underline cursor-pointer"
                  >
                    {inviteEditBranchIds.length === branches.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {branches.map((b) => {
                    const isChecked = inviteEditBranchIds.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs transition-colors ${
                          isChecked
                            ? 'border-[#009fe3] bg-sky-50/40 text-slate-900 font-semibold'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleInviteEditBranchSelection(b.id)}
                          className="w-3.5 h-3.5 rounded text-[#009fe3] focus:ring-[#009fe3]"
                        />
                        <span className="truncate">{b.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditInviteModalOpen(false);
                    setModalErrorMessage(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 4: Revoke Invite Confirmation Dialog ==================== */}
      {revokeConfirmModalOpen && targetInviteToRevoke && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangleIcon className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Revoke Staff Invitation?
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-4 leading-relaxed">
              Are you sure you want to revoke the invitation sent to{' '}
              <strong className="text-slate-800">{targetInviteToRevoke.fullName}</strong> (
              <span className="text-slate-600">{targetInviteToRevoke.email}</span>)? The secure join link will be permanently cancelled.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setRevokeConfirmModalOpen(false);
                  setTargetInviteToRevoke(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex-1"
              >
                Keep Invitation
              </button>
              <button
                type="button"
                onClick={handleConfirmRevokeInvite}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-sm flex-1 disabled:opacity-50"
              >
                {submitting ? 'Revoking...' : 'Yes, Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 5: Remove Staff Confirmation Dialog ==================== */}
      {removeConfirmModalOpen && targetMemberToRemove && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangleIcon className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Remove Staff Member from Clinic?
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-4 leading-relaxed">
              Are you sure you want to remove{' '}
              <strong className="text-slate-800">{targetMemberToRemove.fullName}</strong> from{' '}
              <strong className="text-slate-800">{organizationName || 'the clinic'}</strong>? Their active login session will be immediately revoked across all hospital branches. Past signed consultations and records will be preserved for compliance.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setRemoveConfirmModalOpen(false);
                  setTargetMemberToRemove(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveStaff}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-sm flex-1 disabled:opacity-50"
              >
                {submitting ? 'Removing...' : 'Yes, Remove Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 6: Invitation Link Ready Modal ==================== */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircleIcon className="w-6 h-6" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
              Staff Invitation Ready!
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-3 leading-relaxed">
              Share this secure link with{' '}
              <span className="font-semibold text-slate-800">
                {invitedStaffData?.name || 'the staff member'}
              </span>
              {invitedStaffData?.role && (
                <span className="text-slate-500"> ({invitedStaffData.role})</span>
              )}
              . They will set their own password and join{' '}
              <span className="font-semibold text-slate-800">
                {organizationName || 'your clinic'}
              </span>
              .
            </p>

            {/* Recipient Details Card */}
            {invitedStaffData && (
              <div className="mb-4 bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 text-left text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-medium text-slate-500">Staff Member:</span>
                  <span className="font-bold text-slate-800">{invitedStaffData.name}</span>
                </div>
                {invitedStaffData.mobile && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium text-slate-500">Mobile:</span>
                    <span className="font-mono font-bold text-slate-800">+91 {invitedStaffData.mobile}</span>
                  </div>
                )}
                {invitedStaffData.email && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium text-slate-500">Email:</span>
                    <span className="truncate max-w-[210px] text-slate-800 font-medium">{invitedStaffData.email}</span>
                  </div>
                )}
              </div>
            )}

            {/* Link Box */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left mb-3 break-all text-xs font-mono text-slate-700 select-all shadow-inner">
              {generatedInviteLink}
            </div>

            {/* Status Notices */}
            {copiedLink && (
              <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700 flex items-center justify-center gap-2 animate-in fade-in duration-100">
                <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Invitation link copied to clipboard!</span>
              </div>
            )}

            {whatsAppNotice && (
              <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 text-left flex items-start gap-2">
                <MailIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">WhatsApp Notice: </span>
                  <span>{whatsAppNotice}</span>
                </div>
              </div>
            )}

            {/* Email Status from Resend */}
            {sendingEmail && (
              <div className="mb-3 p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 text-left flex items-center gap-2 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping shrink-0" />
                <span className="font-semibold">
                  Delivering invitation email to {invitedStaffData?.email} via Resend...
                </span>
              </div>
            )}

            {emailStatus && !sendingEmail && (
              <div
                className={`mb-3 p-2.5 rounded-xl text-xs text-left flex items-start gap-2 animate-in fade-in duration-100 ${
                  emailStatus.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border border-rose-200 text-rose-900'
                }`}
              >
                {emailStatus.type === 'success' ? (
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangleIcon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold">
                    {emailStatus.type === 'success' ? 'Email Delivered: ' : 'Email Error: '}
                  </span>
                  <span>{emailStatus.message}</span>
                </div>
              </div>
            )}

            {/* 3 Share Action Channels */}
            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => copyToClipboard(generatedInviteLink)}
                className="w-full flex items-center justify-center gap-2 bg-[#009fe3] hover:bg-[#008bc7] text-white py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <CheckCircleIcon className="w-4 h-4" />
                <span>{copiedLink ? 'Copied to Clipboard!' : '1. Copy Invite Link'}</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer active:scale-[0.99]"
                >
                  <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                  </svg>
                  <span>2. WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareEmail}
                  disabled={sendingEmail}
                  className="flex items-center justify-center gap-2 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer active:scale-[0.99]"
                >
                  <MailIcon className="w-4 h-4 shrink-0" />
                  <span>{sendingEmail ? 'Sending...' : emailSentNotice ? '3. Resend Email' : '3. Send Email'}</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setLinkModalOpen(false);
                setInvitedStaffData(null);
                setEmailSentNotice(false);
                setEmailStatus(null);
                setSendingEmail(false);
                setWhatsAppNotice(null);
              }}
              className="mt-4 w-full py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}

      {/* ==================== MODAL 7: Transfer Primary Ownership Dialog ==================== */}
      {transferModalOpen && transferTargetStaff && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <CrownIcon className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Transfer Primary Ownership
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Handover founder authority of {organizationName || 'the clinic'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setTransferModalOpen(false);
                  setTransferTargetStaff(null);
                  setTransferError(null);
                }}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransferOwnership} className="p-6 space-y-4">
              {transferError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-start gap-2.5 shadow-2xs">
                  <AlertTriangleIcon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-900">Transfer Error</div>
                    <div className="mt-0.5 text-rose-700 leading-relaxed">{transferError}</div>
                  </div>
                </div>
              )}

              {/* Warning Notice */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs space-y-1.5 leading-relaxed">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangleIcon className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Important Clinic Governance Action</span>
                </div>
                <p className="text-amber-800">
                  You are about to transfer <strong>Primary Founder Ownership</strong> to{' '}
                  <strong>{transferTargetStaff.fullName}</strong> ({transferTargetStaff.email}).
                </p>
                <p className="text-amber-800">
                  After this transfer, you will become a <strong>Co-Owner (Administrator)</strong>. Only the new primary owner will have the authority to manage clinic transfer or close the organization.
                </p>
              </div>

              {/* Target Staff Summary */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-medium text-slate-500">New Primary Owner:</span>
                  <span className="font-bold text-slate-900">{transferTargetStaff.fullName}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-medium text-slate-500">Email Address:</span>
                  <span className="font-medium text-slate-800">{transferTargetStaff.email}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-medium text-slate-500">Current Role:</span>
                  <span className="font-bold text-indigo-700">Co-Owner ({transferTargetStaff.roleName})</span>
                </div>
              </div>

              {/* Security Re-Authentication Password */}
              <div className="space-y-1 pt-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Confirm Primary Owner Password *
                </label>
                <p className="text-[11px] text-slate-500 mb-1.5">
                  Enter your current login password to verify your identity and authorize this handover.
                </p>
                <input
                  type="password"
                  required
                  placeholder="Enter your account password"
                  value={transferPassword}
                  onChange={(e) => {
                    setTransferPassword(e.target.value);
                    if (transferError) setTransferError(null);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
              </div>

              {/* Acknowledgment Checkbox */}
              <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={transferConfirmChecked}
                  onChange={(e) => setTransferConfirmChecked(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 mt-0.5"
                />
                <span className="text-xs font-semibold text-slate-700 leading-normal">
                  I understand that this action is immediate and irrevocably transfers primary clinic ownership to {transferTargetStaff.fullName}.
                </span>
              </label>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTransferModalOpen(false);
                    setTransferTargetStaff(null);
                    setTransferError(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring || !transferConfirmChecked || !transferPassword.trim()}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-sm flex items-center gap-2"
                >
                  <CrownIcon className="w-4 h-4 text-white" />
                  <span>{transferring ? 'Transferring...' : 'Authorize Ownership Transfer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
