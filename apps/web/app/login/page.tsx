'use client';

import React, { useState, useEffect } from 'react';
import { signInWithEmail, getCurrentUser, getSupabaseClient } from '@healthiva/supabase';
import type { AuthResult } from '@healthiva/types';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircleIcon } from '@/components/icons';
import { HealthivaScreenLoader } from '@/components/healthiva-screen-loader';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<AuthResult | null>(null);

  // Load remembered email on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('healthiva_remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }
  }, []);

  // If already authenticated, redirect forward to their role portal immediately
  useEffect(() => {
    async function checkExistingSession() {
      try {
        const user = await getCurrentUser();
        if (user) {
          const supabase = getSupabaseClient();
          const { data: { session } } = await supabase.auth.getSession();
          let targetRoute = '/dashboard';
          if (session?.access_token) {
            try {
              const roleRes = await fetch('/api/branches', {
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              const roleData = await roleRes.json();
              const resolvedRole = (roleData.userRole || '').toLowerCase();
              if (!roleData.isOwner) {
                if (resolvedRole === 'receptionist') {
                  targetRoute = '/reception';
                } else if (resolvedRole === 'pharmacist') {
                  targetRoute = '/pharmacy';
                } else if (resolvedRole === 'doctor') {
                  targetRoute = '/doctor';
                }
              }
            } catch (roleErr) {
              console.warn('[Session Role Resolution]:', roleErr);
            }
          }
          router.replace(targetRoute);
          return;
        }
      } catch (err) {
        console.warn('[Login Auth Check]:', err);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkExistingSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (!email.trim() || !password.trim()) {
        setErrorMessage('Please enter both email and password.');
        setLoading(false);
        return;
      }

      // Call shared auth function from packages/supabase
      const result = await signInWithEmail({
        email: email.trim(),
        password: password.trim(),
      });

      if (result.error) {
        setErrorMessage(result.error);
      } else {
        setLoginSuccess(result);
        
        // Handle "Remember Me" persistence
        if (typeof window !== 'undefined') {
          if (rememberMe) {
            localStorage.setItem('healthiva_remembered_email', email.trim());
          } else {
            localStorage.removeItem('healthiva_remembered_email');
          }
        }

        // Determine role-based route by querying actual membership role & authority
        let targetRoute = '/dashboard';
        try {
          const supabase = getSupabaseClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const roleRes = await fetch('/api/branches', {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const roleData = await roleRes.json();
            const resolvedRole = (roleData.userRole || '').toLowerCase();
            if (!roleData.isOwner) {
              if (resolvedRole === 'receptionist') {
                targetRoute = '/reception';
              } else if (resolvedRole === 'pharmacist') {
                targetRoute = '/pharmacy';
              } else if (resolvedRole === 'doctor') {
                targetRoute = '/doctor';
              }
            }
          }
        } catch (roleErr) {
          console.warn('[Login Role Resolution]:', roleErr);
        }

        setTimeout(() => {
          // Full navigation replace to guarantee clean reload of all providers & caches
          if (typeof window !== 'undefined') {
            window.location.replace(targetRoute);
          } else {
            router.replace(targetRoute);
          }
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected login error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <HealthivaScreenLoader
        message="Verifying session..."
        subMessage="Connecting to your Healthiva clinic workspace"
        fullScreen
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-white flex flex-col lg:grid lg:grid-cols-12 font-sans selection:bg-[#009fe3] selection:text-white overflow-x-hidden">
      
      {/* ======================================================================= */}
      {/* LEFT COLUMN: OFFICIAL HEALTHIVA AUTHENTICATION FORM                     */}
      {/* ======================================================================= */}
      <div className="lg:col-span-5 xl:col-span-4 min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-14 bg-white z-10 shadow-lg lg:shadow-none">
        
        {/* Top: Official Healthiva Brand Logo */}
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

        {/* Center: Form Area */}
        <div className="w-full max-w-[380px] mx-auto my-auto py-6">
          
          {/* Headline */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-[30px] font-extrabold text-[#0f172a] tracking-tight mb-1">
              Welcome Back!
            </h1>
            <p className="text-slate-400 font-medium text-sm">
              Sign In to Continue
            </p>
          </div>

          {loginSuccess ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center animate-fadeIn">
              <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6" />
              </div>
              <h3 className="text-emerald-900 font-bold text-sm mb-1">Login Successful!</h3>
              <p className="text-emerald-700 text-xs">
                Welcome back, <strong>{loginSuccess.profile?.full_name || loginSuccess.user?.email}</strong>
              </p>
              {loginSuccess.profile?.role && (
                <div className="inline-block mt-2.5 bg-emerald-100 text-emerald-800 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider">
                  Role: {loginSuccess.profile.role}
                </div>
              )}
              <p className="text-slate-400 text-xs mt-2.5">Redirecting to clinic portal...</p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Error Alert */}
              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Email Address */}
              <div>
                <label htmlFor="email" className="block text-xs sm:text-[13px] font-bold text-slate-700 mb-1.5">
                  Email Address
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

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-xs sm:text-[13px] font-bold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 focus:outline-none transition-colors"
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

              {/* Options Row */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#009fe3] focus:ring-[#009fe3]/20 cursor-pointer"
                  />
                  <span className="text-xs sm:text-[13px] font-medium text-slate-600">Remember me</span>
                </label>

                <Link
                  href="/forgot-password"
                  className="text-xs sm:text-[13px] font-semibold text-[#009fe3] hover:text-[#008bc7] hover:underline transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>

              {/* Healthiva Core Brand Button (#009fe3) */}
              <button
                type="submit"
                disabled={loading}
                className="group relative overflow-hidden w-full bg-[#009fe3] hover:bg-[#008bc7] text-white font-bold text-sm sm:text-[15px] py-3 rounded-xl shadow-none transition-colors duration-200 cursor-pointer disabled:pointer-events-none mt-1"
              >
                <span className="relative z-10">
                  {loading ? 'Signing in...' : 'Login'}
                </span>
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-in-out" />
              </button>
            </form>
          )}

          {/* Start Free Trial Link */}
          <div className="mt-6 text-center text-xs sm:text-sm font-medium text-slate-500">
            Don’t have an account?{' '}
            <Link href="/start-trial" className="font-bold text-[#009fe3] hover:text-[#008bc7] hover:underline transition-colors">
              Start 30-Day Free Trial
            </Link>
          </div>

        </div>

        {/* Bottom: Subtle Footer Note */}
        <div className="text-[11px] text-slate-400 text-center lg:text-left pt-2">
          © {new Date().getFullYear()} Healthiva Inc. All rights reserved.
        </div>

      </div>

      {/* ======================================================================= */}
      {/* RIGHT COLUMN: FULL-BLEED SEAMLESS LANDSCAPE ARTWORK                     */}
      {/* ======================================================================= */}
      <div className="hidden lg:flex lg:col-span-7 xl:col-span-8 min-h-screen relative p-0 m-0 bg-[#eef6fe] overflow-hidden items-center justify-center border-l border-slate-100/80">
        
        {/* Full Edge-to-Edge Image */}
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
