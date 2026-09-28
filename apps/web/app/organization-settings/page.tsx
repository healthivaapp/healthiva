'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser, getSupabaseClient } from '@healthiva/supabase';
import { compressClinicLogo, CompressionResult } from '../../lib/image-compression';
import { SettingsLayout } from '../../components/settings-layout';
import { OwnerRouteGuard } from '../../components/owner-route-guard';
import { useBranch } from '../../context/branch-context';
import {
  FileTextIcon,
  RupeeIcon,
  ClockIcon,
  BoxesIcon,
  HospitalIcon,
  BuildingIcon,
  LightbulbIcon,
  ClipboardListIcon,
  CreditCardIcon,
  MessageSquareIcon,
  PillIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
} from '../../components/icons';

type SettingsTab = 'branding' | 'fees' | 'tokens' | 'modules';

function OrganizationSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateLogoUrl, refreshBranches } = useBranch();
  const isOnboarding = searchParams?.get('onboarding') === 'true';
  const initialTab = (searchParams?.get('tab') as SettingsTab) || 'branding';

  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clinic Organization Identity
  const [organizationId, setOrganizationId] = useState<string>('');
  const [clinicName, setClinicName] = useState<string>('');
  const [specialtyTemplate, setSpecialtyTemplate] = useState<string>('General OPD');

  // Tab 1: Branding & Logo
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [printHeader, setPrintHeader] = useState<string>('');
  const [compressionStats, setCompressionStats] = useState<{
    originalKb: number;
    compressedKb: number;
    dimensions: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab 2: Fees & Pricing (stored as paise in DB, displayed in ₹)
  const [consultationFee, setConsultationFee] = useState<number>(300);
  const [followupFee, setFollowupFee] = useState<number>(150);
  const [emergencyFee, setEmergencyFee] = useState<number>(500);

  // Tab 3: Tokens & Queue Rules
  const [tokenStyle, setTokenStyle] = useState<string>('T-###');
  const [resetDaily, setResetDaily] = useState<boolean>(true);

  // Tab 4: Active Clinic Modules
  const [receptionActive, setReceptionActive] = useState<boolean>(true);
  const [billingActive, setBillingActive] = useState<boolean>(true);
  const [whatsappRemindersActive, setWhatsappRemindersActive] = useState<boolean>(true);
  const [pharmacyActive, setPharmacyActive] = useState<boolean>(false);

  // 1. Fetch Current Settings
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      setUser(user);

      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        router.replace('/login');
        return;
      }

      const res = await fetch('/api/organization-settings', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setErrorMessage(data.error || 'Failed to load clinic settings.');
        return;
      }

      if (data.settings) {
        const s = data.settings;
        setOrganizationId(s.organizationId || '');
        setClinicName(s.organizationName || user?.user_metadata?.clinic_name || 'My Clinic');
        setSpecialtyTemplate(s.specialtyTemplate || user?.user_metadata?.specialty || 'General OPD');

        // Branding
        setLogoUrl(s.brand?.logoUrl || null);
        setPrintHeader(s.brand?.printHeader || `${s.organizationName} — Consultation Slip`);

        // Fees
        if (typeof s.workflow?.consultationFeeRupees === 'number') {
          setConsultationFee(s.workflow.consultationFeeRupees);
        }
        if (typeof s.workflow?.followupFeeRupees === 'number') {
          setFollowupFee(s.workflow.followupFeeRupees);
        }
        if (typeof s.workflow?.emergencyFeeRupees === 'number') {
          setEmergencyFee(s.workflow.emergencyFeeRupees);
        }

        // Tokens
        setTokenStyle(s.workflow?.tokenStyle || 'T-###');
        setResetDaily(s.workflow?.resetDaily !== false);

        // Modules
        setReceptionActive(s.modules?.reception !== false);
        setBillingActive(s.modules?.billing !== false);
        setWhatsappRemindersActive(s.modules?.whatsappReminders !== false);
        setPharmacyActive(Boolean(s.modules?.pharmacy));
      }
    } catch (err: any) {
      console.error('[Settings Load Error]:', err);
      setErrorMessage(err?.message || 'Failed to connect to clinic settings service.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 2. Handle In-Browser Image Compression & Logo Upload
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      // 1. Browser-side compression to WebP (Max 400x150, 80% quality)
      const compressed: CompressionResult = await compressClinicLogo(file, 400, 150, 0.8);

      setCompressionStats({
        originalKb: Math.round(compressed.originalSizeBytes / 1024),
        compressedKb: Math.round(compressed.compressedSizeBytes / 1024),
        dimensions: `${compressed.width}×${compressed.height}px`,
      });

      // 2. Prepare upload payload
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Session expired. Please log in again.');
      }

      const formData = new FormData();
      formData.append('file', compressed.blob, 'logo.webp');
      formData.append('organizationId', organizationId);

      const res = await fetch('/api/organization-settings/upload-logo', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        throw new Error(result.error || 'Failed to upload clinic logo.');
      }

      setLogoUrl(result.logoUrl);
      updateLogoUrl(result.logoUrl);
      refreshBranches();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('healthiva:logo_updated', { detail: { logoUrl: result.logoUrl } }));
      }
      setSuccessMessage('Clinic logo compressed and saved successfully!');
    } catch (err: any) {
      console.error('[Logo Upload Error]:', err);
      setErrorMessage(err?.message || 'Error processing logo image.');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 3. Save Settings to Database
  const handleSaveSettings = async (andGoToDashboard = false) => {
    try {
      setSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        router.replace('/login');
        return;
      }

      const payload = {
        organizationId,
        specialtyTemplate,
        workflow: {
          consultationFeeRupees: Number(consultationFee) || 0,
          followupFeeRupees: Number(followupFee) || 0,
          emergencyFeeRupees: Number(emergencyFee) || 0,
          tokenStyle: tokenStyle.trim() || 'T-###',
          resetDaily: resetDaily,
        },
        brand: {
          logoUrl: logoUrl || null,
          printHeader: printHeader.trim(),
        },
        modules: {
          reception: receptionActive,
          billing: billingActive,
          whatsappReminders: whatsappRemindersActive,
          pharmacy: pharmacyActive,
        },
      };

      const res = await fetch('/api/organization-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update settings.');
      }

      setSuccessMessage('Clinic settings saved successfully!');
      updateLogoUrl(logoUrl);
      refreshBranches();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('healthiva:logo_updated', { detail: { logoUrl } }));
      }

      if (andGoToDashboard) {
        setTimeout(() => {
          router.replace('/dashboard');
        }, 800);
      }
    } catch (err: any) {
      console.error('[Settings Save Error]:', err);
      setErrorMessage(err?.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  // Sample token generator for live preview
  const getSampleTokens = (format: string) => {
    const clean = format.trim() || 'T-###';
    if (clean.includes('###')) {
      return [clean.replace('###', '001'), clean.replace('###', '002'), clean.replace('###', '003')];
    }
    return [`${clean}1`, `${clean}2`, `${clean}3`];
  };

  if (loading) {
    return (
      <SettingsLayout
        user={user}
        activeTab="branding"
        title="Clinic Branding, Fees & Modules"
        description="Configure clinic logo, consultation fees, token rules, and active modules."
      >
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-12 flex flex-col items-center justify-center text-center">
          <div className="relative w-16 h-16 rounded-2xl bg-white border border-slate-100 shadow-md flex items-center justify-center p-3 mb-4">
            <Image
              src="/healthiva-icon.png"
              alt="Healthiva"
              fill
              className="object-contain p-2"
              priority
              unoptimized
            />
          </div>
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#009fe3] mb-3" />
          <div className="text-xs font-semibold text-slate-500">
            Loading clinic configurations...
          </div>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      user={user}
      activeTab="branding"
      title="Clinic Branding, Fees & Modules"
      description="Configure clinic logo, consultation fees, token rules, and active modules."
      action={
        <div className="flex items-center gap-3">
          {isOnboarding && (
            <Link
              href="/dashboard"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3.5 py-2 rounded-xl transition-colors cursor-pointer shadow-none"
            >
              Skip to Dashboard
            </Link>
          )}
          <button
            onClick={() => handleSaveSettings(isOnboarding)}
            disabled={saving}
            className="bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold px-5 py-2 rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-none"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Saving...</span>
              </>
            ) : isOnboarding ? (
              'Save & Launch Dashboard →'
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      }
    >
        {/* Onboarding Welcome Callout */}
        {isOnboarding && (
          <div className="bg-gradient-to-r from-[#042451] to-[#0a3575] text-white rounded-2xl p-6 sm:p-7 shadow-md mb-8 relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Step 2 of 2: Clinic Setup
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                Configure Your Clinic Profile
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
                Personalize your consultation fees, upload your official clinic logo for prescriptions, and toggle active modules. You can also update these anytime later.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleSaveSettings(true)}
                  disabled={saving}
                  className="bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Save & Launch Dashboard →
                </button>
                <Link
                  href="/dashboard"
                  className="text-slate-300 hover:text-white text-xs font-semibold underline underline-offset-4"
                >
                  Use Default Settings & Enter Dashboard
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-700 hover:text-rose-900 font-bold text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Selection Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 mb-8 pb-3">
          <button
            onClick={() => setActiveTab('branding')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'branding'
                ? 'bg-[#009fe3] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <FileTextIcon className="w-4 h-4" />
            <span>Branding & Logo</span>
          </button>

          <button
            onClick={() => setActiveTab('fees')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'fees'
                ? 'bg-[#009fe3] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <RupeeIcon className="w-4 h-4" />
            <span>Clinic Fees & Pricing</span>
          </button>

          <button
            onClick={() => setActiveTab('tokens')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'tokens'
                ? 'bg-[#009fe3] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <ClockIcon className="w-4 h-4" />
            <span>Tokens & Queue</span>
          </button>

          <button
            onClick={() => setActiveTab('modules')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'modules'
                ? 'bg-[#009fe3] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <BoxesIcon className="w-4 h-4" />
            <span>Active Modules</span>
          </button>
        </div>

        {/* Tab 1: Branding & Logo */}
        {activeTab === 'branding' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              {/* Logo Upload Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">Clinic Official Logo</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Upload your clinic or hospital logo to appear on printed prescriptions and receipts.
                    </p>
                  </div>
                  {logoUrl && (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Logo Active
                    </span>
                  )}
                </div>

                <div className="p-5 border-2 border-dashed border-slate-200 hover:border-[#009fe3]/50 rounded-xl bg-slate-50/50 flex flex-col sm:flex-row items-center gap-5 transition-colors">
                  <div className="relative w-40 h-24 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden shadow-xs shrink-0">
                    {logoUrl ? (
                      <Image
                        src={logoUrl}
                        alt="Clinic Logo"
                        fill
                        className="object-contain p-2"
                        unoptimized
                      />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400 text-xs text-center p-2">
                        <BuildingIcon className="w-7 h-7 text-slate-300 mb-1" />
                        <span>No Logo Uploaded</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      onChange={handleLogoSelect}
                      className="hidden"
                      id="clinic-logo-upload"
                    />

                    <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                      <label
                        htmlFor="clinic-logo-upload"
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors cursor-pointer ${
                          uploadingLogo ? 'bg-slate-400 pointer-events-none' : 'bg-[#009fe3] hover:bg-[#008bc7]'
                        }`}
                      >
                        {uploadingLogo ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Compressing & Uploading...</span>
                          </>
                        ) : (
                          <>
                            <span>Upload Logo</span>
                          </>
                        )}
                      </label>

                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoUrl(null);
                            updateLogoUrl(null);
                            if (typeof window !== 'undefined') {
                              window.dispatchEvent(new CustomEvent('healthiva:logo_updated', { detail: { logoUrl: null } }));
                            }
                          }}
                          className="px-3 py-2 rounded-lg text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 leading-normal">
                      Supports PNG, JPG, or WEBP. High-resolution images are automatically optimized for crisp printing.
                    </div>
                  </div>
                </div>
              </div>

              {/* Print Header Input */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Print Header & Prescription Details</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    This text prints at the very top of prescriptions, clinical case papers, and payment bills.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Print Header (Doctor Name, Degree, Clinic Address & Contact)
                  </label>
                  <textarea
                    rows={4}
                    value={printHeader}
                    onChange={(e) => setPrintHeader(e.target.value)}
                    placeholder="Dr. Rakesh Patel (M.S. Ophth) — Sunrise Eye Hospital, Ring Road, Surat | Phone: 98765 43210"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#009fe3] focus:ring-2 focus:ring-[#009fe3]/20 text-xs sm:text-sm text-slate-900 outline-none transition-all resize-none"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>Tip: Separate doctor qualifications and contact with pipes (|) or dashes (-).</span>
                    <span>{printHeader.length} characters</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Print / Prescription Header Preview */}
            <div className="lg:col-span-5">
              <div className="sticky top-24 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#009fe3]">
                    Live Print Preview
                  </span>
                  <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                    A4 / Receipt Header
                  </span>
                </div>

                <div className="p-5 border border-slate-300 rounded-xl bg-white shadow-xs min-h-[170px] flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                    <div className="flex-1">
                      <div className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                        {clinicName || 'HEALTHIVA CLINIC'}
                      </div>
                      <div className="text-[11px] text-slate-600 whitespace-pre-line mt-1 font-medium leading-relaxed">
                        {printHeader || 'Dr. Full Name — Specialty Clinic, City | Phone: +91 98765 43210'}
                      </div>
                    </div>
                    {logoUrl && (
                      <div className="relative w-24 h-12 shrink-0">
                        <Image
                          src={logoUrl}
                          alt="Header Logo"
                          fill
                          className="object-contain object-right"
                          unoptimized
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-3 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>PATIENT NAME: ________________</span>
                    <span>DATE: DD/MM/YYYY</span>
                    <span>TOKEN: T-001</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px] text-slate-500">
                  <LightbulbIcon className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>This layout preview reflects how your logo and header will appear on patient prescriptions and thermal/A4 invoices.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Fees & Pricing */}
        {activeTab === 'fees' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-slate-800">OPD Consultation Fees & Pricing</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Set your standard consultation fees for OPD appointments. These fees will be used for quick 1-click billing at reception.
                </p>
              </div>

              <div className="space-y-6">
                {/* New Patient Fee */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    New Patient Consultation Fee (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-base">₹</span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={consultationFee}
                      onChange={(e) => setConsultationFee(Number(e.target.value) || 0)}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 focus:border-[#009fe3] focus:ring-2 focus:ring-[#009fe3]/20 text-base font-bold text-slate-900 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Follow-up Fee */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Follow-up Consultation Fee (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-base">₹</span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={followupFee}
                      onChange={(e) => setFollowupFee(Number(e.target.value) || 0)}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 focus:border-[#009fe3] focus:ring-2 focus:ring-[#009fe3]/20 text-base font-bold text-slate-900 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Emergency / Special Fee */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Emergency / Priority / Special Consultation Fee (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-base">₹</span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={emergencyFee}
                      onChange={(e) => setEmergencyFee(Number(e.target.value) || 0)}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 focus:border-[#009fe3] focus:ring-2 focus:ring-[#009fe3]/20 text-base font-bold text-slate-900 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Summary Card */}
              <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">Quick Billing Active:</span> Reception staff can issue 1-click receipts for ₹{consultationFee} with zero manual typing.
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveSettings(false)}
                  disabled={saving}
                  className="bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Save Fees
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Tokens & Queue Rules */}
        {activeTab === 'tokens' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Token & Patient Queue Configuration</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Controls how queue tokens are styled on display screens, SMS notifications, and physical paper slips.
                </p>
              </div>

              {/* Token Number Format */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Token Number Format Style
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={tokenStyle}
                    onChange={(e) => setTokenStyle(e.target.value)}
                    placeholder="T-###"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-[#009fe3] focus:ring-2 focus:ring-[#009fe3]/20 text-sm font-mono font-bold text-slate-900 outline-none transition-all"
                  />
                  <div className="flex gap-1.5">
                    {['T-###', 'OPD-###', 'C-###'].map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setTokenStyle(style)}
                        className={`text-xs font-mono font-bold px-2.5 py-2 rounded-lg border transition-colors cursor-pointer ${
                          tokenStyle === style
                            ? 'bg-sky-50 text-[#009fe3] border-sky-200'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Use <code>###</code> for 3-digit padded numbers (e.g. 001, 002).
                </p>

                {/* Token Preview */}
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">Live Preview:</span>
                  <div className="flex items-center gap-2">
                    {getSampleTokens(tokenStyle).map((sample, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-white border border-slate-200 rounded-md font-mono font-black text-xs text-[#042451] shadow-2xs"
                      >
                        {sample}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Daily Reset Toggle */}
              <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-slate-800">Daily Midnight Token Reset</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Automatically reset token counters to #1 every night at 12:00 AM.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setResetDaily(!resetDaily)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    resetDaily ? 'bg-[#009fe3]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                      resetDaily ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Active Clinic Modules */}
        {activeTab === 'modules' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Active Clinic System Modules</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Enable or disable specific features based on your clinic's daily workflow.
                </p>
              </div>

              <div className="space-y-4">
                {/* Reception */}
                <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 text-[#009fe3] flex items-center justify-center shrink-0 mt-0.5">
                      <ClipboardListIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">Reception & Patient Registration</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        New patient onboarding, quick search by mobile number, and daily queue management.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceptionActive(!receptionActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      receptionActive ? 'bg-[#009fe3]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        receptionActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Billing */}
                <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <CreditCardIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">Billing & Receipts Module</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        1-Click consultation receipt printing, payment methods (Cash/UPI), and revenue logs.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBillingActive(!billingActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      billingActive ? 'bg-[#009fe3]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        billingActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* WhatsApp Reminders */}
                <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquareIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">WhatsApp Follow-up Reminders</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Automated WhatsApp messages sent to patients for OPD appointments and prescribed follow-ups.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWhatsappRemindersActive(!whatsappRemindersActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      whatsappRemindersActive ? 'bg-[#009fe3]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        whatsappRemindersActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* In-House Pharmacy */}
                <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                      <PillIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-slate-800">In-house Pharmacy Counter</div>
                        <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                          Optional
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Enable <strong>ONLY</strong> if your clinic or hospital operates an internal pharmacy medicine counter.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPharmacyActive(!pharmacyActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      pharmacyActive ? 'bg-[#009fe3]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        pharmacyActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Bottom Actions */}
        <div className="mt-10 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            Healthiva Clinic Systems · All changes saved securely.
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              {isOnboarding ? 'Skip to Dashboard' : 'Cancel'}
            </Link>

            <button
              onClick={() => handleSaveSettings(isOnboarding)}
              disabled={saving}
              className="bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-none"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving Settings...</span>
                </>
              ) : isOnboarding ? (
                'Save Settings & Enter Dashboard →'
              ) : (
                'Save All Settings'
              )}
            </button>
          </div>
        </div>
      </SettingsLayout>
    );
}

export default function OrganizationSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8fbfe] flex flex-col items-center justify-center font-sans">
          <div className="relative w-48 h-12 mb-4 animate-pulse">
            <Image
              src="/healthiva-logo.png"
              alt="Healthiva"
              fill
              className="object-contain"
              priority
              unoptimized
            />
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
            <svg className="animate-spin h-5 w-5 text-[#009fe3]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Loading clinic settings...</span>
          </div>
        </div>
      }
    >
      <OrganizationSettingsContent />
    </Suspense>
  );
}

