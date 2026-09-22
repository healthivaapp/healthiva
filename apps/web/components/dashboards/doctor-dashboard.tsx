'use client';

import React from 'react';
import NextLink from 'next/link';
import { useBranch } from '../../context/branch-context';
import {
  UsersIcon,
  ClockIcon,
  FlaskIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  PillIcon,
  UserPlusIcon,
  TrendingUpIcon,
} from '../icons';

interface DoctorDashboardProps {
  user?: any;
}

export function DoctorDashboard({ user }: DoctorDashboardProps) {
  const { userProfile, specialty, activeBranch, currentUser } = useBranch();

  const rawName =
    userProfile?.fullName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    currentUser?.user_metadata?.full_name ||
    currentUser?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    currentUser?.email?.split('@')[0] ||
    'Doctor';

  const doctorName =
    rawName.toLowerCase().startsWith('dr.') || rawName.toLowerCase().startsWith('dr ')
      ? rawName
      : `Dr. ${rawName}`;

  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

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
            {greeting}, {doctorName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {specialty ? `${specialty} · ` : ''}Here's your clinical overview for today at {activeBranch?.name || 'Healthiva Clinic'}.
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
            <span className="text-xs font-bold text-slate-500">Today's Patients</span>
            <div className="text-2xl font-black text-slate-900 mt-1">18</div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1">
              <TrendingUpIcon className="w-3 h-3" />
              <span>2 from yesterday</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-[#009fe3] flex items-center justify-center shrink-0 border border-sky-100">
            <UsersIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Waiting</span>
            <div className="text-2xl font-black text-slate-900 mt-1">3</div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              Currently waiting
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <ClockIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Pending Results</span>
            <div className="text-2xl font-black text-slate-900 mt-1">4</div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              Lab reports pending
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <FlaskIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">Follow-ups</span>
            <div className="text-2xl font-black text-slate-900 mt-1">7</div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              Scheduled today
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CalendarIcon className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Left Schedule & Volume | Right Patient Snapshot & Pending Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Schedule Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Today's Schedule
              </h2>
              <NextLink
                href="/doctor?tab=appointments"
                className="text-xs font-bold text-[#009fe3] hover:underline"
              >
                View All
              </NextLink>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="pb-2.5">Time</th>
                    <th className="pb-2.5">Patient</th>
                    <th className="pb-2.5">Reason</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {/* Row 1 */}
                  <tr>
                    <td className="py-3 text-slate-500 font-semibold">09:00 AM</td>
                    <td className="py-3">
                      <div className="font-bold text-slate-900">Rajesh Kumar</div>
                      <div className="text-[11px] text-slate-400">34M</div>
                    </td>
                    <td className="py-3 text-slate-600">Fever & Cold</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Completed
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                        View
                      </button>
                    </td>
                  </tr>

                  {/* Row 2 */}
                  <tr>
                    <td className="py-3 text-slate-500 font-semibold">09:30 AM</td>
                    <td className="py-3">
                      <div className="font-bold text-slate-900">Aarti Shah</div>
                      <div className="text-[11px] text-slate-400">28F</div>
                    </td>
                    <td className="py-3 text-slate-600">Follow-up</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-[#009fe3] border border-sky-100">
                        In Consultation
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                        View
                      </button>
                    </td>
                  </tr>

                  {/* Row 3 */}
                  <tr>
                    <td className="py-3 text-slate-500 font-semibold">10:00 AM</td>
                    <td className="py-3">
                      <div className="font-bold text-slate-900">Mehul Desai</div>
                      <div className="text-[11px] text-slate-400">45M</div>
                    </td>
                    <td className="py-3 text-slate-600">BP Check</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        Waiting
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#008bc7] rounded-lg transition-colors cursor-pointer shadow-none">
                        Start Visit
                      </button>
                    </td>
                  </tr>

                  {/* Row 4 */}
                  <tr>
                    <td className="py-3 text-slate-500 font-semibold">10:30 AM</td>
                    <td className="py-3">
                      <div className="font-bold text-slate-900">Sneha Patel</div>
                      <div className="text-[11px] text-slate-400">32F</div>
                    </td>
                    <td className="py-3 text-slate-600">Thyroid Review</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Scheduled
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#008bc7] rounded-lg transition-colors cursor-pointer shadow-none">
                        Start Visit
                      </button>
                    </td>
                  </tr>

                  {/* Row 5 */}
                  <tr>
                    <td className="py-3 text-slate-500 font-semibold">11:00 AM</td>
                    <td className="py-3">
                      <div className="font-bold text-slate-900">Kiran Joshi</div>
                      <div className="text-[11px] text-slate-400">52M</div>
                    </td>
                    <td className="py-3 text-slate-600">Diabetes Follow-up</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Scheduled
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button className="px-3 py-1 text-xs font-bold text-white bg-[#009fe3] hover:bg-[#008bc7] rounded-lg transition-colors cursor-pointer shadow-none">
                        Start Visit
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <button className="text-xs font-bold text-[#009fe3] hover:text-[#008bc7] transition-colors cursor-pointer inline-flex items-center gap-1">
                <span>Show more appointments</span>
                <ChevronDownIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Patient Volume Hourly Bar Chart Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Patient Volume
              </h2>
              <div className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
                <span>Today</span>
                <ChevronDownIcon className="w-3 h-3 text-slate-400" />
              </div>
            </div>

            {/* SVG Hourly Bar Chart */}
            <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2">
              {[
                { time: '8 AM', count: 12, height: '40%' },
                { time: '9 AM', count: 24, height: '80%' },
                { time: '10 AM', count: 30, height: '100%' },
                { time: '11 AM', count: 26, height: '86%' },
                { time: '12 PM', count: 18, height: '60%' },
                { time: '1 PM', count: 8, height: '26%' },
                { time: '2 PM', count: 22, height: '73%' },
                { time: '3 PM', count: 28, height: '93%' },
                { time: '4 PM', count: 16, height: '53%' },
                { time: '5 PM', count: 10, height: '33%' },
              ].map((slot) => (
                <div key={slot.time} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="w-full max-w-[28px] bg-sky-100 hover:bg-[#009fe3] rounded-t-md transition-all relative flex items-end justify-center" style={{ height: slot.height }}>
                    <span className="opacity-0 group-hover:opacity-100 absolute -top-6 text-[10px] font-bold text-slate-800 bg-white px-1 rounded shadow-xs border border-slate-200 transition-opacity">
                      {slot.count}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 truncate">
                    {slot.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col */}
        <div className="space-y-6">
          {/* Patient Snapshot Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Patient Snapshot
              </h3>
              <NextLink href="/doctor?tab=patients" className="text-xs font-bold text-[#009fe3] hover:underline">
                View Full Profile
              </NextLink>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-700 font-black text-sm flex items-center justify-center ring-2 ring-sky-100">
                AS
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                  Aarti Shah
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  28 Years • Female
                </p>
                <p className="text-[10px] font-bold text-slate-500">
                  Patient ID: PT-001284
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">
                  Allergies
                </span>
                <span className="font-bold text-slate-800 text-xs">Penicillin</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Vitals
                </span>
                <span className="font-bold text-slate-800 text-xs">
                  BP 120/80 | HR 78 | SpO2 98%
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Recent Diagnosis
                </span>
                <span className="font-bold text-slate-800 text-xs">Viral Fever</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Medications
                </span>
                <span className="font-bold text-slate-800 text-xs">
                  Paracetamol 500mg, 3 days
                </span>
              </div>
            </div>
          </div>

          {/* Pending Actions Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Pending Actions
                </h3>
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-extrabold flex items-center justify-center">
                  5
                </span>
              </div>
              <NextLink href="/doctor?tab=actions" className="text-xs font-bold text-[#009fe3] hover:underline">
                View All
              </NextLink>
            </div>

            <div className="space-y-2 text-xs">
              <NextLink
                href="/doctor?tab=lab"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-sky-50/60 border border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <FileTextIcon className="w-4 h-4 text-[#009fe3]" />
                  <span className="font-bold text-slate-800">3 Lab results to review</span>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-slate-400" />
              </NextLink>

              <NextLink
                href="/doctor?tab=prescriptions"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-sky-50/60 border border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <PillIcon className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-slate-800">2 Prescription refill requests</span>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-slate-400" />
              </NextLink>

              <NextLink
                href="/doctor?tab=referrals"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-sky-50/60 border border-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <UserPlusIcon className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-800">1 Referral request</span>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-slate-400" />
              </NextLink>
            </div>
          </div>

          {/* Clinic Motivational Tagline Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 border-l-4 border-l-[#009fe3]">
            <p className="text-sm font-extrabold text-[#042451] italic leading-relaxed">
              "Better Care. Healthier Tomorrows."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
