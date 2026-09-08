'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getCurrentUser, signOutUser, getSupabaseClient } from '@healthiva/supabase';
import { useRouter } from 'next/navigation';

export default function DoctorPortalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      setLoading(false);
    } catch {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    checkAuth();

    let authSubscription: { unsubscribe: () => void } | null = null;
    try {
      const supabase = getSupabaseClient();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.replace('/login');
        }
      });
      authSubscription = data?.subscription || null;
    } catch (err) {
      console.warn('[Doctor Auth Listener]:', err);
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkAuth();
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      authSubscription?.unsubscribe();
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [checkAuth, router]);

  const handleSignOut = async () => {
    setLoading(true);
    await signOutUser();
    window.location.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fbfe] flex flex-col items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <svg className="animate-spin h-5 w-5 text-[#009fe3]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Verifying session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fbfe] font-sans flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200/80 shadow-md">
        <Link href="/" className="inline-block relative w-44 h-11 mb-6">
          <Image src="/healthiva-logo.png" alt="Healthiva" fill className="object-contain" priority unoptimized />
        </Link>
        <div className="text-4xl mb-3">🩺</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Doctor OPD & EMR Portal</h1>
        <p className="text-sm text-slate-500 mb-6">Digital Prescription Pad, Patient History & Appointment Queue.</p>
        <div className="flex flex-col gap-3">
          <Link href="/dashboard" className="inline-block bg-[#009fe3] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm hover:bg-[#008bc7] transition-colors">
            Go to Main Dashboard
          </Link>
          <button
            onClick={handleSignOut}
            className="text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors py-1 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
