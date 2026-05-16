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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const isMounted = React.useRef(true)

  useEffect(() => {
    isMounted.current = true;

    // Get initial session
    const initAuth = async () => {
      console.log('Starting auth initialization...');
      
      try {
        // First try to get the session with a reasonable timeout
        // If it times out, we don't throw immediately, we'll wait for onAuthStateChange
        console.log('Fetching initial session...');
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          20000, // 20s initial attempt
          'Initial Session Fetch'
        ).catch(err => {
          console.warn('Initial session fetch timed out/failed, waiting for auth state change:', err.message);
          return { data: { session: null }, error: null };
        });

        const { data: { session }, error } = sessionResult as any;
        
        if (error) throw error;
        
        if (isMounted.current) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            await fetchProfile(session.user.id);
          }
        }
      } catch (error) {
        console.error('Final auth initialization error:', error);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes - this is the most reliable source
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed event:', event);
      
      if (!isMounted.current) return;

      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    if (!userId) return;
    
    // Prevent multiple concurrent fetches for the same user if possible
    // (though in this context we'll just handle it gracefully)
    
    try {
      console.log('Fetching profile for:', userId);
      const { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(), // Use maybeSingle to avoid 406 errors on "not found"
        20000, // 20s is more than enough, better to fail faster than 45s
        'Profile Fetch'
      ) as any;

      if (error) {
        console.error('Database error in fetchProfile:', error);
        throw error;
      }
      
      if (isMounted.current) {
        setProfile(data);
        console.log('Profile loaded:', data?.role);
      }
    } catch (error: any) {
      console.error('Error in fetchProfile:', error.message);
      // Don't leak the raw error to UI but ensure we aren't stuck loading
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
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
