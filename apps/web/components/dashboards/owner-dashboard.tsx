'use client';

import React from 'react';
import NextLink from 'next/link';
import { useBranch } from '../../context/branch-context';
import {
  RupeeIcon,
  CalendarIcon,
  UserPlusIcon,
  PercentIcon,
  TrendingUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  ActivityIcon,
  ClockIcon,
  AlertTriangleIcon,
  PillIcon,
  BuildingIcon,
  UsersIcon,
  SettingsIcon,
  ShieldCheckIcon,
} from '../icons';

interface OwnerDashboardProps {
  user?: any;
  activeBranch?: any;
}

export function OwnerDashboard({ user, activeBranch }: OwnerDashboardProps) {
  const { userProfile, currentUser } = useBranch();
  const rawOwnerName =
    userProfile?.fullName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    currentUser?.user_metadata?.full_name ||
    currentUser?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Clinic Doctor';

  const ownerDoctorName =
    rawOwnerName.toLowerCase().startsWith('dr.') || rawOwnerName.toLowerCase().startsWith('dr ')
      ? rawOwnerName
      : `Dr. ${rawOwnerName}`;
  return (
    <div className="space-y-6">
      {/* Top Greeting & Export Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Clinic Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Complete view of your clinic's performance · Viewing {activeBranch?.name || 'All Branches'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>1 Sep 2025 - 8 Sep 2025</span>
            <ChevronDownIcon className="w-3 h-3 text-slate-400" />
          </div>

          <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs font-bold transition-colors cursor-pointer shadow-none">
            <DownloadIcon className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* 4 Financial & Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Total Revenue</span>
            <div className="text-2xl font-black text-slate-900 mt-1">₹ 4.82L</div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1">
              <TrendingUpIcon className="w-3 h-3" />
              <span>18% from previous week</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <RupeeIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Total Appointments</span>
            <div className="text-2xl font-black text-slate-900 mt-1">1,248</div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1">
              <TrendingUpIcon className="w-3 h-3" />
              <span>12% from previous week</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-[#009fe3] flex items-center justify-center shrink-0 border border-sky-100">
            <CalendarIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">New Patients</span>
            <div className="text-2xl font-black text-slate-900 mt-1">186</div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1">
              <TrendingUpIcon className="w-3 h-3" />
              <span>20% from previous week</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-[#009fe3] flex items-center justify-center shrink-0 border border-sky-100">
            <UserPlusIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Collection Rate</span>
            <div className="text-2xl font-black text-slate-900 mt-1">94.6%</div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1">
              <TrendingUpIcon className="w-3 h-3" />
              <span>2.4% from previous week</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <PercentIcon className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Charts & Operational Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Revenue/Collections & Appointments by Doctor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue & Collections Chart Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Revenue & Collections
                </h2>
                <div className="flex items-center gap-4 text-xs font-bold mt-1">
                  <div className="flex items-center gap-1.5 text-[#009fe3]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#009fe3]" />
                    <span>Revenue</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#042451]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#042451]" />
                    <span>Collections</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
                <span>Last 7 Days</span>
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              </div>
            </div>

            {/* SVG Dual Spline Chart */}
            <div className="relative pt-4">
              <svg viewBox="0 0 500 130" className="w-full h-36 overflow-visible">
                {/* Horizontal Grid lines */}
                <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="55" x2="500" y2="55" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="90" x2="500" y2="90" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="120" x2="500" y2="120" stroke="#f1f5f9" strokeWidth="1" />

                {/* Line 1: Revenue (Sky Blue) */}
                <path
                  d="M 0 100 Q 70 85, 100 80 T 200 65 T 300 45 T 400 35 T 500 25"
                  fill="none"
                  stroke="#009fe3"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Line 2: Collections (Dark Navy) */}
                <path
                  d="M 0 110 Q 70 95, 100 90 T 200 78 T 300 55 T 400 45 T 500 35"
                  fill="none"
                  stroke="#042451"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Points */}
                {[
                  { cx: 0, r1: 100, r2: 110 },
                  { cx: 100, r1: 80, r2: 90 },
                  { cx: 200, r1: 65, r2: 78 },
                  { cx: 300, r1: 45, r2: 55 },
                  { cx: 400, r1: 35, r2: 45 },
                  { cx: 500, r1: 25, r2: 35 },
                ].map((pt, i) => (
                  <g key={i}>
                    <circle cx={pt.cx} cy={pt.r1} r="3" fill="#ffffff" stroke="#009fe3" strokeWidth="2" />
                    <circle cx={pt.cx} cy={pt.r2} r="3" fill="#ffffff" stroke="#042451" strokeWidth="2" />
                  </g>
                ))}
              </svg>

              <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 px-1">
                <span>1 Sep</span>
                <span>2 Sep</span>
                <span>3 Sep</span>
                <span>4 Sep</span>
                <span>5 Sep</span>
                <span>6 Sep</span>
                <span>7 Sep</span>
                <span>8 Sep</span>
              </div>
            </div>
          </div>

          {/* Appointments by Doctor Bar Chart Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Appointments by Doctor
              </h2>
              <div className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
                <span>Last 7 Days</span>
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              </div>
            </div>

            {/* Vertical Bar Chart */}
            <div className="h-44 flex items-end justify-around gap-4 pt-6 px-4">
              {[
                { name: ownerDoctorName, count: 320, height: '100%' },
                { name: 'Dr. Mehta', count: 280, height: '87%' },
                { name: 'Dr. Shah', count: 240, height: '75%' },
                { name: 'Dr. Khan', count: 180, height: '56%' },
                { name: 'Dr. Iyer', count: 90, height: '28%' },
              ].map((doc) => (
                <div key={doc.name} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <span className="text-[11px] font-black text-slate-800">{doc.count}</span>
                  <div
                    className="w-full max-w-[48px] bg-[#009fe3] hover:bg-[#008bc7] rounded-t-lg transition-all"
                    style={{ height: doc.height }}
                  />
                  <span className="text-xs font-bold text-slate-600 truncate mt-1">
                    {doc.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Patient Growth Curve Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Patient Growth
                </h2>
                <div className="text-xs font-semibold text-slate-400">
                  Total Patients: <strong className="text-slate-900">892</strong> <span className="text-emerald-600 font-bold">(↑ 28%)</span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
                <span>Last 6 Months</span>
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              </div>
            </div>

            <div className="relative pt-4">
              <svg viewBox="0 0 500 100" className="w-full h-24 overflow-visible">
                <path
                  d="M 0 85 Q 100 75, 150 70 T 250 55 T 350 40 T 500 15"
                  fill="none"
                  stroke="#009fe3"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {[
                  { cx: 0, cy: 85 },
                  { cx: 100, cy: 75 },
                  { cx: 200, cy: 62 },
                  { cx: 300, cy: 48 },
                  { cx: 400, cy: 30 },
                  { cx: 500, cy: 15 },
                ].map((pt, i) => (
                  <circle key={i} cx={pt.cx} cy={pt.cy} r="3" fill="#ffffff" stroke="#009fe3" strokeWidth="2" />
                ))}
              </svg>

              <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-1 px-1">
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
                <span>Aug</span>
                <span>Sep</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Clinic Health, Action Required, and Setup Checklist */}
        <div className="space-y-6">
          {/* Clinic Health Indicators */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <h3 className="text-sm font-extrabold text-slate-900 mb-3">
              Clinic Health
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <ActivityIcon className="w-4 h-4 text-[#009fe3]" />
                  <span>Room Utilization</span>
                </div>
                <span className="font-black text-slate-900">72%</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <AlertTriangleIcon className="w-4 h-4 text-amber-500" />
                  <span>No-show Rate</span>
                </div>
                <span className="font-black text-slate-900">6.4%</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <ClockIcon className="w-4 h-4 text-indigo-500" />
                  <span>Average Wait Time</span>
                </div>
                <span className="font-black text-slate-900">14 min</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-700 font-bold">
                  <PillIcon className="w-4 h-4 text-emerald-600" />
                  <span>Pharmacy Stock Value</span>
                </div>
                <span className="font-black text-slate-900">₹ 3.12L</span>
              </div>
            </div>
          </div>

          {/* Action Required Priority Box */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Action Required
                </h3>
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center">
                  6
                </span>
              </div>
              <span className="text-xs font-bold text-[#009fe3] hover:underline cursor-pointer">
                View All
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 text-rose-800">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangleIcon className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>4 Overdue invoices (₹ 18,250)</span>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 text-amber-800">
                <div className="flex items-center gap-2 font-bold">
                  <PillIcon className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>2 Low inventory items</span>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-700">
                <div className="flex items-center gap-2 font-bold">
                  <CalendarIcon className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>1 Doctor schedule gap (Fri, 12 Sep)</span>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-700">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldCheckIcon className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>2 Staff document expiring</span>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            </div>
          </div>

          {/* Quick Clinic Setup Checklist (Preserving direct links into settings!) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <h3 className="text-sm font-extrabold text-slate-900 mb-3">
              Clinic Setup Modules
            </h3>
            <div className="space-y-2 text-xs">
              <NextLink
                href="/settings/branches"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <BuildingIcon className="w-4 h-4 text-[#009fe3]" />
                  <span>Branch Locations</span>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
              </NextLink>

              <NextLink
                href="/settings/staff"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <UsersIcon className="w-4 h-4 text-[#009fe3]" />
                  <span>Staff & Scopes</span>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
              </NextLink>

              <NextLink
                href="/organization-settings?tab=branding"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <SettingsIcon className="w-4 h-4 text-[#009fe3]" />
                  <span>Branding & Fees</span>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
              </NextLink>

              <NextLink
                href="/settings/roles"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <ShieldCheckIcon className="w-4 h-4 text-[#009fe3]" />
                  <span>Role Capabilities</span>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
              </NextLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
