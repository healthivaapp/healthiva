'use client';

import React, { useState, useEffect } from 'react';
import NextLink from 'next/link';
import { SettingsLayout } from '../../components/settings-layout';
import { getCurrentUser } from '@healthiva/supabase';
import {
  FileTextIcon,
  BuildingIcon,
  UsersIcon,
  ShieldCheckIcon,
  BoxesIcon,
  ChevronRightIcon,
  CheckIcon,
} from '../../components/icons';

export default function SettingsHubPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function loadUser() {
      const u = await getCurrentUser();
      setUser(u);
    }
    loadUser();
  }, []);

  const settingsModules = [
    {
      id: 'branding',
      title: 'Clinic Branding, Fees & Modules',
      category: 'Core Identity',
      description:
        'Upload your official clinic logo for printed prescriptions, set print headers, configure OPD consultation fees, token formatting, and active modules.',
      href: '/organization-settings',
      icon: FileTextIcon,
      badgeColor: 'bg-sky-50 text-[#009fe3] border-sky-200',
      iconBg: 'bg-sky-50 text-[#009fe3]',
      features: [
        'High-resolution logo optimization',
        'Custom prescription print header',
        'OPD & Follow-up consultation fees',
        'Queue token styling & daily reset',
      ],
      actionLabel: 'Configure Branding & Fees',
    },
    {
      id: 'branches',
      title: 'Hospital & Clinic Branches',
      category: 'Multi-Branch Network',
      description:
        'Add and manage multiple hospital locations. Each branch has its own address, reception queue, phone numbers, and scoped staff access.',
      href: '/settings/branches',
      icon: BuildingIcon,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconBg: 'bg-emerald-50 text-emerald-600',
      features: [
        'Unique branch codes (e.g. MAIN, RING)',
        'Independent contact & street address',
        'Scoped reception counters & queues',
        '1-Click active branch switching',
      ],
      actionLabel: 'Manage Branch',
    },
    {
      id: 'staff',
      title: 'Staff Directory & Branch Scopes',
      category: 'Team & Access',
      description:
        'Invite doctors, receptionists, and pharmacists. Assign which hospital branches each staff member can access and manage NMC doctor credentials.',
      href: '/settings/staff',
      icon: UsersIcon,
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      iconBg: 'bg-purple-50 text-purple-600',
      features: [
        'Instant email/mobile invitation',
        'Granular multi-branch scoping',
        'Doctor NMC registration & degree',
        'Searchable staff roster with filters',
      ],
      actionLabel: 'Manage Staff Directory',
    },
    {
      id: 'roles',
      title: 'Role Capabilities & Permissions',
      category: 'Security & Rules',
      description:
        'Configure human-language capability toggles for hired staff. Control fee collection, token generation, prescription signing, and pharmacy dispensing.',
      href: '/settings/roles',
      icon: ShieldCheckIcon,
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-50 text-amber-700',
      features: [
        'Doctor fee collection in consultation',
        'Receptionist receipt printing rights',
        'Clinical prescription signing control',
        'Pharmacist dispensing authorization',
      ],
      actionLabel: 'Configure Capabilities',
    },
    {
      id: 'fields',
      title: 'Dynamic Clinical & Intake Fields',
      category: 'Specialty Tailoring',
      description:
        'Tailor intake vitals, custom specialty examination questionnaires (Eye IOP, Dental tooth charts, Pediatric milestones), and patient alert tags.',
      href: '/settings/fields',
      icon: BoxesIcon,
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      iconBg: 'bg-indigo-50 text-indigo-600',
      badgeStatus: 'Coming Soon',
      features: [
        'Specialty-specific intake questions',
        'Custom vital signs (Vision, Blood Sugar)',
        'Clinical alert tags (VIP, Allergy)',
        'Reusable case sheet templates',
      ],
      actionLabel: 'Preview Dynamic Fields',
    },
  ];

  return (
    <SettingsLayout
      user={user}
      activeTab="all"
      title="Clinic Settings Hub"
      description="Select any clinic configuration module below to manage your hospital identity, branches, staff scoping, and workflow rules."
    >
      {/* Settings Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsModules.map((module) => {
          const Icon = module.icon;
          return (
            <NextLink
              key={module.id}
              href={module.href}
              className="group bg-white rounded-2xl border border-slate-200/80 hover:border-[#009fe3] shadow-2xs hover:shadow-md transition-all p-6 flex flex-col justify-between cursor-pointer"
            >
              <div>
                {/* Header: Icon & Category Badge */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${module.iconBg} transition-transform group-hover:scale-105`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex items-center gap-2">
                    {module.badgeStatus && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        {module.badgeStatus}
                      </span>
                    )}
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${module.badgeColor}`}>
                      {module.category}
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <h3 className="text-base font-bold text-slate-900 group-hover:text-[#009fe3] transition-colors mb-2">
                  {module.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-5 line-clamp-3">
                  {module.description}
                </p>

                {/* Feature Bullets */}
                <div className="space-y-2 pt-4 border-t border-slate-100 mb-6">
                  {module.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                      <CheckIcon className="w-3.5 h-3.5 text-[#009fe3] shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <div className="w-full flex items-center justify-between text-xs font-bold text-[#009fe3] group-hover:text-white group-hover:bg-[#009fe3] bg-sky-50/70 border border-sky-100 group-hover:border-[#009fe3] px-4 py-2.5 rounded-xl transition-all">
                  <span>{module.actionLabel}</span>
                  <ChevronRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </NextLink>
          );
        })}
      </div>
    </SettingsLayout>
  );
}
