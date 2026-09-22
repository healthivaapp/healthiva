'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { getCurrentUser, getSupabaseClient } from '@healthiva/supabase';
import { useRouter } from 'next/navigation';
import { useBranch } from '../../context/branch-context';
import { PortalLayout } from '../../components/portal-layout';
import { DoctorDashboard } from '../../components/dashboards/doctor-dashboard';
import { ReceptionistDashboard } from '../../components/dashboards/receptionist-dashboard';
import { PharmacyDashboard } from '../../components/dashboards/pharmacy-dashboard';
import { OwnerDashboard } from '../../components/dashboards/owner-dashboard';

export default function ClinicDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { activeBranch } = useBranch();

  const checkAuthAndRedirect = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
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

    // 2. Real-time Multi-Tab Auth Listener
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

  // Full-page loading guard to prevent flashing unauthenticated dashboard UI
  if (loading) {
    return (
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
          <span>Verifying clinic session...</span>
        </div>
      </div>
    );
  }

  return (
    <PortalLayout
      user={user}
      renderPortal={(portal) => {
        switch (portal) {
          case 'doctor':
            return <DoctorDashboard user={user} />;
          case 'receptionist':
            return <ReceptionistDashboard user={user} />;
          case 'pharmacy':
            return <PharmacyDashboard user={user} />;
          case 'owner':
          default:
            return <OwnerDashboard user={user} activeBranch={activeBranch} />;
        }
      }}
    />
  );
}
