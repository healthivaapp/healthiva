'use client';

import React from 'react';
import NextLink from 'next/link';
import { useBranch } from '../context/branch-context';
import { ShieldCheckIcon } from './icons';

import { HealthivaScreenLoader } from './healthiva-screen-loader';

export function OwnerRouteGuard({ children }: { children: React.ReactNode }) {
  const { isOwner, isAdministrator, loading, userRole } = useBranch();

  if (loading) {
    return (
      <HealthivaScreenLoader
        message="Verifying clinic permissions..."
        subMessage="Validating governance authority and administrative roles"
        fullScreen={false}
      />
    );
  }

  if (!isOwner && !isAdministrator) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 p-8 text-center shadow-lg">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4">
            <ShieldCheckIcon className="w-8 h-8 text-rose-600" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2">
            Access Restricted: Owner Only
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6">
            You are currently signed in with the <strong className="capitalize text-slate-700">{userRole}</strong> role. Clinic branch locations, staff permissions, and financial configurations are accessible only to the Clinic Owner.
          </p>
          <NextLink
            href="/dashboard"
            className="inline-flex items-center justify-center w-full bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-none"
          >
            ← Return to Clinic Dashboard
          </NextLink>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
