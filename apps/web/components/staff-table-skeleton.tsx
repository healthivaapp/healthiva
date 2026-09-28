'use client';

import React from 'react';

interface StaffTableSkeletonProps {
  rows?: number;
}

export function StaffTableSkeleton({ rows = 4 }: StaffTableSkeletonProps) {
  return (
    <div className="w-full divide-y divide-slate-100 overflow-hidden">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center justify-between px-6 py-4 animate-pulse"
        >
          {/* Member Name + Email + Avatar */}
          <div className="flex items-center gap-3.5 min-w-[220px]">
            <div className="w-10 h-10 rounded-2xl bg-slate-200/80 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-32 bg-slate-200/80 rounded-md" />
              <div className="h-3 w-44 bg-slate-100 rounded-md" />
            </div>
          </div>

          {/* Role Pill */}
          <div className="hidden sm:block min-w-[120px]">
            <div className="h-6 w-24 bg-slate-200/70 rounded-full" />
          </div>

          {/* Branch Scopes */}
          <div className="hidden md:flex items-center gap-1.5 min-w-[150px]">
            <div className="h-5 w-16 bg-slate-100 rounded-lg" />
            <div className="h-5 w-14 bg-slate-100 rounded-lg" />
          </div>

          {/* Status Badge */}
          <div className="hidden lg:block min-w-[90px]">
            <div className="h-5 w-16 bg-slate-100 rounded-full" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100" />
            <div className="w-8 h-8 rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
