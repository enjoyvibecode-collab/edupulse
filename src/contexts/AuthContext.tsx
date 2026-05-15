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

  useEffect(() => {
    let isMounted = true;

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
        
        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            await fetchProfile(session.user.id);
          }
        }
      } catch (error) {
        console.error('Final auth initialization error:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes - this is the most reliable source
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed event:', event);
      
      if (!isMounted) return;

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
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    if (!userId) return;
    
    try {
      console.log('Fetching profile for:', userId);
      const { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        15000, // 15s for profile is plenty
        'Profile Fetch'
      ) as any;

      if (error) {
        // If it's a "not found" error, it's fine
        if (error.code === 'PGRST116') {
          console.warn('Profile not found for user:', userId);
        } else {
          throw error;
        }
      }
      
      setProfile(data);
    } catch (error: any) {
      console.error('Error in fetchProfile:', error.message);
    } finally {
      setLoading(false);
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
