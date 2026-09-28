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

import { HealthivaScreenLoader } from '../../components/healthiva-screen-loader';

export default function ClinicDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { activeBranch, loading: branchLoading, userRole, isOwner } = useBranch();

  const checkAuthAndRedirect = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.replace('/login');
        return false;
      }
      setUser(currentUser);
      setAuthLoading(false);
      return true;
    } catch {
      router.replace('/login');
      return false;
    }
  }, [router]);

  // Route staff members directly to their role-specific portal
  useEffect(() => {
    if (!authLoading && !branchLoading && user && !isOwner) {
      if (userRole === 'receptionist') {
        router.replace('/reception');
      } else if (userRole === 'pharmacist') {
        router.replace('/pharmacy');
      } else if (userRole === 'doctor') {
        router.replace('/doctor');
      }
    }
  }, [authLoading, branchLoading, user, isOwner, userRole, router]);

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
          setAuthLoading(false);
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

  // Full-page loading guard: Wait until both user session AND clinic role/permissions are loaded
  if (authLoading || branchLoading) {
    return (
      <HealthivaScreenLoader
        message="Preparing your clinic workspace..."
        subMessage="Setting up roles, permissions, branches, and clinic records"
        fullScreen
      />
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
