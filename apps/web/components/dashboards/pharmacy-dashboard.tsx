'use client';

import React, { useState } from 'react';
import NextLink from 'next/link';
import { useBranch } from '../../context/branch-context';
import {
  PillIcon,
  ClockIcon,
  AlertTriangleIcon,
  CalendarIcon,
  TrendingUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
  RupeeIcon,
} from '../icons';

interface PharmacyDashboardProps {
  user?: any;
}

export function PharmacyDashboard({ user }: PharmacyDashboardProps) {
  const { userProfile } = useBranch();
  const clinicDoctor =
    userProfile?.fullName
      ? (userProfile.fullName.toLowerCase().startsWith('dr.') || userProfile.fullName.toLowerCase().startsWith('dr ')
          ? userProfile.fullName
          : `Dr. ${userProfile.fullName}`)
      : 'Dr. Physician';

  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'dispensed' | 'on_hold'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const todayDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Top Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Pharmacy Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage prescriptions, inventory and dispensing.
          </p>
        </div>
        <div className="text-xs font-bold text-slate-500 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs self-start sm:self-auto">
          {todayDateFormatted}
        </div>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Prescriptions Today</span>
            <div className="text-2xl font-black text-slate-900 mt-1">86</div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1">
              <TrendingUpIcon className="w-3 h-3" />
              <span>18% from yesterday</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <PillIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Pending Dispense</span>
            <div className="text-2xl font-black text-slate-900 mt-1">12</div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              Awaiting review
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <ClockIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Low Stock Items</span>
            <div className="text-2xl font-black text-slate-900 mt-1">9</div>
            <div className="text-[11px] font-semibold text-rose-500 mt-1">
              Need to reorder
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <AlertTriangleIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Expiring Soon</span>
            <div className="text-2xl font-black text-slate-900 mt-1">6</div>
            <div className="text-[11px] font-semibold text-purple-600 mt-1">
              Within 30 days
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
            <CalendarIcon className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Prescription Queue & Sales Overview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prescription Queue Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Prescription Queue
              </h2>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All (12)
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'pending' ? 'bg-white text-[#009fe3] shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Pending (12)
                </button>
                <button
                  onClick={() => setActiveTab('dispensed')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'dispensed' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Dispensed
                </button>
                <button
                  onClick={() => setActiveTab('on_hold')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'on_hold' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  On Hold
                </button>
              </div>
            </div>

            {/* Quick Search */}
            <div className="relative mb-4">
              <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient or medicine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#009fe3]"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[550px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-2.5">#</th>
                    <th className="pb-2.5">Patient</th>
                    <th className="pb-2.5">Medicine</th>
                    <th className="pb-2.5">Qty</th>
                    <th className="pb-2.5">Doctor</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {/* Row 1 */}
                  <tr>
                    <td className="py-3 font-bold text-slate-900">RX001</td>
                    <td className="py-3 font-bold text-slate-800">Aarti Shah</td>
                    <td className="py-3 text-slate-600">Azithromycin 500mg</td>
                    <td className="py-3 text-slate-500 font-semibold">1 strip</td>
                    <td className="py-3 text-slate-600">{clinicDoctor}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        Pending
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#008bc7] rounded-lg transition-colors cursor-pointer shadow-none">
                        Review
                      </button>
                    </td>
                  </tr>

                  {/* Row 2 */}
                  <tr>
                    <td className="py-3 font-bold text-slate-900">RX002</td>
                    <td className="py-3 font-bold text-slate-800">Mehul Desai</td>
                    <td className="py-3 text-slate-600">Metformin 500mg</td>
                    <td className="py-3 text-slate-500 font-semibold">2 strips</td>
                    <td className="py-3 text-slate-600">Dr. Mehta</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        Pending
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#008bc7] rounded-lg transition-colors cursor-pointer shadow-none">
                        Review
                      </button>
                    </td>
                  </tr>

                  {/* Row 3 */}
                  <tr>
                    <td className="py-3 font-bold text-slate-900">RX003</td>
                    <td className="py-3 font-bold text-slate-800">Sneha Patel</td>
                    <td className="py-3 text-slate-600">Levothyroxine 50mcg</td>
                    <td className="py-3 text-slate-500 font-semibold">1 strip</td>
                    <td className="py-3 text-slate-600">{clinicDoctor}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Verified
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#008bc7] rounded-lg transition-colors cursor-pointer shadow-none">
                        Dispense
                      </button>
                    </td>
                  </tr>

                  {/* Row 4 */}
                  <tr>
                    <td className="py-3 font-bold text-slate-900">RX004</td>
                    <td className="py-3 font-bold text-slate-800">Kiran Joshi</td>
                    <td className="py-3 text-slate-600">Amlodipine 5mg</td>
                    <td className="py-3 text-slate-500 font-semibold">1 strip</td>
                    <td className="py-3 text-slate-600">Dr. Shah</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        Pending
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#008bc7] rounded-lg transition-colors cursor-pointer shadow-none">
                        Review
                      </button>
                    </td>
                  </tr>

                  {/* Row 5 */}
                  <tr>
                    <td className="py-3 font-bold text-slate-900">RX005</td>
                    <td className="py-3 font-bold text-slate-800">Riya Parmar</td>
                    <td className="py-3 text-slate-600">Vitamin D3 60K</td>
                    <td className="py-3 text-slate-500 font-semibold">4 tabs</td>
                    <td className="py-3 text-slate-600">{clinicDoctor}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Dispensed
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                        View
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <NextLink
                href="/pharmacy?tab=prescriptions"
                className="text-xs font-bold text-[#009fe3] hover:text-[#008bc7] transition-colors inline-flex items-center gap-1"
              >
                <span>View all prescriptions</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </NextLink>
            </div>
          </div>

          {/* Sales Overview Area Chart */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Sales Overview
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-400">Total Sales</div>
                  <div className="text-sm font-black text-slate-900 flex items-center justify-end gap-1">
                    <span>₹ 2.48L</span>
                    <span className="text-[10px] text-emerald-600 font-bold">↑ 16%</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
                  <span>Last 7 Days</span>
                  <ChevronDownIcon className="w-3 h-3 text-slate-400" />
                </div>
              </div>
            </div>

            {/* SVG Area Chart */}
            <div className="relative pt-4">
              <svg viewBox="0 0 500 120" className="w-full h-32 overflow-visible">
                <defs>
                  <linearGradient id="pharmacyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#009fe3" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#009fe3" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Horizontal Grid lines */}
                <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="60" x2="500" y2="60" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="0" y1="100" x2="500" y2="100" stroke="#f1f5f9" strokeWidth="1" />

                {/* Area Fill */}
                <path
                  d="M 0 90 Q 60 70, 100 80 T 200 50 T 300 65 T 400 35 T 500 45 L 500 100 L 0 100 Z"
                  fill="url(#pharmacyGradient)"
                />

                {/* Spline Stroke */}
                <path
                  d="M 0 90 Q 60 70, 100 80 T 200 50 T 300 65 T 400 35 T 500 45"
                  fill="none"
                  stroke="#009fe3"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Data Points */}
                {[
                  { cx: 0, cy: 90 },
                  { cx: 100, cy: 80 },
                  { cx: 200, cy: 50 },
                  { cx: 300, cy: 65 },
                  { cx: 400, cy: 35 },
                  { cx: 500, cy: 45 },
                ].map((pt, idx) => (
                  <circle key={idx} cx={pt.cx} cy={pt.cy} r="3.5" fill="#ffffff" stroke="#009fe3" strokeWidth="2" />
                ))}
              </svg>

              {/* Day Labels */}
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
        </div>

        {/* Right 1 Col */}
        <div className="space-y-6">
          {/* Inventory Alerts Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-extrabold text-slate-900">Inventory Alerts</h3>
              <NextLink href="/pharmacy?tab=inventory" className="text-xs font-bold text-[#009fe3] hover:underline">
                View All
              </NextLink>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Paracetamol 500mg</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Stock: 12 strips</div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                  Low Stock
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Amoxicillin 500mg</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Stock: 8 strips</div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                  Low Stock
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Pantoprazole 40mg</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Expiry: 20 Sep 2025</div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                  Expiring Soon
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Cetirizine 10mg</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Stock: 15 strips</div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                  Low Stock
                </span>
              </div>
            </div>
          </div>

          {/* Top Medicines (Last 30 Days) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-extrabold text-slate-900">Top Medicines</h3>
              <span className="text-[11px] font-bold text-slate-400">Last 30 Days</span>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { rank: 1, name: 'Paracetamol 500mg', units: 482 },
                { rank: 2, name: 'Vitamin D3 60K', units: 321 },
                { rank: 3, name: 'Amoxicillin 500mg', units: 298 },
                { rank: 4, name: 'Pantoprazole 40mg', units: 276 },
                { rank: 5, name: 'Metformin 500mg', units: 241 },
              ].map((med) => (
                <div key={med.rank} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 text-center text-xs font-black text-slate-400">
                      {med.rank}
                    </span>
                    <span className="font-bold text-slate-800">{med.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{med.units}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <NextLink
                href="/pharmacy?tab=reports"
                className="text-xs font-bold text-[#009fe3] hover:text-[#008bc7] transition-colors inline-flex items-center gap-1"
              >
                <span>View all reports</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </NextLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
