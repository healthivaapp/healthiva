'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { getCurrentUser, getSupabaseClient } from '@healthiva/supabase';
import { useRouter } from 'next/navigation';
import { PortalLayout } from '../../components/portal-layout';
import { PharmacyDashboard } from '../../components/dashboards/pharmacy-dashboard';
import { HealthivaScreenLoader } from '../../components/healthiva-screen-loader';

export default function PharmacyPortalPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.replace('/login');
        return;
      }
      setUser(currentUser);
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
        } else if (session?.user) {
          setUser(session.user);
          setLoading(false);
        }
      });
      authSubscription = data?.subscription || null;
    } catch (err) {
      console.warn('[Pharmacy Auth Listener]:', err);
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

  if (loading) {
    return (
      <HealthivaScreenLoader
        message="Loading Pharmacy Portal..."
        subMessage="Preparing inventory, prescriptions, and dispensary logs"
        fullScreen
      />
    );
  }

  return (
    <PortalLayout user={user} defaultPortal="pharmacy">
      <PharmacyDashboard user={user} />
    </PortalLayout>
  );
}
