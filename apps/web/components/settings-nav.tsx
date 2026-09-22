'use client';

import React from 'react';
import NextLink from 'next/link';

export type SettingsKey = 'all' | 'branding' | 'branches' | 'staff' | 'roles' | 'fields';

interface SettingsNavProps {
  activeTab: SettingsKey;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function SettingsNav({ activeTab, title, description, action }: SettingsNavProps) {
  return (
    <div className="mb-6">
      {/* Top Title & Header Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <NextLink href="/dashboard" className="hover:text-[#009fe3] transition-colors">
              Dashboard
            </NextLink>
            <span>/</span>
            <NextLink href="/settings" className="hover:text-[#009fe3] transition-colors">
              Settings
            </NextLink>
            {title && title !== 'Clinic Settings' && title !== 'Clinic Settings Hub' && (
              <>
                <span>/</span>
                <span className="text-slate-600 font-bold">{title}</span>
              </>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {title || 'Clinic Settings'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {description || 'Manage your clinic identity, multi-branch network, staff permissions and workflow rules.'}
          </p>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
