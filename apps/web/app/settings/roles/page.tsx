'use client';

import React, { useState, useEffect, useCallback } from 'react';
import NextLink from 'next/link';
import { SettingsLayout } from '../../../components/settings-layout';
import { getCurrentUser, getSupabaseClient } from '@healthiva/supabase';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  StethoscopeIcon,
  MonitorIcon,
  PillIcon,
  ShieldCheckIcon,
  UsersIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from '../../../components/icons';
import {
  PermissionCode,
  MASTER_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CATEGORIES,
} from '@/lib/permissions';

interface RoleConfig {
  roleId: string;
  roleName: string;
  description: string;
  permissions: string[];
  icon?: string;
  isCustom?: boolean;
  canPrescribe?: boolean;
  organizationId?: string | null;
}

// Canonical capabilities available for configuration per system role
const SYSTEM_ROLE_CAPABILITY_CONFIG: Record<
  string,
  {
    core: PermissionCode[];
    optional: PermissionCode[];
  }
> = {
  Doctor: {
    core: ['patient.register', 'queue.manage', 'visit.read', 'visit.write', 'visits.sign'],
    optional: ['billing.collect', 'reports.read'],
  },
  Receptionist: {
    core: ['patient.register', 'queue.manage', 'billing.collect', 'visit.read'],
    optional: ['billing.refund', 'reports.read'],
  },
  Pharmacist: {
    core: ['pharmacy.dispense', 'visit.read'],
    optional: ['billing.collect', 'reports.read'],
  },
};

const ORDERED_SYSTEM_ROLES = ['Doctor', 'Receptionist', 'Pharmacist'] as const;

