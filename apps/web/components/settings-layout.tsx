'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBranch } from '../context/branch-context';
import { PortalSidebar } from './portal-sidebar';
import { PortalTopbar } from './portal-topbar';
import { SettingsNav, SettingsKey } from './settings-nav';
import { OwnerRouteGuard } from './owner-route-guard';

interface SettingsLayoutProps {
  children: React.ReactNode;
  user?: any;
  activeTab: SettingsKey;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function SettingsLayout({
  children,
  user,
  activeTab,
  title,
  description,
  action,
}: SettingsLayoutProps) {
  const { mode, currentUser } = useBranch();
  const router = useRouter();

  // If the owner switches to doctor mode while on settings, automatically route them to the Doctor portal
  useEffect(() => {
    if (mode === 'doctor') {
      router.push('/doctor');
    }
  }, [mode, router]);

  if (mode === 'doctor') {
    return (
      <div className="min-h-screen bg-[#f8fbfe] flex flex-col items-center justify-center font-sans">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <svg className="animate-spin h-5 w-5 text-[#009fe3]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Switching to Doctor Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <OwnerRouteGuard>
      <div className="min-h-screen bg-[#f8fbfe] font-sans selection:bg-[#009fe3] selection:text-white flex">
        {/* Left Navigation Sidebar */}
        <PortalSidebar portal="owner" activePath="settings" />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <PortalTopbar user={user || currentUser} currentPortal="owner" />

          {/* Settings Body */}
          <main className="flex-1 p-6 sm:p-8 max-w-[1500px] w-full mx-auto">
            {/* Settings Navigation Header */}
            <SettingsNav
              activeTab={activeTab}
              title={title}
              description={description}
              action={action}
            />

            {/* Page Content */}
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-200/60 bg-white py-3.5 px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 font-medium">
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
    </OwnerRouteGuard>
  );
}
