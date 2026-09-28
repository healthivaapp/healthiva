'use client';

import React, { useState, useRef, useEffect } from 'react';
import NextLink from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useBranch, Branch } from '../context/branch-context';
import { signOutUser } from '@healthiva/supabase';
import {
  SearchIcon,
  BellIcon,
  MessageSquareIcon,
  BuildingIcon,
  ChevronDownIcon,
  StethoscopeIcon,
  BarChartIcon,
  LogOutIcon,
  CheckCircleIcon,
  SettingsIcon,
  HelpCircleIcon,
  PhoneIcon,
  MailIcon,
  XIcon,
  MenuIcon,
} from './icons';
import { PortalType } from './portal-sidebar';

interface PortalTopbarProps {
  user?: any;
  currentPortal: PortalType;
  onSwitchPortal?: (portal: PortalType) => void;
}

export function PortalTopbar({ user, currentPortal, onSwitchPortal }: PortalTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    branches,
    activeBranch,
    setActiveBranch,
    isOwner,
    userRole,
    mode,
    toggleMode,
    setMode,
    currentUser,
    userProfile,
    specialty,
    organizationName,
    toggleMobileSidebar,
    loading,
  } = useBranch();

  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const branchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (branchRef.current && !branchRef.current.contains(event.target as Node)) {
        setBranchDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (roleRef.current && !roleRef.current.contains(event.target as Node)) {
        setRoleDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOutUser();
    window.location.replace('/login');
  };

  const handleModeToggle = () => {
    const nextMode = mode === 'doctor' ? 'owner' : 'doctor';
    setMode(nextMode);

    if (nextMode === 'doctor') {
      // Switching to Doctor Mode:
      // If currently on settings or dashboard, seamlessly navigate to Doctor Portal
      if (
        pathname.startsWith('/settings') ||
        pathname.startsWith('/organization-settings') ||
        pathname === '/dashboard'
      ) {
        router.push('/doctor');
      }
    } else if (nextMode === 'owner') {
      // Switching to Owner Mode:
      // If currently on doctor workspace, seamlessly navigate to Owner Dashboard
      if (pathname.startsWith('/doctor')) {
        router.push('/dashboard');
      }
    }
  };

  // Real authenticated user name with Dr. prefix for doctor mode
  const rawFullName =
    userProfile?.fullName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    currentUser?.user_metadata?.full_name ||
    currentUser?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    currentUser?.email?.split('@')[0] ||
    'Clinic Member';

  // Strip accidental "Dr." or "Dr " prefix if the user is NOT in doctor portal or role
  const isDoctorRole = currentPortal === 'doctor' || userRole === 'doctor' || (isOwner && mode === 'doctor');
  const cleanBaseName = rawFullName.replace(/^dr\.?\s*/i, '');
  const displayName = isDoctorRole ? `Dr. ${cleanBaseName}` : cleanBaseName;

  // Real clinical specialty (e.g. Pediatrician, Dentist, General Physician) or staff role
  const roleSubtitle =
    currentPortal === 'doctor'
      ? (specialty || 'General Physician')
      : currentPortal === 'receptionist'
      ? 'Receptionist'
      : currentPortal === 'pharmacy'
      ? 'Pharmacist'
      : isOwner
      ? 'Clinic Owner'
      : 'Staff Member';

  const getSearchPlaceholder = () => {
    switch (currentPortal) {
      case 'doctor':
        return 'Search patients, appointments...';
      case 'receptionist':
        return 'Search patients, phone, UHID...';
      case 'pharmacy':
        return 'Search medicine, prescription, patient...';
      case 'owner':
      default:
        return 'Search anything...';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-3.5 sm:px-6 flex items-center justify-between gap-2.5 sm:gap-4 sticky top-0 z-40 select-none">
      {/* Left: Mobile Hamburger Menu & Global Search Input */}
      <div className="flex items-center gap-2 flex-1 max-w-md min-w-0">
        <button
          onClick={toggleMobileSidebar}
          className="p-2 -ml-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 md:hidden"
          title="Open Navigation"
          aria-label="Open Navigation"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        <div className="relative flex-1 min-w-0">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={getSearchPlaceholder()}
            className="w-full pl-9 pr-3 sm:pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200/70 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#009fe3] focus:border-[#009fe3] transition-all"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Active Clinic Branch Selector Dropdown */}
        <div className="relative" ref={branchRef}>
          <button
            onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
            className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 transition-all cursor-pointer shadow-none"
            title="Switch Active Clinic Branch"
          >
            <BuildingIcon className="w-3.5 h-3.5 text-[#009fe3] shrink-0" />
            <span className="max-w-[85px] sm:max-w-[170px] truncate text-slate-900 font-extrabold">
              {activeBranch?.name || organizationName || (loading ? 'Loading...' : 'Clinic Branch')}
            </span>
            <ChevronDownIcon
              className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${branchDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {branchDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Switch Active Branch
                </span>
                <span className="text-[11px] font-bold text-[#009fe3] bg-sky-50 px-2 py-0.5 rounded-full">
                  {branches.filter((b: Branch) => b.is_active).length} Branches
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto py-1">
                {branches.filter((b: Branch) => b.is_active).length === 0 ? (
                  <div className="px-4 py-4 text-xs text-slate-400 text-center font-medium">
                    {loading ? 'Loading assigned branches...' : 'No branches assigned'}
                  </div>
                ) : (
                  branches
                    .filter((b: Branch) => b.is_active)
                    .map((b: Branch) => {
                      const isSelected = b.id === activeBranch?.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => {
                        setActiveBranch(b);
                        setBranchDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 flex items-start gap-2.5 transition-colors cursor-pointer ${
                        isSelected ? 'bg-sky-50 text-[#009fe3]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <BuildingIcon className="w-4 h-4 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate text-slate-900">{b.name}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#009fe3]" />}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {b.address || b.city || 'Active OPD Branch'}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

              {isOwner && mode === 'owner' && (
                <div className="pt-2 px-3 border-t border-slate-100">
                  <NextLink
                    href="/settings/branches"
                    onClick={() => setBranchDropdownOpen(false)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold text-[#009fe3] hover:bg-sky-50 transition-colors"
                  >
                    <span>+ Manage Branches</span>
                  </NextLink>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Portal Preview Switcher (Only visible to Owners in Owner Mode) */}
        {onSwitchPortal && isOwner && mode === 'owner' && (
          <div className="relative hidden sm:block shrink-0" ref={roleRef}>
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer w-[140px] shrink-0"
              title="Switch Portal View"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] text-slate-400 font-semibold shrink-0">Portal:</span>
                <span className="capitalize text-[#009fe3] truncate">
                  {currentPortal === 'owner' ? 'Owner' : currentPortal}
                </span>
              </div>
              <ChevronDownIcon className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50">
                {(['doctor', 'receptionist', 'pharmacy', 'owner'] as PortalType[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      onSwitchPortal(p);
                      setRoleDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs font-bold capitalize flex items-center justify-between cursor-pointer ${
                      currentPortal === p ? 'bg-sky-50 text-[#009fe3]' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>{p === 'owner' ? 'Admin / Owner' : p}</span>
                    {currentPortal === p && <CheckCircleIcon className="w-3.5 h-3.5 text-[#009fe3]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 1-Click Doctor Mode ⇄ Owner Mode Switcher for Owners */}
        {isOwner && (
          <button
            onClick={handleModeToggle}
            className={`hidden md:flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-none border w-[125px] shrink-0 ${
              mode === 'doctor'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100/70'
                : 'bg-[#042451] text-white border-[#042451] hover:bg-[#07326d]'
            }`}
            title="1-Click Mode Toggle"
          >
            {mode === 'doctor' ? (
              <>
                <StethoscopeIcon className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="truncate">Doctor Mode</span>
              </>
            ) : (
              <>
                <BarChartIcon className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="truncate">Owner Mode</span>
              </>
            )}
          </button>
        )}

        {/* Notification Bell */}
        <button
          className="relative w-8 h-8 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 transition-colors cursor-pointer shrink-0 hidden sm:flex items-center justify-center"
          title="Notifications"
        >
          <BellIcon className="w-4 h-4 shrink-0" />
          <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
        </button>

        {/* Direct Messages */}
        <button
          className="relative w-8 h-8 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 transition-colors cursor-pointer shrink-0 hidden sm:flex items-center justify-center"
          title="Messages"
        >
          <MessageSquareIcon className="w-4 h-4 shrink-0" />
        </button>

        {/* Help & Support Button */}
        <button
          onClick={() => setHelpModalOpen(true)}
          className="relative w-8 h-8 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 transition-colors cursor-pointer shrink-0 hidden sm:flex items-center justify-center"
          title="Help & Support"
        >
          <HelpCircleIcon className="w-4 h-4 shrink-0" />
        </button>

        {/* User Profile Tag & Dropdown */}
        <div className="relative shrink-0" ref={profileRef}>
          <button
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 p-1 sm:pl-2 sm:pr-2.5 sm:py-1 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer w-auto lg:w-[185px] shrink-0 text-left"
          >
            <div className="w-8 h-8 rounded-full bg-[#042451] text-white text-xs font-extrabold flex items-center justify-center ring-2 ring-sky-100 shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:flex flex-col text-left w-[115px] shrink-0 min-w-0">
              <span className="text-xs font-bold text-slate-900 leading-tight truncate">
                {displayName}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold truncate leading-tight mt-0.5">
                {roleSubtitle}
              </span>
            </div>
            <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400 hidden lg:block shrink-0 ml-auto" />
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                <p className="text-[10px] text-slate-400">{user?.email || 'Logged In'}</p>
              </div>

              {isOwner && (
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    handleModeToggle();
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer md:hidden"
                >
                  <div className="flex items-center gap-2">
                    {mode === 'doctor' ? (
                      <BarChartIcon className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <StethoscopeIcon className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>{mode === 'doctor' ? 'Switch to Owner Mode' : 'Switch to Doctor Mode'}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold">
                    {mode === 'doctor' ? 'Doctor' : 'Owner'}
                  </span>
                </button>
              )}


              <button
                onClick={() => {
                  setProfileDropdownOpen(false);
                  setHelpModalOpen(true);
                }}
                className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <HelpCircleIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Help & Support</span>
              </button>

              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer border-t border-slate-100 mt-1"
              >
                <LogOutIcon className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Help & Support Modal */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-[#009fe3] flex items-center justify-center">
                  <HelpCircleIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Healthiva Help & Support</h3>
                  <p className="text-xs text-slate-400">Dedicated 24/7 clinic assistance</p>
                </div>
              </div>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <PhoneIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Phone / WhatsApp Helpline</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">+91 98765 43210</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-[#009fe3] flex items-center justify-center shrink-0">
                  <MailIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email Support</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">support@healthiva.in</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <BuildingIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Clinic & Multi-Branch Setup</div>
                  <div className="text-xs font-semibold text-slate-700 mt-0.5">Need help configuring staff branch scopes? We can guide you live.</div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>All Systems Operational</span>
              </div>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="bg-[#009fe3] hover:bg-[#008bc7] text-white font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