export default function RolesSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [savedRoles, setSavedRoles] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mobile Active Role Tab Selector
  const [mobileActiveRole, setMobileActiveRole] = useState<string>('Doctor');

  // Custom Role Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRoleIcon, setNewRoleIcon] = useState('shield');
  const [newRolePerms, setNewRolePerms] = useState<string[]>([]);
  const [creatingRole, setCreatingRole] = useState(false);

  // Delete Custom Role State
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const loadRolePermissions = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) return;

      const res = await fetch(`/api/roles/permissions?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-store, no-cache',
        },
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.roles)) {
        setRoles(data.roles);
        const baseline: Record<string, string[]> = {};
        data.roles.forEach((r: RoleConfig) => {
          baseline[r.roleId] = [...r.permissions];
        });
        setSavedRoles(baseline);
      }
    } catch (err) {
      console.error('[Load Role Permissions Error]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const u = await getCurrentUser();
      setUser(u);
      await loadRolePermissions();
    }
    init();
  }, [loadRolePermissions]);

  const togglePermission = (roleId: string, permCode: string) => {
    setRoles((prevRoles) =>
      prevRoles.map((r) => {
        if (r.roleId !== roleId) return r;
        const hasCode = r.permissions.includes(permCode);
        return {
          ...r,
          permissions: hasCode
            ? r.permissions.filter((c) => c !== permCode)
            : [...r.permissions, permCode],
        };
      })
    );
  };

  const isRoleDirty = (role: RoleConfig) => {
    const saved = savedRoles[role.roleId];
    if (!saved) return false;
    if (saved.length !== role.permissions.length) return true;
    return role.permissions.some((p) => !saved.includes(p));
  };

  // Revert single role back to saved baseline in database
  const handleDiscardRole = (role: RoleConfig) => {
    const saved = savedRoles[role.roleId] || [];
    setRoles((prev) =>
      prev.map((r) => (r.roleId === role.roleId ? { ...r, permissions: [...saved] } : r))
    );
    setSuccessMessage(`Discarded changes for ${role.roleName}. Reverted to saved clinic template.`);
    setErrorMessage(null);
  };

  // Discard all unsaved changes across all roles
  const handleDiscardAll = () => {
    setRoles((prev) =>
      prev.map((r) => {
        const saved = savedRoles[r.roleId];
        return saved ? { ...r, permissions: [...saved] } : r;
      })
    );
    setSuccessMessage('Discarded all unsaved changes across all roles.');
    setErrorMessage(null);
  };

  // Restore factory blueprint recommendations for a system role
  const handleRestoreBlueprint = (role: RoleConfig) => {
    const normalized = role.roleName.toLowerCase();
    const defaults = DEFAULT_ROLE_PERMISSIONS[normalized] || [];
    setRoles((prev) =>
      prev.map((r) => (r.roleId === role.roleId ? { ...r, permissions: [...defaults] } : r))
    );
    setSuccessMessage(
      `Loaded standard factory blueprint (${defaults.length} capabilities) for ${role.roleName}. Click "Save" to apply.`
    );
    setErrorMessage(null);
  };

  // Save single role
  const handleSaveRole = async (role: RoleConfig) => {
    try {
      setSavingRoleId(role.roleId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/roles/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roleId: role.roleId,
          roleName: role.roleName,
          permissionCodes: role.permissions,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update role permissions.');
      }

      setSavedRoles((prev) => ({
        ...prev,
        [role.roleId]: [...role.permissions],
      }));

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('healthiva_roles_updated', Date.now().toString());
      }

      setSuccessMessage(`Successfully saved capability matrix for ${role.roleName}!`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error saving role permissions.');
    } finally {
      setSavingRoleId(null);
    }
  };

  // Save all modified roles
  const handleSaveAll = async () => {
    try {
      setSavingAll(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const dirtyList = roles.filter(isRoleDirty);
      if (dirtyList.length === 0) return;

      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      for (const role of dirtyList) {
        const res = await fetch('/api/roles/permissions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            roleId: role.roleId,
            roleName: role.roleName,
            permissionCodes: role.permissions,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || `Failed saving permissions for ${role.roleName}`);
        }
      }

      const newBaseline: Record<string, string[]> = {};
      roles.forEach((r) => {
        newBaseline[r.roleId] = [...r.permissions];
      });
      setSavedRoles(newBaseline);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('healthiva_roles_updated', Date.now().toString());
      }

      setSuccessMessage(`Successfully saved changes for ${dirtyList.map((r) => r.roleName).join(', ')}!`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error saving role templates.');
    } finally {
      setSavingAll(false);
    }
  };

  // Create custom role handler
  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      setErrorMessage('Role name is required.');
      return;
    }

    try {
      setCreatingRole(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDescription.trim(),
          icon: newRoleIcon,
          permissionCodes: newRolePerms,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to create custom role.');
      }

      setSuccessMessage(`Custom role "${newRoleName.trim()}" created successfully!`);
      setShowCreateModal(false);
      setNewRoleName('');
      setNewRoleDescription('');
      setNewRolePerms([]);
      await loadRolePermissions();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error creating custom role.');
    } finally {
      setCreatingRole(false);
    }
  };

  // Delete custom role handler
  const handleDeleteRole = async (role: RoleConfig) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the custom role "${role.roleName}"? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      setDeletingRoleId(role.roleId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/roles?id=${role.roleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to delete custom role.');
      }

      setSuccessMessage(`Custom role "${role.roleName}" deleted successfully.`);
      await loadRolePermissions();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error deleting custom role.');
    } finally {
      setDeletingRoleId(null);
    }
  };

  // Roles categorized: System roles first, then Custom roles
  const systemRoles = ORDERED_SYSTEM_ROLES.map((name) =>
    roles.find((r) => r.roleName.toLowerCase() === name.toLowerCase())
  ).filter((r): r is RoleConfig => Boolean(r));

  const customRoles = roles.filter(
    (r) => !ORDERED_SYSTEM_ROLES.some((name) => name.toLowerCase() === r.roleName.toLowerCase())
  );

  const displayRoles = [...systemRoles, ...customRoles];

  // Roles that currently have unsaved changes
  const dirtyRoles = displayRoles.filter(isRoleDirty);

  // Group permissions by category for matrix rows
  const matrixCategories = PERMISSION_CATEGORIES.filter((cat) => cat.key !== 'administration');

  return (
    <SettingsLayout
      user={user}
      activeTab="roles"
      title="Role Capabilities & Matrix"
      description="Configure baseline capabilities for Doctors, Receptionists, Pharmacists, and your clinic's custom roles in a unified matrix view."
    >
      {/* Information Header Banner */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-sky-50/70 to-indigo-50/50 border border-sky-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#009fe3]/10 text-[#009fe3] flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-slate-900">
              Unified Clinic Capability Matrix
            </div>
            <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Toggle rights across roles side-by-side. Clinic overrides completely replace factory templates. Custom roles (Nurse, Lab Tech, etc.) can be added freely.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Create Custom Role</span>
          </button>
          <NextLink
            href="/settings/staff"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/80 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold transition-colors shadow-2xs"
          >
            <UsersIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>Staff Directory</span>
          </NextLink>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-700 hover:text-rose-900 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* MOBILE SEGMENTED SELECTOR (< md screens)                      */}
      {/* ============================================================ */}
      <div className="block md:hidden mb-4">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Select Role to Configure
        </div>
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {displayRoles.map((role) => {
            const isSelected = mobileActiveRole === role.roleName;
            const dirty = isRoleDirty(role);
            return (
              <button
                key={role.roleId}
                type="button"
                onClick={() => setMobileActiveRole(role.roleName)}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex flex-col items-center gap-1 shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>{role.roleName}</span>
                  {role.isCustom && (
                    <span className="text-[9px] px-1 rounded bg-indigo-50 text-indigo-700">Custom</span>
                  )}
                  {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* UNIFIED COMPARISON MATRIX TABLE (Option 2)                   */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden mb-12">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#009fe3] mb-3" />
            <div className="text-xs font-semibold text-slate-500">
              Loading clinic capability matrix...
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              {/* Table Header */}
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75">
                  {/* Capability Details Column Header */}
                  <th className="py-4 px-4 sm:px-6 text-xs font-bold text-slate-700 uppercase tracking-wider min-w-[240px]">
                    <div className="flex items-center gap-2">
                      <span>Capability Details</span>
                      <span className="text-[10px] font-semibold text-slate-400 normal-case">
                        (Matrix View)
                      </span>
                    </div>
                  </th>

                  {/* Role Column Headers */}
                  {displayRoles.map((role) => {
                    const isSaving = savingRoleId === role.roleId || savingAll;
                    const dirty = isRoleDirty(role);
                    const isDoctor = role.roleName === 'Doctor';
                    const isReceptionist = role.roleName === 'Receptionist';
                    const isPharmacist = role.roleName === 'Pharmacist';
                    const isMobileFocused = mobileActiveRole === role.roleName;

                    return (
                      <th
                        key={role.roleId}
                        className={`py-3 px-3 sm:px-4 text-center transition-colors min-w-[140px] ${
                          isMobileFocused ? 'bg-sky-50/30' : ''
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          {/* Role Icon & Title */}
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isDoctor
                                  ? 'bg-sky-50 text-[#009fe3]'
                                  : isReceptionist
                                  ? 'bg-purple-50 text-purple-600'
                                  : isPharmacist
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-indigo-50 text-indigo-600'
                              }`}
                            >
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
                            <span className="text-xs sm:text-sm font-bold text-slate-900">
                              {role.roleName}
                            </span>
                            {role.isCustom && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRole(role)}
                                disabled={deletingRoleId === role.roleId}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition-colors"
                                title="Delete Custom Role"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Active Badge */}
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              {role.permissions.length} active
                            </span>
                            {role.isCustom && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Custom
                              </span>
                            )}
                            {dirty && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                                title="Unsaved changes"
                              >
                                Modified
                              </span>
                            )}
                          </div>

                          {/* Action Button Strip */}
                          <div className="flex items-center gap-1 mt-2">
                            {dirty && (
                              <button
                                type="button"
                                onClick={() => handleDiscardRole(role)}
                                disabled={isSaving}
                                className="text-[10px] font-bold text-amber-700 hover:text-amber-900 px-1.5 py-0.5 rounded hover:bg-amber-50 cursor-pointer"
                                title="Revert to saved template"
                              >
                                Discard
                              </button>
                            )}
                            {!role.isCustom && (
                              <button
                                type="button"
                                onClick={() => handleRestoreBlueprint(role)}
                                disabled={isSaving}
                                className="text-[10px] font-bold text-slate-400 hover:text-slate-700 px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer"
                                title="Reset to factory blueprint"
                              >
                                Blueprint
                              </button>
                            )}
                            {dirty && (
                              <button
                                type="button"
                                onClick={() => handleSaveRole(role)}
                                disabled={isSaving}
                                className="text-[10px] font-bold text-[#009fe3] hover:text-[#008bc7] bg-sky-50 px-2 py-0.5 rounded border border-sky-200 hover:bg-sky-100 cursor-pointer"
                              >
                                {isSaving ? 'Saving...' : 'Save'}
                              </button>
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {matrixCategories.map((cat) => {
                  const permsInCat = Object.values(MASTER_PERMISSIONS).filter(
                    (p) => p.category === cat.key
                  );
                  if (permsInCat.length === 0) return null;

                  return (
                    <React.Fragment key={cat.key}>
                      {/* Category Separator Header */}
                      <tr className="bg-slate-50/50 border-t border-slate-100">
                        <td colSpan={displayRoles.length + 1} className="py-2.5 px-4 sm:px-6">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cat.badgeColor}`}>
                              {cat.badge}
                            </span>
                            <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
                              {cat.title}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Permission Rows */}
                      {permsInCat.map((perm) => {
                        return (
                          <tr
                            key={perm.code}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            {/* Left Column: Title & Description */}
                            <td className="py-3 px-4 sm:px-6">
                              <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                                <span>{perm.title}</span>
                                {perm.highRisk && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    High Risk
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                                {perm.desc}
                              </div>
                            </td>

                            {/* Role Cells */}
                            {displayRoles.map((role) => {
                              const isEnabled = role.permissions.includes(perm.code);
                              const isMobileFocused = mobileActiveRole === role.roleName;

                              // Medical Prescribing Invariant: visits.sign is strictly reserved for prescribers
                              const isRxSigning = perm.code === 'visits.sign';
                              const prescriberLocked = isRxSigning && !role.canPrescribe;

                              // System role classification
                              const sysConfig = SYSTEM_ROLE_CAPABILITY_CONFIG[role.roleName];
                              const isCore = sysConfig?.core.includes(perm.code);

                              return (
                                <td
                                  key={role.roleId}
                                  className={`py-3 px-3 sm:px-4 text-center align-middle transition-colors ${
                                    isMobileFocused ? 'bg-sky-50/15' : ''
                                  }`}
                                >
                                  {prescriberLocked ? (
                                    <div className="inline-flex flex-col items-center">
                                      <span
                                        className="text-slate-300 font-bold select-none text-xs inline-block"
                                        title="NMC Medical Prescribing: Reserved for certified doctors with valid registration number"
                                      >
                                        🔒 Locked
                                      </span>
                                      <span className="text-[8px] text-slate-400 mt-0.5">NMC Doctor Only</span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex flex-col items-center">
                                      <button
                                        type="button"
                                        onClick={() => togglePermission(role.roleId, perm.code)}
                                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                          isEnabled
                                            ? role.roleName === 'Doctor'
                                              ? 'bg-[#009fe3]'
                                              : role.roleName === 'Receptionist'
                                              ? 'bg-purple-600'
                                              : role.roleName === 'Pharmacist'
                                              ? 'bg-emerald-600'
                                              : 'bg-indigo-600'
                                            : 'bg-slate-300 hover:bg-slate-400'
                                        }`}
                                        title={`Toggle ${perm.title} for ${role.roleName}`}
                                      >
                                        <span
                                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                                          }`}
                                        />
                                      </button>
                                      {sysConfig ? (
                                        <span className="text-[9px] font-semibold text-slate-400 mt-0.5">
                                          {isCore ? 'Core' : 'Add-on'}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-semibold text-slate-400 mt-0.5">
                                          Custom
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* FLOATING SAVE BAR (Appears dynamically when changes are made) */}
      {/* ============================================================ */}
      {dirtyRoles.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-2xl bg-slate-900/95 backdrop-blur-md text-white p-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2.5 text-center sm:text-left">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-slate-200">
              Unsaved changes in{' '}
              <span className="font-bold text-white">
                {dirtyRoles.map((r) => r.roleName).join(', ')}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDiscardAll}
              disabled={savingAll}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Discard All
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={savingAll}
              className="px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-[#009fe3] hover:bg-[#008bc7] text-white transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              {savingAll ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save All Changes</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* CREATE CUSTOM ROLE MODAL                                     */}
      {/* ============================================================ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <ShieldCheckIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create Custom Role</h3>
                  <p className="text-xs text-slate-500">Add an operational role scoped to your clinic</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomRole} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Role Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nurse, Lab Technician, Accountant"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#009fe3]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  placeholder="Responsibilities and access scope for this role..."
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#009fe3]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Initial Capabilities</label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                  {Object.values(MASTER_PERMISSIONS)
                    .filter((p) => p.code !== 'org.manage' && p.code !== 'visits.sign')
                    .map((p) => {
                      const checked = newRolePerms.includes(p.code);
                      return (
                        <label
                          key={p.code}
                          className="flex items-start gap-2.5 cursor-pointer hover:bg-white p-1.5 rounded-lg transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setNewRolePerms((prev) =>
                                checked ? prev.filter((c) => c !== p.code) : [...prev, p.code]
                              );
                            }}
                            className="mt-0.5 rounded text-[#009fe3] focus:ring-[#009fe3]"
                          />
                          <div>
                            <div className="text-xs font-bold text-slate-800">{p.title}</div>
                            <div className="text-[10px] text-slate-500">{p.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRole || !newRoleName.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#008bc7] rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {creatingRole ? 'Creating Role...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
