import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useRef,
} from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import Cookies from 'js-cookie';

// ─── Session helpers (kept for cross-domain usage) ──────────────────────────

function setSharedCookie(key: string, value: string) {
  const hostname = window.location.hostname;
  const cookieOptions: Cookies.CookieAttributes = {
    expires: 365,
    path: '/',
    secure: window.location.protocol === 'https:' || window.location.hostname === 'localhost',
    sameSite: 'None', // Critical for cross-subdomain in strict browsers (Safari/Brave)
  };

  if (hostname.endsWith('fastestcrm.com')) {
    cookieOptions.domain = '.fastestcrm.com';
  }

  Cookies.set(key, value, cookieOptions);
}

function removeSharedCookie(key: string) {
  const hostname = window.location.hostname;
  Cookies.remove(key, { path: '/' });
  if (hostname.endsWith('fastestcrm.com')) {
    Cookies.remove(key, { path: '/', domain: '.fastestcrm.com' });
  }
}

// Removed custom device and token tracking functions in favor of standard Supabase auth

// ─── Context type ─────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  company_id: string | null;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // ── Fetch Profile Helper ──────────────────────────────────────────────────

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('[Auth] Error fetching profile:', error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('[Auth] Error in fetchProfile:', err);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  // ── Auth state subscription ───────────────────────────────────────────────

  useEffect(() => {
    let active = true;

    const handleAuthChange = async (newUser: User | null, newSession: Session | null) => {
      setSession(newSession);
      setUser(newUser);

      if (newUser) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newUser.id)
            .single();
          
          if (active) {
            if (error) {
              console.error('[Auth] Error fetching profile:', error);
              setProfile(null);
            } else {
              setProfile(data);
            }
          }
        } catch (err) {
          console.error('[Auth] Error in handleAuthChange profile fetch:', err);
          if (active) setProfile(null);
        }
      } else {
        if (active) setProfile(null);
      }
      
      if (active) setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        handleAuthChange(newSession?.user ?? null, newSession);
      }
    );

    supabase.auth
      .getSession()
      .then(({ data: { session: existingSession } }) => {
        if (active) {
          handleAuthChange(existingSession?.user ?? null, existingSession);
        }
      })
      .catch((err) => {
        console.error('[Auth] getSession failed:', err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Profile Real-time sync ───────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`public:profiles:id=eq.${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Auth] Profile real-time update:', payload.new);
          setProfile(payload.new as Profile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // ── Public auth actions ───────────────────────────────────────────────────

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, profile, refreshProfile, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
