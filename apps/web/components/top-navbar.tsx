'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import NextLink from 'next/link';
import { useBranch, Branch } from '../context/branch-context';
import { signOutUser } from '@healthiva/supabase';
import {
  BuildingIcon,
  ChevronDownIcon,
  SettingsIcon,
  StethoscopeIcon,
  BarChartIcon,
  UsersIcon,
  ShieldCheckIcon,
  BoxesIcon,
  FileTextIcon,
  LogOutIcon,
  GridIcon,
} from './icons';

interface TopNavbarProps {
  user?: any;
}

export function TopNavbar({ user }: TopNavbarProps) {
  const {
    branches,
    activeBranch,
    setActiveBranch,
    isOwner,
    userRole,
    mode,
    toggleMode,
  } = useBranch();

  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);

  const branchRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (branchRef.current && !branchRef.current.contains(event.target as Node)) {
        setBranchDropdownOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOutUser();
    window.location.replace('/login');
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Clinic User';

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-50 shadow-2xs font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <NextLink href="/dashboard" className="inline-block group py-1">
            <div className="relative w-40 sm:w-52 h-11 sm:h-12">
              <Image
                src="/healthiva-logo.png"
                alt="Healthiva"
                fill
                className="object-contain object-left scale-105 origin-left"
                priority
                unoptimized
              />
            </div>
          </NextLink>
        </div>

        {/* Center: Real-Time Active Branch Switcher */}
        <div className="flex items-center gap-3">
          <div className="relative" ref={branchRef}>
            <button
              onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
              className="flex items-center gap-2 bg-slate-50 hover:bg-sky-50/60 border border-slate-200 hover:border-[#009fe3]/40 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-800 transition-all cursor-pointer shadow-none"
              title="Switch Active Clinic Branch"
            >
              <BuildingIcon className="w-4 h-4 text-[#009fe3]" />
              <span className="max-w-[130px] sm:max-w-[200px] truncate text-slate-900 font-extrabold">
                {activeBranch?.name || 'Main Branch'}
              </span>
              <ChevronDownIcon
                className={`w-4 h-4 text-slate-400 transition-transform ${branchDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown Menu */}
            {branchDropdownOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Switch Active Branch
                  </span>
                  <span className="text-[11px] font-bold text-[#009fe3] bg-sky-50 px-2 py-0.5 rounded-full">
                    {branches.length} {branches.length === 1 ? 'Branch' : 'Branches'}
                  </span>
                </div>

                <div className="max-h-64 overflow-y-auto py-1">
                  {branches.map((b: Branch) => {
                    const isSelected = b.id === activeBranch?.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          setActiveBranch(b);
                          setBranchDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors cursor-pointer ${
                          isSelected ? 'bg-sky-50/80 text-[#009fe3]' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <BuildingIcon className="w-4 h-4 mt-0.5 shrink-0 text-[#009fe3]" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold truncate text-slate-900">
                              {b.name}
                            </span>
                            {isSelected && (
                              <span className="w-2 h-2 rounded-full bg-[#009fe3] shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {b.address || b.city || 'No address set'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {isOwner && (
                  <div className="pt-2 px-3 border-t border-slate-100">
                    <NextLink
                      href="/settings/branches"
                      onClick={() => setBranchDropdownOpen(false)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-[#009fe3] hover:bg-sky-50 transition-colors"
                    >
                      <span>+ Manage or Add Branches</span>
                    </NextLink>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 1-Click Doctor / Owner Mode Toggle (Owners only) */}
          {isOwner && (
            <button
              onClick={toggleMode}
              className={`hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-none border ${
                mode === 'doctor'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100/70'
                  : 'bg-[#042451] text-white border-[#042451] hover:bg-[#07326d]'
              }`}
              title="Click to toggle between Doctor Mode and Owner Mode"
            >
              {mode === 'doctor' ? (
                <>
                  <StethoscopeIcon className="w-4 h-4 text-emerald-700" />
                  <span>Doctor Mode</span>
                </>
              ) : (
                <>
                  <BarChartIcon className="w-4 h-4 text-white" />
                  <span>Owner Mode</span>
                </>
              )}
              <span className="text-[10px] opacity-75 font-normal">⇄ Switch</span>
            </button>
          )}
        </div>

        {/* Right: Settings Quick Menu & Profile Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Owner Settings Quick Dropdown */}
          {isOwner && (
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#009fe3] bg-slate-50 hover:bg-sky-50/60 border border-slate-200 hover:border-sky-200 px-3 py-2 rounded-xl transition-all cursor-pointer shadow-none"
              >
                <SettingsIcon className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Settings</span>
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${settingsDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {settingsDropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    Clinic Configurations
                  </div>

                  <NextLink
                    href="/settings"
                    onClick={() => setSettingsDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#009fe3] transition-colors"
                  >
                    <GridIcon className="w-4 h-4 text-slate-400" />
                    <span>All Settings Overview</span>
                  </NextLink>

                  <NextLink
                    href="/organization-settings"
                    onClick={() => setSettingsDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#009fe3] transition-colors"
                  >
                    <FileTextIcon className="w-4 h-4 text-slate-400" />
                    <span>Clinic Branding & Fees</span>
                  </NextLink>

                  <NextLink
                    href="/settings/branches"
                    onClick={() => setSettingsDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#009fe3] transition-colors"
                  >
                    <BuildingIcon className="w-4 h-4 text-slate-400" />
                    <span>Manage Branch</span>
                  </NextLink>

                  <NextLink
                    href="/settings/staff"
                    onClick={() => setSettingsDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#009fe3] transition-colors"
                  >
                    <UsersIcon className="w-4 h-4 text-slate-400" />
                    <span>Staff & Branch Scopes</span>
                  </NextLink>

                  <NextLink
                    href="/settings/roles"
                    onClick={() => setSettingsDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#009fe3] transition-colors"
                  >
                    <ShieldCheckIcon className="w-4 h-4 text-slate-400" />
                    <span>Role Capability Toggles</span>
                  </NextLink>

                  <NextLink
                    href="/settings/fields"
                    onClick={() => setSettingsDropdownOpen(false)}
                    className="flex items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#009fe3] transition-colors border-t border-slate-100"
                  >
                    <div className="flex items-center gap-2.5">
                      <BoxesIcon className="w-4 h-4 text-slate-400" />
                      <span>Dynamic Fields</span>
                    </div>
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                      Soon
                    </span>
                  </NextLink>
                </div>
              )}
            </div>
          )}

          {/* User Profile Tag */}
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[140px]">
              {displayName}
            </span>
            <span className="text-[11px] text-[#009fe3] font-semibold capitalize">
              {userRole === 'owner' ? 'Owner / Admin' : userRole}
            </span>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 px-3 py-2 rounded-xl transition-colors cursor-pointer shadow-none"
          >
            <LogOutIcon className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

      </div>
    </header>
  );
}
