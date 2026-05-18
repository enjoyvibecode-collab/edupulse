import * as React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { Session, User } from "@supabase/supabase-js"
import { supabase, withTimeout } from "@/lib/supabase"
import { Profile } from "@/types"

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  fetchProfile: (userId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const isMounted = React.useRef(true)
  const fetchingProfileFor = React.useRef<string | null>(null)

  useEffect(() => {
    isMounted.current = true;

    // Listen for auth changes - this is the most reliable source for everything
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed event:', event);
      
      if (!isMounted.current) return;

      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // If we already have a profile for this user, and we're not currently fetching one, 
        // we might not need to fetch again immediately unless it's a specific event
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // We still call initAuth to handle the very first load properly in case onAuthStateChange is slow
    const initAuth = async () => {
      // Emergency timeout for initial load (45s)
      const loadTimeout = setTimeout(() => {
        if (isMounted.current && loading) {
          console.warn('Auth initialization taking too long, forcing loading to false');
          setLoading(false);
        }
      }, 45000);

      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          40000,
          'Auth Session Initialization'
        ).catch(err => {
          console.warn('Silent timeout on session fetch, checking onAuthStateChange...');
          return { data: { session: null } };
        }) as any;
        const session = sessionResult?.data?.session;
        
        if (isMounted.current && session?.user) {
          setSession(session);
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else if (isMounted.current && !session) {
          // If no session from getSession, check if we're still loading 
          // (onAuthStateChange might still fire)
          // We wait a tiny bit to see if onAuthStateChange handles it
          setTimeout(async () => {
            try {
              const userResult = await withTimeout(
                supabase.auth.getUser(),
                20000,
                'Auth User Check'
              ) as any;
              const user = userResult?.data?.user;
              if (isMounted.current && !user) {
                setLoading(false);
              }
            } catch (e) {
              if (isMounted.current) setLoading(false);
            }
          }, 1000);
        }
      } catch (err) {
        console.error('Init auth error:', err);
        // On session error, we still want to finish loading so the user can see the login page
        if (isMounted.current) setLoading(false);
      } finally {
        clearTimeout(loadTimeout);
      }
    };

    initAuth();

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    if (!userId) return;
    
    // Deduplicate concurrent fetches for the same user
    if (fetchingProfileFor.current === userId) {
      console.log('Profile fetch already in progress for:', userId);
      return;
    }
    
    fetchingProfileFor.current = userId;
    
    try {
      console.log('Fetching profile for:', userId);
      
      // Retry logic for profile fetch
      let data = null;
      let error = null;
      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        try {
          const result = await withTimeout(
            supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle(),
            attempts === 0 ? 15000 : 25000, 
            'Profile Fetch'
          ).catch(e => {
            if (attempts < maxAttempts - 1) throw e;
            return { data: null, error: e };
          }) as any;
          
          data = result.data;
          error = result.error;
          
          if (!error || !error.message?.includes('timeout')) break; 
        } catch (err: any) {
          error = err;
          if (err.message?.includes('timeout') && attempts < maxAttempts - 1) {
            console.warn(`Profile fetch attempt ${attempts + 1} timed out, retrying...`);
          } else {
            break;
          }
        }
        attempts++;
      }

      if (error && error.message?.includes('timeout')) {
         console.warn("Profile fetch persistently timed out. Continuing as guest-profile.");
      } else if (error) {
         throw error;
      }
      
      if (isMounted.current) {
        setProfile(data);
        console.log('Profile loaded successfully');
      }
    } catch (error: any) {
      console.error('Error in fetchProfile:', error.message);
      // Optional: show a user-friendly toast if it's a persistent timeout
      if (error.message.includes('timeout')) {
        // We'll let the user know, but they might be able to use basic features
        console.warn('Profile fetch failed due to timeout. Some features may be limited.');
      }
    } finally {
      fetchingProfileFor.current = null;
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
