'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircleIcon } from '@/components/icons';
import { useRouter } from 'next/navigation';
import { updateUserPassword } from '@healthiva/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!password.trim() || !confirmPassword.trim()) {
      setErrorMessage('Please enter and confirm your new password.');
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

    setLoading(true);

    try {
      const result = await updateUserPassword(password.trim());

      if (result.error) {
        setErrorMessage(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.replace('/login');
        }, 1500);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update password. Please try again.');
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

        {/* Center: Update Password Form */}
        <div className="w-full max-w-[380px] mx-auto my-auto py-6">
          
          <div className="mb-6">
            <h1 className="text-2xl sm:text-[30px] font-extrabold text-[#0f172a] tracking-tight mb-1">
              Create New Password
            </h1>
            <p className="text-slate-400 font-medium text-sm">
              Please enter your new secure password.
            </p>
          </div>

          {success ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center animate-fadeIn">
              <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6" />
              </div>
              <h3 className="text-emerald-900 font-bold text-base mb-1">Password Updated!</h3>
              <p className="text-emerald-700 text-xs leading-relaxed mb-3">
                Your password has been changed successfully. Redirecting you to login...
              </p>
              <Link
                href="/login"
                className="inline-block bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-none transition-colors duration-200 cursor-pointer"
              >
                Go to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              
              {/* Error Alert */}
              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block text-xs sm:text-[13px] font-bold text-slate-700 mb-1.5">
                  New Password (min 8 chars)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-800 text-sm font-medium transition-all outline-none focus:border-[#009fe3] focus:ring-4 focus:ring-[#009fe3]/15 placeholder:text-slate-400 pr-10"
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

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs sm:text-[13px] font-bold text-slate-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-800 text-sm font-medium transition-all outline-none focus:border-[#009fe3] focus:ring-4 focus:ring-[#009fe3]/15 placeholder:text-slate-400 pr-10"
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
                      <span>Updating password...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
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
