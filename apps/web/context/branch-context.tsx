'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentUser, getSupabaseClient } from '@healthiva/supabase';

export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  city: string | null;
  is_active: boolean;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  mobile?: string | null;
  specialty?: string | null;
}

export function formatSpecialtyTitle(raw?: string | null): string {
  if (!raw) return 'General Physician';
  const s = raw.toLowerCase().trim();
  if (s.includes('pediatric')) return 'Pediatrician';
  if (s.includes('dental')) return 'Dentist';
  if (s.includes('eye') || s.includes('ophthalm')) return 'Ophthalmologist';
  if (s.includes('ent')) return 'ENT Specialist';
  if (s.includes('ortho')) return 'Orthopedic Specialist';
  if (s.includes('derma')) return 'Dermatologist';
  if (s.includes('gynec') || s.includes('obgyn')) return 'Gynecologist';
  if (s.includes('cardio')) return 'Cardiologist';
  if (s.includes('ayurved')) return 'Ayurvedic Physician';
  if (s.includes('homeo')) return 'Homeopathic Physician';
  if (s.includes('physio')) return 'Physiotherapist';
  if (s.includes('general') || s.includes('opd') || s.includes('family')) return 'General Physician';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export type SystemRole = 'owner' | 'doctor' | 'receptionist' | 'pharmacist';
export type AppMode = 'doctor' | 'owner';

interface BranchContextType {
  branches: Branch[];
  activeBranch: Branch | null;
  setActiveBranch: (branch: Branch) => void;
  refreshBranches: () => Promise<void>;
  loading: boolean;
  isOwner: boolean;
  isPrimaryOwner: boolean;
  userRole: SystemRole;
  userPermissions: string[];
  hasPermission: (key: string) => boolean;
  mode: AppMode;
  toggleMode: () => void;
  setMode: (mode: AppMode) => void;
  currentUser: any;
  userProfile: UserProfile | null;
  specialty: string;
  organizationName: string;
  logoUrl: string | null;
  updateLogoUrl: (url: string | null) => void;
  isSuspended: boolean;
  suspendedReason: string | null;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranchState] = useState<Branch | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOwner, setIsOwner] = useState<boolean>(true); // Default true during initial owner provisioning
  const [isPrimaryOwner, setIsPrimaryOwner] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<SystemRole>('owner');
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [mode, setModeState] = useState<AppMode>('owner');

  const [isSuspended, setIsSuspended] = useState<boolean>(false);
  const [suspendedReason, setSuspendedReason] = useState<string | null>(null);

  const hasPermission = useCallback(
    (key: string): boolean => {
      if (isOwner) return true;
      return userPermissions.includes(key);
    },
    [isOwner, userPermissions]
  );
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [specialty, setSpecialty] = useState<string>('General Physician');
  const [organizationName, setOrganizationName] = useState<string>('Healthiva Clinic');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen((prev) => !prev);
  };

  const updateLogoUrl = useCallback((newUrl: string | null) => {
    if (newUrl) {
      const stamped = newUrl.includes('?') ? newUrl : `${newUrl}?v=${Date.now()}`;
      setLogoUrl(stamped);
    } else {
      setLogoUrl(null);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('healthiva_sidebar_collapsed');
      if (saved === 'true') {
        setSidebarCollapsedState(true);
      }
    }
  }, []);

  const setSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('healthiva_sidebar_collapsed', String(collapsed));
    }
  };

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
  };

  // Load user role, operating mode, and branches
  const refreshBranches = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUser(user);

      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/branches', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

        if (data.isSuspended) {
          setIsSuspended(true);
          setSuspendedReason(data.error || 'Your staff account has been suspended by the clinic owner.');
          setLoading(false);
          return;
        } else {
          setIsSuspended(false);
          setSuspendedReason(null);
        }

        if (data.success && Array.isArray(data.branches)) {
          setBranches(data.branches);
          const resolvedRole: SystemRole = (data.userRole || 'owner').toLowerCase() as SystemRole;
          const ownerCheck = Boolean(data.isOwner ?? (resolvedRole === 'owner'));
          const primaryCheck = Boolean(data.isPrimaryOwner ?? ownerCheck);

          setUserRole(resolvedRole);
          setIsOwner(ownerCheck);
          setIsPrimaryOwner(primaryCheck);
          if (Array.isArray(data.userPermissions)) {
            setUserPermissions(data.userPermissions);
          }

          // Populate real user profile and specialty
          const resolvedName =
            data.profile?.full_name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Clinic Member';

          const rawSpecialty = data.specialty || user.user_metadata?.specialty || null;

          setUserProfile({
            id: user.id,
            fullName: resolvedName,
            email: data.profile?.email || user.email || '',
            mobile: data.profile?.mobile || user.user_metadata?.mobile || null,
            specialty: rawSpecialty,
          });

          if (rawSpecialty) {
            setSpecialty(formatSpecialtyTitle(rawSpecialty));
          }

          if (data.organizationName) {
            setOrganizationName(data.organizationName);
          }

          if (data.logoUrl) {
            setLogoUrl(data.logoUrl);
          } else if (user.user_metadata?.logo_url) {
            setLogoUrl(user.user_metadata.logo_url);
          } else {
            setLogoUrl(null);
          }

          // Load mode from localStorage if user is owner
          const savedMode = typeof window !== 'undefined' ? localStorage.getItem('healthiva_app_mode') : null;
          if (savedMode === 'doctor' || savedMode === 'owner') {
            setModeState(savedMode);
          } else if (!ownerCheck) {
            // If not owner, lock to doctor mode if doctor, or owner mode
            setModeState(resolvedRole === 'doctor' ? 'doctor' : 'owner');
          }

          // Determine active branch: User-scoped storage key prevents cross-account branch leakage
          const userStorageKey = user?.id ? `healthiva_active_branch_id_${user.id}` : 'healthiva_active_branch_id';
          const activeBranches = data.branches.filter((b: Branch) => b.is_active);
          const userSavedBranchId = typeof window !== 'undefined' ? localStorage.getItem(userStorageKey) : null;

          const defaultBranch = data.defaultClinicId
            ? activeBranches.find((b: Branch) => b.id === data.defaultClinicId)
            : null;

          const matchedUserSavedBranch = activeBranches.find((b: Branch) => b.id === userSavedBranchId);

          // Priority order:
          // 1. Assigned Default Primary Branch (always auto-selected on login when set by owner)
          // 2. User's manually saved active branch for this specific user ID
          // 3. Fallback to MAIN code or first available active branch
          if (defaultBranch) {
            setActiveBranchState(defaultBranch);
            if (typeof window !== 'undefined') {
              localStorage.setItem(userStorageKey, defaultBranch.id);
            }
          } else if (matchedUserSavedBranch) {
            setActiveBranchState(matchedUserSavedBranch);
          } else if (activeBranches.length > 0) {
            const fallbackBranch = activeBranches.find((b: Branch) => b.code === 'MAIN') || activeBranches[0];
            setActiveBranchState(fallbackBranch);
            if (typeof window !== 'undefined') {
              localStorage.setItem(userStorageKey, fallbackBranch.id);
            }
          }
        }
    } catch (err) {
      console.error('[BranchContext refreshBranches error]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBranches();

    // Revalidate permissions & branch state when user switches tabs or returns to the window
    const handleFocus = () => {
      refreshBranches();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshBranches();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshBranches]);

  const setActiveBranch = (branch: Branch) => {
    setActiveBranchState(branch);
    if (typeof window !== 'undefined') {
      const userStorageKey = currentUser?.id ? `healthiva_active_branch_id_${currentUser.id}` : 'healthiva_active_branch_id';
      localStorage.setItem(userStorageKey, branch.id);
      localStorage.setItem('healthiva_active_branch_id', branch.id);
    }
  };

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('healthiva_app_mode', newMode);
    }
  };

  const toggleMode = () => {
    const nextMode = mode === 'doctor' ? 'owner' : 'doctor';
    setMode(nextMode);
  };

  useEffect(() => {
    const handleLogoEvent = (e: any) => {
      if (e?.detail?.logoUrl !== undefined) {
        updateLogoUrl(e.detail.logoUrl);
      } else {
        refreshBranches();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('healthiva:logo_updated', handleLogoEvent);
      return () => window.removeEventListener('healthiva:logo_updated', handleLogoEvent);
    }
  }, [updateLogoUrl, refreshBranches]);

  return (
    <BranchContext.Provider
      value={{
        branches,
        activeBranch,
        setActiveBranch,
        refreshBranches,
        loading,
        isOwner,
        isPrimaryOwner,
        userRole,
        userPermissions,
        hasPermission,
        mode,
        toggleMode,
        setMode,
        currentUser,
        userProfile,
        specialty,
        organizationName,
        logoUrl,
        updateLogoUrl,
        isSuspended,
        suspendedReason,
        sidebarCollapsed,
        toggleSidebar,
        setSidebarCollapsed,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        toggleMobileSidebar,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch(): BranchContextType {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}
