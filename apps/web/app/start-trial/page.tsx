'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { HEALTHIVA_SPECIALTIES } from '@healthiva/types';
import { CheckIcon, CheckCircleIcon, MessageSquareIcon } from '../../components/icons';

export default function StartTrialPage() {
  const router = useRouter();

  // Form State
  const [clinicName, setClinicName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [specialty, setSpecialty] = useState('general_opd');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Error
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validations
    if (!clinicName.trim() || !ownerName.trim() || !mobile.trim() || !email.trim() || !password.trim()) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (!/^\d{10}$/.test(mobile.trim())) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    if (specialty === 'other' && !customSpecialty.trim()) {
      setErrorMessage('Please specify your custom medical specialty.');
      return;
    }

    setLoading(true);

    try {
      const selectedSpecialtyObj = HEALTHIVA_SPECIALTIES.find((s) => s.id === specialty);
      const finalSpecialtyName = specialty === 'other' ? customSpecialty.trim() : (selectedSpecialtyObj?.name || specialty);

      const response = await fetch('/api/auth/register-trial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clinicName: clinicName.trim(),
          ownerName: ownerName.trim(),
          mobile: mobile.trim(),
          email: email.trim(),
          password: password.trim(),
          specialty: finalSpecialtyName,
          customSpecialty: customSpecialty.trim(),
        }),
      });

      let data: any = {};
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('[Register Trial Non-JSON Response]:', text);
        throw new Error(
          response.status === 404
            ? 'API route not loaded by local dev server. Please restart "npm run dev" in your terminal.'
            : `Server returned HTTP ${response.status}. Please check server terminal.`
        );
      }

      if (!response.ok || data.error) {
        setErrorMessage(data.error || 'Failed to start trial. Please check details.');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.replace('/organization-settings?onboarding=true');
        }, 1500);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fbfe] font-sans selection:bg-[#009fe3] selection:text-white flex flex-col justify-between">
      
      {/* Top Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="inline-block group py-1">
            <div className="relative w-52 sm:w-64 h-12 sm:h-14 transition-transform duration-300 group-hover:scale-[1.01]">
              <Image 
                src="/healthiva-logo.png" 
                alt="Healthiva — Run Your Clinic Smarter." 
                fill 
                className="object-contain object-left scale-110 origin-left"
                priority
                unoptimized
              />
            </div>
          </Link>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-slate-500 font-medium">Already using Healthiva?</span>
            <Link
              href="/login"
              className="font-bold text-[#009fe3] hover:text-[#008bc7] hover:underline px-3 py-1.5 rounded-lg transition-colors"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* Main Trial Container */}
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full my-auto">
        <div className="bg-white rounded-3xl shadow-xl shadow-sky-950/5 border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Left Column: Form */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
            <div>
              
              {/* Badge & Title */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e8f6fd] border border-[#bae4fb] text-[#009fe3] text-xs font-bold mb-4 shadow-2xs">
                <span>30-Day Free Trial · No Credit Card Required</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] tracking-tight mb-2">
                Start Your 30-Day Free Trial
              </h1>
              <p className="text-slate-500 text-sm mb-6">
                Get full access to all features: smart appointments, billing, EMR, and patient management.
              </p>

              {/* Success Notification */}
              {success ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center my-6 animate-fadeIn">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircleIcon className="w-7 h-7" />
                  </div>
                  <h3 className="text-emerald-900 font-bold text-lg mb-1">
                    Free Trial Activated!
                  </h3>
                  <p className="text-emerald-700 text-sm">
                    Welcome to Healthiva, <strong>{ownerName}</strong>! Your 30-day trial is ready.
                  </p>
                  <p className="text-slate-400 text-xs mt-3">Redirecting to your clinic dashboard...</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Error Notification */}
                  {errorMessage && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-rose-700 text-xs font-medium flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Row 1: Clinic Name & Doctor Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Clinic / Hospital Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={clinicName}
                        onChange={(e) => setClinicName(e.target.value)}
                        placeholder="e.g. Apex Eye & Dental Care"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-800 text-sm font-medium transition-all outline-none focus:border-[#009fe3] focus:ring-4 focus:ring-[#009fe3]/15 placeholder:text-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Doctor / Owner Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="Dr. Rahul Sharma"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-800 text-sm font-medium transition-all outline-none focus:border-[#009fe3] focus:ring-4 focus:ring-[#009fe3]/15 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Row 2: Mobile Number & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Mobile Number <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 text-xs font-bold text-slate-400 select-none">
                          +91
                        </span>
                        <input
                          type="tel"
                          required
                          maxLength={10}
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                          placeholder="9876543210"
                          className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-800 text-sm font-medium transition-all outline-none focus:border-[#009fe3] focus:ring-4 focus:ring-[#009fe3]/15 placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Work Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="clinic@healthiva.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-800 text-sm font-medium transition-all outline-none focus:border-[#009fe3] focus:ring-4 focus:ring-[#009fe3]/15 placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Row 3: Medical Specialty Selection with Dynamic Custom Field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Clinic Specialty <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-800 text-sm font-medium transition-all outline-none focus:border-[#009fe3] focus:ring-4 focus:ring-[#009fe3]/15 cursor-pointer appearance-none pr-10"
                      >
                        {HEALTHIVA_SPECIALTIES.map((spec) => (
                          <option key={spec.id} value={spec.id}>
                            {spec.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Dynamic Custom Specialty Input (Appears when "Other" is chosen) */}
                    {specialty === 'other' && (
                      <div className="mt-2.5 animate-fadeIn">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          Specify Your Specialty <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={customSpecialty}
                          onChange={(e) => setCustomSpecialty(e.target.value)}
                          placeholder="e.g. Homeopathy, Ayurveda, Physiotherapy, Oncology"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#bae4fb] bg-sky-50/40 text-slate-800 text-sm font-medium transition-all outline-none focus:border-[#009fe3] focus:ring-4 focus:ring-[#009fe3]/15 placeholder:text-slate-400"
                        />
                      </div>
                    )}
                  </div>

                  {/* Row 4: Password & Confirm Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Create Password (min 8 chars) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-800 text-sm font-medium transition-all outline-none focus:border-[#009fe3] focus:ring-4 focus:ring-[#009fe3]/15 placeholder:text-slate-400 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 focus:outline-none transition-colors cursor-pointer"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Confirm Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-800 text-sm font-medium transition-all outline-none focus:border-[#009fe3] focus:ring-4 focus:ring-[#009fe3]/15 placeholder:text-slate-400 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 focus:outline-none transition-colors cursor-pointer"
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="group relative overflow-hidden w-full bg-[#009fe3] hover:bg-[#008bc7] text-white font-bold text-base py-3.5 rounded-xl shadow-none transition-colors duration-200 cursor-pointer disabled:pointer-events-none"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {loading ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Setting up your clinic trial...</span>
                          </>
                        ) : (
                          <>
                            <span>Start My 30-Day Free Trial</span>
                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </>
                        )}
                      </span>
                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-in-out" />
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 text-center pt-1">
                    By signing up, you agree to Healthiva's Terms of Service and Privacy Policy.
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: Trial Perks & Healthcare Graphic */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#042451] to-[#08326e] text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
            
            {/* Ambient Glow */}
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-sky-200 text-xs font-semibold mb-6">
                Full Feature Access Included
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 leading-snug">
                Everything You Need to Run Your Clinic Smarter.
              </h2>

              <ul className="space-y-3.5 text-xs sm:text-sm text-slate-200 mb-8">
                <li className="flex items-start gap-2.5">
                  <CheckIcon className="w-4 h-4 text-[#009fe3] shrink-0 mt-0.5" />
                  <span><strong>Smart Appointments:</strong> Instant booking, queue management & SMS reminders.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckIcon className="w-4 h-4 text-[#009fe3] shrink-0 mt-0.5" />
                  <span><strong>Digital Rx & EMR:</strong> Fast prescription pad with pre-loaded medicine templates.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckIcon className="w-4 h-4 text-[#009fe3] shrink-0 mt-0.5" />
                  <span><strong>Billing & Invoices:</strong> GST-compliant invoices, dues tracking & online payments.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckIcon className="w-4 h-4 text-[#009fe3] shrink-0 mt-0.5" />
                  <span><strong>Multi-Staff Support:</strong> Role access for Doctors, Receptionists & Pharmacists.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckIcon className="w-4 h-4 text-[#009fe3] shrink-0 mt-0.5" />
                  <span><strong>99.9% Data Security:</strong> HIPAA-grade encryption & automatic daily cloud backups.</span>
                </li>
              </ul>
            </div>

            {/* Bottom Support Quote */}
            <div className="pt-6 border-t border-white/15">
              <div className="text-xs text-sky-200 font-medium flex items-center gap-1.5">
                <MessageSquareIcon className="w-3.5 h-3.5 text-sky-200" />
                <span>Need personalized onboarding assistance?</span>
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                Our support team is available 24/7 to help you set up.
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-[1380px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Healthiva</span>
            <span>·</span>
            <span>Run Your Clinic Smarter.</span>
          </div>
          <div>
            © {new Date().getFullYear()} Healthiva Inc. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}
