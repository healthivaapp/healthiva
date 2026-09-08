'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getCurrentUser, signOutUser, getSupabaseClient } from '@healthiva/supabase';
import { useRouter } from 'next/navigation';

export default function ClinicDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const checkAuthAndRedirect = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        // No authenticated session -> Replace history stack to prevent back-navigation
        router.replace('/login');
        return false;
      }
      setUser(currentUser);
      setLoading(false);
      return true;
    } catch {
      router.replace('/login');
      return false;
    }
  }, [router]);

  useEffect(() => {
    // 1. Initial Session Verification
    checkAuthAndRedirect();

    // 2. Real-time Multi-Tab Auth Listener (Immediately catch SIGNED_OUT from any tab)
    let authSubscription: { unsubscribe: () => void } | null = null;
    try {
      const supabase = getSupabaseClient();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          router.replace('/login');
        } else if (session?.user) {
          setUser(session.user);
          setLoading(false);
        }
      });
      authSubscription = data?.subscription || null;
    } catch (err) {
      console.warn('[Dashboard Auth Listener]:', err);
    }

    // 3. Chrome Back-Forward Cache (bfcache) Handler
    // When user navigates back, Chrome restores pages from memory (event.persisted = true)
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkAuthAndRedirect();
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      authSubscription?.unsubscribe();
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [checkAuthAndRedirect, router]);

  const handleSignOut = async () => {
    setLoading(true);
    await signOutUser();
    // Use window.location.replace to purge in-memory state and completely clear navigation history
    window.location.replace('/login');
  };

  // Full-page loading guard to prevent flashing unauthenticated dashboard UI
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fbfe] flex flex-col items-center justify-center">
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
          <span>Verifying clinic session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fbfe] font-sans selection:bg-[#009fe3] selection:text-white flex flex-col">
      
      {/* Dashboard Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-50">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link href="/" className="inline-block group py-1">
            <div className="relative w-44 sm:w-56 h-11 sm:h-12">
              <Image 
                src="/healthiva-logo.png" 
                alt="Healthiva" 
                fill 
                className="object-contain object-left scale-105 origin-left"
                priority
                unoptimized
              />
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800">
                {user?.user_metadata?.full_name || user?.email || 'Clinic Owner'}
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                30-Day Free Trial Active
              </span>
            </div>

            <button
              onClick={handleSignOut}
              className="text-xs font-bold text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#042451] to-[#08326e] text-white rounded-2xl p-6 sm:p-8 shadow-lg mb-8 relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-sky-200 text-xs font-semibold mb-3">
              🎉 30-Day Free Trial Started
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Welcome to {user?.user_metadata?.clinic_name || 'Your Clinic Dashboard'}!
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              Your clinic is configured with the <strong>{user?.user_metadata?.specialty || 'General'}</strong> template. Start managing your appointments, patients, and staff.
            </p>

            <div className="flex flex-wrap gap-3">
              <button className="bg-[#009fe3] hover:bg-[#008bc7] text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer">
                + New Appointment
              </button>
              <button className="bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl border border-white/20 transition-all cursor-pointer">
                + Add Patient
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-bold text-slate-500 mb-1">Today's Appointments</div>
            <div className="text-2xl font-extrabold text-[#0f172a]">0</div>
            <div className="text-[11px] text-slate-400 mt-1">Ready for bookings</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-bold text-slate-500 mb-1">Total Patients</div>
            <div className="text-2xl font-extrabold text-[#0f172a]">0</div>
            <div className="text-[11px] text-slate-400 mt-1">EMR Database Active</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-bold text-slate-500 mb-1">Consultation Fee</div>
            <div className="text-2xl font-extrabold text-[#009fe3]">₹300</div>
            <div className="text-[11px] text-slate-400 mt-1">Base consultation fee</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="text-xs font-bold text-slate-500 mb-1">Trial Days Left</div>
            <div className="text-2xl font-extrabold text-emerald-600">30 Days</div>
            <div className="text-[11px] text-slate-400 mt-1">Full premium access</div>
          </div>
        </div>

        {/* Quick Setup Checklist */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-800 mb-4">
            🚀 Quick Clinic Setup Steps:
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
              <div className="text-lg mb-1">📅</div>
              <div className="text-sm font-bold text-slate-800">1. Set Doctor Timings</div>
              <div className="text-xs text-slate-500 mt-1">Configure morning & evening OPD slots.</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
              <div className="text-lg mb-1">👥</div>
              <div className="text-sm font-bold text-slate-800">2. Invite Staff Members</div>
              <div className="text-xs text-slate-500 mt-1">Add receptionists, doctors & pharmacists.</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
              <div className="text-lg mb-1">💊</div>
              <div className="text-sm font-bold text-slate-800">3. Custom Prescription Pad</div>
              <div className="text-xs text-slate-500 mt-1">Upload clinic logo & doctor registration number.</div>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white py-4 text-center text-xs text-slate-500">
        Healthiva Clinic Portal · Run Your Clinic Smarter.
      </footer>

    </div>
  );
}
