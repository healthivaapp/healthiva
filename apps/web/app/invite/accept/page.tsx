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

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
        body: JSON.stringify({ token, password }),
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
          email: invitation.email,
          password,
        });
      }

      setTimeout(() => {
        router.push(data.redirectUrl || '/dashboard');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error accepting invitation.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-50 to-sky-50/30 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        {/* Clinic Official Logo or Fallback */}
        <div className="flex flex-col items-center justify-center mb-6">
          {invitation?.logoUrl ? (
            <div className="relative h-14 w-48 mb-2">
              <Image
                src={invitation.logoUrl}
                alt={invitation.organizationName}
                fill
                className="object-contain object-center"
                priority
                unoptimized
              />
            </div>
          ) : (
            <div className="inline-flex items-center gap-2.5 mb-2">
              <div className="w-11 h-11 rounded-xl bg-[#009fe3] text-white flex items-center justify-center font-black text-xl shadow-sm">
                +
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900">
                {invitation?.organizationName || 'HEALTHIVA'}
              </span>
            </div>
          )}
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Healthiva Clinic Team Portal
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Join {invitation?.organizationName || 'Clinic Team'}
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
          Complete your profile and set up your staff login credentials.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200/80 rounded-2xl">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm font-medium animate-pulse">
              Verifying clinic invitation...
            </div>
          ) : errorMessage && !invitation ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangleIcon className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900 mb-1">Invitation Link Error</h2>
              <p className="text-xs sm:text-sm text-slate-600 mb-6">{errorMessage}</p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors"
              >
                Go to Sign In
              </Link>
            </div>
          ) : invitation ? (
            <div>
              {/* Clinic Invitation Card */}
              <div className="mb-6 p-4 rounded-xl bg-sky-50/60 border border-sky-100 flex items-start gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  invitation.roleName.toLowerCase() === 'doctor'
                    ? 'bg-sky-100 text-[#009fe3]'
                    : invitation.roleName.toLowerCase() === 'receptionist'
                    ? 'bg-purple-100 text-purple-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {invitation.roleName.toLowerCase() === 'doctor' ? (
                    <StethoscopeIcon className="w-5 h-5" />
                  ) : invitation.roleName.toLowerCase() === 'receptionist' ? (
                    <MonitorIcon className="w-5 h-5" />
                  ) : (
                    <PillIcon className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#009fe3]">
                    Official Staff Invitation
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 truncate">
                    {invitation.organizationName}
                  </h3>
                  <p className="text-xs text-slate-700 mt-0.5">
                    Invited as:{' '}
                    <strong className="text-slate-900 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                      {invitation.roleName}
                    </strong>
                    {invitation.specialty ? ` • ${invitation.specialty}` : ''}
                  </p>
                  {invitation.branches.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {invitation.branches.map((bName, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                        >
                          <BuildingIcon className="w-3 h-3 text-slate-400" />
                          <span>{bName}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Error / Success Banners */}
              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangleIcon className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleAccept} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={invitation.fullName}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-sm font-medium cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="text"
                      disabled
                      value={invitation.mobile}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-sm font-medium cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <input
                      type="text"
                      disabled
                      value={invitation.email}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-sm font-medium cursor-not-allowed"
                    />
                  </div>
                </div>

                {invitation.doctorRegNo && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Medical Registration Number
                    </label>
                    <input
                      type="text"
                      disabled
                      value={invitation.doctorRegNo}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-sm font-medium cursor-not-allowed"
                    />
                  </div>
                )}

                <div className="border-t border-slate-100 pt-4 mt-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Create Login Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-[#009fe3]/20 focus:border-[#009fe3] outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-[#009fe3] hover:bg-[#008bc7] text-white py-3 px-4 rounded-xl text-sm font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <LockIcon className="w-4 h-4" />
                  <span>{submitting ? 'Setting up account...' : 'Accept Invitation & Join Clinic'}</span>
                </button>
              </form>
            </div>
          ) : null}
        </div>
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
