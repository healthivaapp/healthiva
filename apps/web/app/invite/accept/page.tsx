'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseClient } from '@healthiva/supabase';
import {
  CheckCircleIcon,
  AlertTriangleIcon,
  StethoscopeIcon,
  MonitorIcon,
  PillIcon,
  BuildingIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ShieldCheckIcon,
} from '../../../components/icons';

interface InvitationDetails {
  fullName: string;
  email: string;
  mobile: string;
  roleName: string;
  roleDescription: string;
  organizationName: string;
  logoUrl?: string | null;
  branches: string[];
  doctorRegNo?: string | null;
  specialty?: string | null;
  orgAuthority?: string | null;
  requiresAuthCode?: boolean;
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [authCode, setAuthCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    async function loadInvitation() {
      if (!token) {
        setErrorMessage('Missing invitation link token. Please check the link sent to your email or WhatsApp.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(`/api/invite?token=${token}`);
        const data = await res.json();

        if (!res.ok || data.error) {
          throw new Error(data.error || 'Invalid or expired invitation link.');
        }

        setInvitation(data.invitation);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to load invitation.');
      } finally {
        setLoading(false);
      }
    }

    loadInvitation();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    // Validate 6-digit verification code if required
    const needsCode = invitation?.requiresAuthCode ?? true;
    if (needsCode && (!authCode || authCode.trim().length !== 6)) {
      setErrorMessage('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please retype carefully.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          authCode: authCode.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to accept invitation.');
      }

      setSuccessMessage('Invitation accepted successfully! Signing you in...');

      // Auto sign in user on client
      const supabase = getSupabaseClient();
      if (invitation?.email) {
        await supabase.auth.signInWithPassword({
          email: invitation.email.trim().toLowerCase(),
          password: password.trim(),
        });
      }

      const targetRedirect = data.redirectUrl || '/dashboard';
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.replace(targetRedirect);
        } else {
          router.replace(targetRedirect);
        }
      }, 600);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error accepting invitation.');
      setSubmitting(false);
    }
  };

  const getRoleIcon = (roleName: string) => {
    const r = roleName.toLowerCase();
    if (r === 'doctor') return StethoscopeIcon;
    if (r === 'receptionist') return MonitorIcon;
    return PillIcon;
  };

  const getRoleBadgeClasses = (roleName: string) => {
    const r = roleName.toLowerCase();
    if (r === 'doctor') return 'bg-sky-50 text-[#009fe3] border-sky-200';
    if (r === 'receptionist') return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  return (
    <div className="min-h-screen bg-[#f8fbfe] font-sans selection:bg-[#009fe3] selection:text-white flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Top Healthiva Minimal Header */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-xl bg-white border border-slate-200/80 p-1.5 shadow-2xs">
              <Image
                src="/healthiva-icon.png"
                alt="Healthiva"
                fill
                className="object-contain p-1"
                priority
                unoptimized
              />
            </div>
            <span className="text-sm font-extrabold text-slate-800 tracking-tight">Healthiva</span>
          </div>
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Official Staff Portal
          </span>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-16 shadow-2xs flex flex-col items-center justify-center text-center">
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
              Validating clinic invitation token...
            </div>
          </div>
        ) : errorMessage && !invitation ? (
          /* Error State */
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-2xs max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangleIcon className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight mb-1.5">
              Invitation Link Expired or Invalid
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              {errorMessage}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-none"
            >
              Return to Staff Login
            </Link>
          </div>
        ) : invitation ? (
          <>
            {/* ================================================================= */}
            {/* 1. HORIZONTAL CLINIC INVITATION CARD (Header Banner)              */}
            {/* ================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4 min-w-0">
                {/* Official Clinic Logo / Brand Mark */}
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center p-2 shrink-0 overflow-hidden shadow-2xs">
                  {invitation.logoUrl ? (
                    <Image
                      src={invitation.logoUrl}
                      alt={invitation.organizationName}
                      fill
                      className="object-contain p-1.5"
                      priority
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-gradient-to-tr from-[#042451] to-[#009fe3] text-white flex items-center justify-center font-extrabold text-xl">
                      {invitation.organizationName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Organization Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#009fe3] bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                      Official Clinic Invitation
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight truncate mt-1">
                    {invitation.organizationName}
                  </h2>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {invitation.roleDescription || 'Join the official clinical care team.'}
                  </p>
                </div>
              </div>

              {/* Badges & Assigned Scopes (Horizontal Right Block) */}
              <div className="flex flex-wrap md:flex-col md:items-end gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Role Badge */}
                  {(() => {
                    const RoleIcon = getRoleIcon(invitation.roleName);
                    return (
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl border shadow-2xs ${getRoleBadgeClasses(invitation.roleName)}`}>
                        <RoleIcon className="w-3.5 h-3.5" />
                        <span>{invitation.roleName}</span>
                      </span>
                    );
                  })()}

                  {/* Co-Owner Governance Badge */}
                  {invitation.orgAuthority === 'administrator' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                      <ShieldCheckIcon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Co-Owner (Administrator)</span>
                    </span>
                  )}
                </div>

                {/* Branch Scope Chips */}
                {invitation.branches.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {invitation.branches.map((bName, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-50 text-slate-600 px-2.5 py-0.5 rounded-lg border border-slate-200/80"
                      >
                        <BuildingIcon className="w-3 h-3 text-slate-400" />
                        <span>{bName}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ================================================================= */}
            {/* 2. HORIZONTAL 2-COLUMN ACTIVATION CARD                            */}
            {/* ================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-2xs">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* LEFT COLUMN: Verified Staff Profile Information */}
                <div className="lg:col-span-5 space-y-4 lg:border-r lg:border-slate-100 lg:pr-8">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                      Staff Member Details
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Your identity as verified by the clinic owner
                    </p>
                  </div>

                  <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Full Name
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                        {invitation.fullName}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Mobile Number
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          {invitation.mobile || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Email Address
                        </span>
                        <span className="text-xs font-bold text-slate-700 truncate block" title={invitation.email}>
                          {invitation.email}
                        </span>
                      </div>
                    </div>

                    {invitation.doctorRegNo && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          NMC Medical Registration
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          {invitation.doctorRegNo}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Security Assurance Card */}
                  <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-100 flex items-start gap-3">
                    <ShieldCheckIcon className="w-5 h-5 text-[#009fe3] shrink-0 mt-0.5" />
                    <div className="text-[11px] text-slate-600 leading-relaxed">
                      <strong className="text-slate-900 font-bold block mb-0.5">2-Factor Security Verification</strong>
                      Enter the 6-digit verification code sent to your email to verify your ownership of this staff profile.
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Verification Code & Password Form */}
                <div className="lg:col-span-7 space-y-5">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                      Account Activation
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Verify your security code and create your secure password
                    </p>
                  </div>

                  {/* Error & Success Feedback Banners */}
                  {errorMessage && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
                      <AlertTriangleIcon className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
                      <CheckCircleIcon className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleAccept} className="space-y-4" autoComplete="off">
                    {/* ========================================================= */}
                    {/* PROMINENT 6-DIGIT EMAIL VERIFICATION CODE FIELD          */}
                    {/* ========================================================= */}
                    <div className="p-4 rounded-2xl bg-sky-50/70 border-2 border-sky-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <LockIcon className="w-3.5 h-3.5 text-[#009fe3]" />
                          <span>6-Digit Verification Code *</span>
                        </label>
                        <span className="text-[10px] font-bold text-[#009fe3] bg-white px-2 py-0.5 rounded-md border border-sky-200">
                          From Email
                        </span>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          required
                          maxLength={6}
                          autoComplete="one-time-code"
                          placeholder="• • • • • •"
                          value={authCode}
                          onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full px-4 py-3 rounded-xl border border-sky-300 bg-white text-slate-900 font-mono text-xl font-black tracking-[0.4em] text-center focus:ring-4 focus:ring-[#009fe3]/15 focus:border-[#009fe3] outline-none shadow-xs transition-all"
                        />
                      </div>

                      <p className="text-[11px] text-slate-500">
                        Enter the 6-digit code sent to <strong className="text-slate-800 font-semibold">{invitation.email}</strong>
                      </p>
                    </div>

                    {/* Password Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Create Password *
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={8}
                            autoComplete="new-password"
                            placeholder="Min. 8 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                            title={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Confirm Password *
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            minLength={8}
                            autoComplete="new-password"
                            placeholder="Re-enter password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-slate-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                            title={showConfirmPassword ? 'Hide password' : 'Show password'}
                          >
                            {showConfirmPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full mt-2 flex items-center justify-center gap-2 bg-[#009fe3] hover:bg-[#008bc7] text-white py-3.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shadow-xs hover:shadow-md disabled:opacity-50"
                    >
                      <LockIcon className="w-4 h-4" />
                      <span>{submitting ? 'Activating your account...' : 'Accept Invitation & Join Clinic'}</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading...</div>}>
      <AcceptInviteContent />
    </Suspense>
  );
}
