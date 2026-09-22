'use client';

import React, { useState } from 'react';
import NextLink from 'next/link';
import { useBranch } from '../../context/branch-context';
import {
  CalendarIcon,
  UserCheckIcon,
  ClockIcon,
  ReceiptIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TrendingUpIcon,
  UserPlusIcon,
  PlusIcon,
  FileTextIcon,
} from '../icons';

interface ReceptionistDashboardProps {
  user?: any;
}

export function ReceptionistDashboard({ user }: ReceptionistDashboardProps) {
  const { userProfile, currentUser } = useBranch();

  const rawStaffName =
    userProfile?.fullName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    currentUser?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Front Desk';

  const receptionistName = rawStaffName;

  const clinicDoctor =
    userProfile?.fullName
      ? (userProfile.fullName.toLowerCase().startsWith('dr.') || userProfile.fullName.toLowerCase().startsWith('dr ')
          ? userProfile.fullName
          : `Dr. ${userProfile.fullName}`)
      : 'Dr. Physician';

  const [selectedDoctor, setSelectedDoctor] = useState('All Doctors');
  const [currentDay, setCurrentDay] = useState(8);

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
            Good morning, {receptionistName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage appointments, walk-ins and patient experience.
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
            <span className="text-xs font-bold text-slate-500">Today's Appointments</span>
            <div className="text-2xl font-black text-slate-900 mt-1">42</div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1">
              <TrendingUpIcon className="w-3 h-3" />
              <span>12% from yesterday</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-[#009fe3] flex items-center justify-center shrink-0 border border-sky-100">
            <CalendarIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Checked In</span>
            <div className="text-2xl font-black text-slate-900 mt-1">16</div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              In the clinic now
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <UserCheckIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Waiting</span>
            <div className="text-2xl font-black text-slate-900 mt-1">5</div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              Patients waiting
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <ClockIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Pending Bills</span>
            <div className="text-2xl font-black text-slate-900 mt-1">8</div>
            <div className="text-[11px] font-bold text-rose-500 mt-1">
              ₹ 12,450
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <ReceiptIcon className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Appointments Table & Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Appointments Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Today's Appointments
              </h2>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                  <span>{selectedDoctor}</span>
                  <ChevronDownIcon className="w-3 h-3 text-slate-400" />
                </div>
                <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                  {todayDateFormatted}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[550px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-2.5">Time</th>
                    <th className="pb-2.5">Patient</th>
                    <th className="pb-2.5">Doctor</th>
                    <th className="pb-2.5">Type</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {/* Row 1 */}
                  <tr>
                    <td className="py-3 text-slate-500 font-semibold">09:00 AM</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-[#009fe3] font-black text-xs flex items-center justify-center">
                          R
                        </div>
                        <span className="font-bold text-slate-900">Rajesh Kumar</span>
                      </div>
                    </td>
                    <td className="py-3 text-slate-600">{clinicDoctor}</td>
                    <td className="py-3 text-slate-600">Consultation</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Checked In
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-slate-300">—</span>
                    </td>
                  </tr>

                  {/* Row 2 */}
                  <tr>
                    <td className="py-3 text-slate-500 font-semibold">09:30 AM</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 font-black text-xs flex items-center justify-center">
                          A
                        </div>
                        <span className="font-bold text-slate-900">Aarti Shah</span>
                      </div>
                    </td>
                    <td className="py-3 text-slate-600">{clinicDoctor}</td>
                    <td className="py-3 text-slate-600">Follow-up</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        Waiting
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#008bc7] rounded-lg transition-colors cursor-pointer shadow-none">
                        Check In
                      </button>
                    </td>
                  </tr>

                  {/* Row 3 */}
                  <tr>
                    <td className="py-3 text-slate-500 font-semibold">10:00 AM</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 font-black text-xs flex items-center justify-center">
                          M
                        </div>
                        <span className="font-bold text-slate-900">Mehul Desai</span>
                      </div>
                    </td>
                    <td className="py-3 text-slate-600">Dr. Mehta</td>
                    <td className="py-3 text-slate-600">Consultation</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Scheduled
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#008bc7] rounded-lg transition-colors cursor-pointer shadow-none">
                        Check In
                      </button>
                    </td>
                  </tr>

                  {/* Row 4 */}
                  <tr>
                    <td className="py-3 text-slate-500 font-semibold">10:30 AM</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center">
                          S
                        </div>
                        <span className="font-bold text-slate-900">Sneha Patel</span>
                      </div>
                    </td>
                    <td className="py-3 text-slate-600">{clinicDoctor}</td>
                    <td className="py-3 text-slate-600">Consultation</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Scheduled
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#008bc7] rounded-lg transition-colors cursor-pointer shadow-none">
                        Check In
                      </button>
                    </td>
                  </tr>

                  {/* Row 5 */}
                  <tr>
                    <td className="py-3 text-slate-500 font-semibold">11:00 AM</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center">
                          K
                        </div>
                        <span className="font-bold text-slate-900">Kiran Joshi</span>
                      </div>
                    </td>
                    <td className="py-3 text-slate-600">Dr. Shah</td>
                    <td className="py-3 text-slate-600">Follow-up</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Scheduled
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#008bc7] rounded-lg transition-colors cursor-pointer shadow-none">
                        Check In
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <NextLink
                href="/reception?tab=appointments"
                className="text-xs font-bold text-[#009fe3] hover:text-[#008bc7] transition-colors inline-flex items-center gap-1"
              >
                <span>View all appointments</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </NextLink>
            </div>
          </div>

          {/* Quick Actions 4-Card Grid */}
          <div>
            <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-3">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button className="bg-white hover:bg-sky-50/50 p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#009fe3] group-hover:bg-[#009fe3] group-hover:text-white flex items-center justify-center mx-auto mb-2 transition-colors">
                  <UserPlusIcon className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-[#009fe3] transition-colors">
                  New Patient
                </div>
              </button>

              <button className="bg-white hover:bg-sky-50/50 p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center mx-auto mb-2 transition-colors">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                  Book Appointment
                </div>
              </button>

              <button className="bg-white hover:bg-sky-50/50 p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white flex items-center justify-center mx-auto mb-2 transition-colors">
                  <UserCheckIcon className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-amber-700 transition-colors">
                  Check-in Patient
                </div>
              </button>

              <button className="bg-white hover:bg-sky-50/50 p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center mx-auto mb-2 transition-colors">
                  <ReceiptIcon className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">
                  Create Invoice
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col */}
        <div className="space-y-6">
          {/* Waiting Room Queue */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-extrabold text-slate-900">Waiting Room</h3>
              <NextLink href="/reception?tab=queue" className="text-xs font-bold text-[#009fe3] hover:underline">
                View All
              </NextLink>
            </div>

            <div className="space-y-2.5">
              {[
                { token: 'T003', name: 'Mehul Desai', wait: '28 min', urgency: 'text-rose-600 font-extrabold' },
                { token: 'T004', name: 'Riya Parmar', wait: '18 min', urgency: 'text-amber-600 font-bold' },
                { token: 'T005', name: 'Ketan Shah', wait: '12 min', urgency: 'text-amber-600 font-bold' },
                { token: 'T006', name: 'Pooja Trivedi', wait: '8 min', urgency: 'text-emerald-600 font-semibold' },
                { token: 'T007', name: 'Amit Rana', wait: '5 min', urgency: 'text-emerald-600 font-semibold' },
              ].map((row) => (
                <div key={row.token} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 text-[11px]">
                      {row.token}
                    </span>
                    <span className="font-bold text-slate-800">{row.name}</span>
                  </div>
                  <span className={`text-[11px] ${row.urgency}`}>{row.wait}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mini Interactive Calendar Widget */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-3">
              <button className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="text-xs font-extrabold text-slate-800">
                September 2025
              </span>
              <button className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] mb-1 font-bold text-slate-400">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {/* Row 1: 31, 1, 2, 3, 4, 5, 6 */}
              <span className="py-1 text-slate-300">31</span>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((d) => {
                const isSelected = d === currentDay;
                return (
                  <button
                    key={d}
                    onClick={() => setCurrentDay(d)}
                    className={`py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#009fe3] text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pending Payments Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-extrabold text-slate-900">Pending Payments</h3>
              <NextLink href="/reception?tab=billing" className="text-xs font-bold text-[#009fe3] hover:underline">
                View All
              </NextLink>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-2xl font-black text-slate-900">₹ 12,450</div>
                <div className="text-[11px] font-semibold text-rose-500">
                  8 invoices pending
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <ReceiptIcon className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <NextLink
                href="/reception?tab=billing"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 transition-colors"
              >
                <span className="font-bold text-slate-700">3 Consultation invoices</span>
                <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
              </NextLink>

              <NextLink
                href="/reception?tab=billing"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 transition-colors"
              >
                <span className="font-bold text-slate-700">2 Procedure invoices</span>
                <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
              </NextLink>

              <NextLink
                href="/reception?tab=billing"
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-100 transition-colors"
              >
                <span className="font-bold text-slate-700">3 Pharmacy invoices</span>
                <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
              </NextLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
