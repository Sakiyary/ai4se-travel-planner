"use client";

import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient';

interface SupabaseAuthState {
  session: Session | null;
  user: User | null;
  profile: { email: string | null } | null;
  isLoading: boolean;
}

export function useSupabaseAuth(): SupabaseAuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ email: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!supabaseClient) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const { data } = await supabaseClient.auth.getSession();
        if (isMounted) {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
          setProfile(data.session?.user ? { email: data.session.user.email ?? null } : null);
        }
      } catch (error) {
        console.warn('[useSupabaseAuth] Failed to get session', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    init();

    const subscription = supabaseClient?.auth.onAuthStateChange((
      _event: AuthChangeEvent,
      nextSession: Session | null
    ) => {
      if (isMounted) {
        setSession(nextSession ?? null);
        setUser(nextSession?.user ?? null);
        setProfile(nextSession?.user ? { email: nextSession.user.email ?? null } : null);
      }
    }).data?.subscription;

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return { session, user, profile, isLoading };
}
