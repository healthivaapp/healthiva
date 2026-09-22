'use client';

import React, { useState, useEffect } from 'react';
import { PortalSidebar, PortalType } from './portal-sidebar';
import { PortalTopbar } from './portal-topbar';
import { useBranch } from '../context/branch-context';

interface PortalLayoutProps {
  children?: React.ReactNode;
  user?: any;
  defaultPortal?: PortalType;
  renderPortal?: (portal: PortalType) => React.ReactNode;
}

export function PortalLayout({
  children,
  user,
  defaultPortal,
  renderPortal,
}: PortalLayoutProps) {
  const { userRole, mode, isOwner, isSuspended, suspendedReason } = useBranch();

  // Determine initial portal based on mode or user role
  const getInitialPortal = (): PortalType => {
    if (defaultPortal) return defaultPortal;
    if (userRole === 'receptionist') return 'receptionist';
    if (userRole === 'pharmacist') return 'pharmacy';
    if (userRole === 'doctor') return 'doctor';
    if (isOwner) {
      return mode === 'doctor' ? 'doctor' : 'owner';
    }
    return 'owner';
  };

  const [activePortal, setActivePortal] = useState<PortalType>(getInitialPortal);

  // Sync with mode changes if owner toggles mode
  useEffect(() => {
    if (isOwner && !defaultPortal) {
      setActivePortal(mode === 'doctor' ? 'doctor' : 'owner');
    }
  }, [mode, isOwner, defaultPortal]);

  if (isSuspended) {
    return (
      <div className="min-h-screen bg-[#f8fbfe] font-sans selection:bg-[#009fe3] selection:text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        {/* Top: Official Healthiva Brand Header */}
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
          <div className="relative w-40 sm:w-48 h-10 sm:h-12">
            <img 
              src="/healthiva-logo.png" 
              alt="Healthiva — Run Your Clinic Smarter." 
              className="w-full h-full object-contain object-left"
            />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-200/80 rounded-full text-[11px] font-bold text-rose-600 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            Access Suspended
          </div>
        </div>

        {/* Center: Main High-End Vector Card */}
        <div className="w-full max-w-lg mx-auto my-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl shadow-slate-200/50 p-6 sm:p-10 text-center relative overflow-hidden">
            {/* Background Vector Accent Gradient */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#009fe3]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Vector Lock Graphic Badge */}
            <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <div className="absolute inset-0 bg-rose-100/80 rounded-3xl rotate-6 transition-transform group-hover:rotate-12" />
              <div className="absolute inset-0 bg-gradient-to-tr from-rose-500 to-rose-400 rounded-3xl shadow-lg shadow-rose-500/30 flex items-center justify-center text-white">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>

            {/* Status Header */}
            <div className="space-y-2 mb-6">
              <span className="inline-block px-3 py-1 bg-rose-50 text-rose-600 text-xs font-bold uppercase tracking-widest rounded-full border border-rose-100">
                ACCOUNT ACCESS SUSPENDED
              </span>
              <h2 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
                Staff Portal Access Blocked
              </h2>
              <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-md mx-auto pt-1">
                {suspendedReason || 'Your staff access account has been suspended by the clinic owner. Please contact your clinic administrator to restore your access.'}
              </p>
            </div>

            {/* Vector Notice Info Box */}
            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 text-left mb-6 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-xs text-slate-600 leading-normal">
                <span className="font-bold text-slate-800 block mb-0.5">Need assistance?</span>
                If you believe this is an error, please reach out directly to your clinic manager or owner to update your account status.
              </div>
            </div>

            {/* Sign Out Action Button */}
            <button
              onClick={async () => {
                if (typeof window !== 'undefined') {
                  const { getSupabaseClient } = await import('@healthiva/supabase');
                  const supabase = getSupabaseClient();
                  await supabase.auth.signOut();
                  window.location.href = '/login';
                }
              }}
              className="group relative overflow-hidden w-full bg-[#009fe3] hover:bg-[#008bc7] text-white font-sans font-bold text-sm sm:text-[15px] py-3.5 px-6 rounded-xl shadow-md shadow-[#009fe3]/20 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              <span className="relative z-10 flex items-center gap-2">
                <span>Sign Out & Return to Login</span>
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </span>
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-in-out" />
            </button>
          </div>
        </div>

        {/* Bottom: Official Footer */}
        <div className="text-center text-xs text-slate-400 font-medium py-2">
          © {new Date().getFullYear()} Healthiva Inc. · Run Your Clinic Smarter.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fbfe] font-sans selection:bg-[#009fe3] selection:text-white flex">
      {/* Left Navigation Sidebar */}
      <PortalSidebar portal={activePortal} activePath="dashboard" />

      {/* Main Right Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <PortalTopbar
          user={user}
          currentPortal={activePortal}
          onSwitchPortal={(p) => setActivePortal(p)}
        />

        {/* Dynamic Portal Body */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-[1500px] w-full mx-auto overflow-x-hidden">
          {renderPortal ? renderPortal(activePortal) : children}
        </main>

        {/* Clean Vector Footer */}
        <footer className="border-t border-slate-200/60 bg-white py-3 px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#042451] tracking-tight">HEALTHIVA</span>
            <span>·</span>
            <span>Run Your Clinic Smarter.</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 sm:mt-0">
            Smarter Clinics. Healthier Communities.
          </div>
        </footer>
      </div>
    </div>
  );
}
