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
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted.current && session?.user) {
          setSession(session);
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else if (isMounted.current && !session) {
          // If no session from getSession, check if we're still loading 
          // (onAuthStateChange might still fire)
          // We wait a tiny bit to see if onAuthStateChange handles it
          setTimeout(() => {
            if (isMounted.current && !supabase.auth.getUser()) {
              setLoading(false);
            }
          }, 1000);
        }
      } catch (err) {
        console.error('Init auth error:', err);
        if (isMounted.current) setLoading(false);
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
      const { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        25000, 
        'Profile Fetch'
      ) as any;

      if (error) throw error;
      
      if (isMounted.current) {
        setProfile(data);
        console.log('Profile loaded successfully');
      }
    } catch (error: any) {
      console.error('Error in fetchProfile:', error.message);
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
