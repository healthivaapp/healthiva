'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { sendPasswordResetEmail } from '@healthiva/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setLoading(true);

    try {
      const result = await sendPasswordResetEmail(email.trim());

      if (result.error) {
        setErrorMessage(result.error);
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col lg:grid lg:grid-cols-12 font-sans selection:bg-[#009fe3] selection:text-white overflow-x-hidden">
      
      {/* Left Column: Form Area */}
      <div className="lg:col-span-5 xl:col-span-4 min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-14 bg-white z-10 shadow-lg lg:shadow-none">
        
        {/* Top: Brand Logo */}
        <div>
          <Link href="/" className="inline-block group py-1">
            <div className="relative w-48 sm:w-56 h-12 sm:h-14 transition-transform duration-300 group-hover:scale-[1.02]">
              <Image 
                src="/healthiva-logo.png" 
                alt="Healthiva — Run Your Clinic Smarter." 
                fill 
                className="object-contain object-left scale-110 sm:scale-115 origin-left"
                priority
                unoptimized
              />
            </div>
          </Link>
        </div>

        {/* Center: Reset Request Form */}
        <div className="w-full max-w-[380px] mx-auto my-auto py-6">
          
          <div className="mb-6">
            <h1 className="text-2xl sm:text-[30px] font-extrabold text-[#0f172a] tracking-tight mb-1">
              Reset Password
            </h1>
            <p className="text-slate-400 font-medium text-sm">
              Enter your work email and we'll send you a secure recovery link.
            </p>
          </div>

          {success ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center animate-fadeIn">
              <div className="text-3xl mb-2">📩</div>
              <h3 className="text-emerald-900 font-bold text-base mb-1">Reset Link Sent!</h3>
              <p className="text-emerald-700 text-xs leading-relaxed mb-4">
                We have emailed a secure password recovery link to <strong>{email}</strong>. Please check your inbox and click the link to update your password.
              </p>
              <div className="pt-2 border-t border-emerald-200/60 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline transition-colors cursor-pointer"
                >
                  Didn't get the email? Try again
                </button>
                <Link
                  href="/login"
                  className="inline-block bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-none transition-colors duration-200 mt-1 cursor-pointer"
                >
                  Return to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-4">
              
              {/* Error Alert */}
              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Email Address Field */}
              <div>
                <label htmlFor="email" className="block text-xs sm:text-[13px] font-bold text-slate-700 mb-1.5">
                  Registered Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@healthiva.com"
                  className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-800 text-sm font-medium transition-all outline-none focus:border-[#009fe3] focus:ring-4 focus:ring-[#009fe3]/15 placeholder:text-slate-400"
                />
              </div>

              {/* Submit Button (Flat, No Shadow, No Opacity Reduction) */}
              <button
                type="submit"
                disabled={loading}
                className="group relative overflow-hidden w-full bg-[#009fe3] hover:bg-[#008bc7] text-white font-bold text-sm sm:text-[15px] py-3 rounded-xl shadow-none transition-colors duration-200 cursor-pointer disabled:pointer-events-none mt-1"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Sending reset link...</span>
                    </>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </span>
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-in-out" />
              </button>

              {/* Back to Login Link */}
              <div className="pt-3 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#009fe3] hover:text-[#008bc7] hover:underline transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to Login</span>
                </Link>
              </div>

            </form>
          )}

        </div>

        {/* Bottom Note */}
        <div className="text-[11px] text-slate-400 text-center lg:text-left pt-2">
          © {new Date().getFullYear()} Healthiva Inc. All rights reserved.
        </div>

      </div>

      {/* Right Column: Full-Bleed Artwork */}
      <div className="hidden lg:flex lg:col-span-7 xl:col-span-8 min-h-screen relative p-0 m-0 bg-[#eef6fe] overflow-hidden items-center justify-center border-l border-slate-100/80">
        <div className="relative w-full h-full min-h-screen flex items-center justify-center p-0 m-0">
          <Image
            src="/healthiva-login-artwork.png"
            alt="Healthiva — Better Healthcare, Better Life"
            fill
            className="object-cover object-center select-none pointer-events-none"
            priority
            unoptimized
          />
        </div>
      </div>

    </div>
  );
}
