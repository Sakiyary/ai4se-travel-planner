"use client";

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient';

export function useSupabaseAuth() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!supabaseClient) return;
      const { data } = await supabaseClient.auth.getSession();
      if (isMounted) {
        setSession(data.session);
      }
    }

    init();

    const subscription = supabaseClient?.auth.onAuthStateChange((
      _event: AuthChangeEvent,
      nextSession: Session | null
    ) => {
      if (isMounted) {
        setSession(nextSession ?? null);
      }
    }).data?.subscription;

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return session;
}
