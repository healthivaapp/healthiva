'use client';

import React, { useState, useEffect } from 'react';
import NextLink from 'next/link';
import { SettingsLayout } from '../../../components/settings-layout';
import { getCurrentUser } from '@healthiva/supabase';
import { FileTextIcon, StethoscopeIcon, BoxesIcon, ArrowUpRightIcon } from '../../../components/icons';

export default function DynamicFieldsSettingsPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function init() {
      const u = await getCurrentUser();
      setUser(u);
    }
    init();
  }, []);

  return (
    <SettingsLayout
      user={user}
      activeTab="fields"
      title="Dynamic Clinical & Intake Fields"
      description="Configure custom specialty questionnaires, clinical tags, and specialty vitals."
    >
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 sm:p-12 text-center max-w-4xl mx-auto">
        {/* Coming Soon Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 text-[#009fe3] text-xs font-bold border border-sky-100 mb-6">
          <span className="w-2 h-2 rounded-full bg-[#009fe3] animate-pulse" />
          <span>Coming Soon in Next Update</span>
        </div>

        {/* Title & Description */}
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
          Custom Clinical & Patient Fields
        </h2>
        <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed mb-10">
          Soon you will be able to customize specialty questionnaires, add intake vitals, and configure personalized clinical tags for your clinic branches.
        </p>

        {/* Feature Previews */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto text-left mb-10">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#009fe3] flex items-center justify-center mb-3">
              <FileTextIcon className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 mb-1">
              Specialty Questionnaires
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Tailored fields for Eye IOP, Dental charts, or Pediatric developmental milestones.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <StethoscopeIcon className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 mb-1">
              Custom Vital Signs
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Add specialty-specific vitals like Blood Sugar (F/PP), Vision acuity, or Head circumference.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <BoxesIcon className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 mb-1">
              Patient Tags & Alerts
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Create custom clinical tags like VIP, Diabetic, Hypertensive, or Allergy alerts.
            </p>
          </div>
        </div>

        {/* Back to Dashboard Action */}
        <div className="flex items-center justify-center gap-3">
          <NextLink
            href="/dashboard"
            className="bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold px-6 py-2.5 rounded-xl transition-colors cursor-pointer shadow-none"
          >
            Return to Dashboard
          </NextLink>
        </div>
      </div>
    </SettingsLayout>
  );
}
