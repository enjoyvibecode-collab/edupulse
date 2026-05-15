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
    // Get initial session
    const initAuth = async () => {
      console.log('Starting auth initialization...');
      // Emergency hard timeout to prevent infinite loading
      const hardTimeoutId = setTimeout(() => {
        setLoading((prev) => {
          if (prev) {
            console.warn('CRITICAL: Auth initialization hard-timeout hit after 45s. Forcing UI load.');
            return false;
          }
          return prev;
        });
      }, 45000);

      try {
        console.log('Fetching Supabase session...');
        // Wrap getSession in a timeout
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          60000,
          'Auth Session Fetch'
        ) as any
        
        if (error) throw error
        
        console.log('Session fetched successfully:', !!session);
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          console.log('User found, fetching profile...');
          await fetchProfile(session.user.id)
        } else {
          console.log('No active session found.');
        }
      } catch (error) {
        console.error('Initial session fetch error:', error)
      } finally {
        console.log('Auth initialization finished.');
        clearTimeout(hardTimeoutId);
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    try {
      // Use supabase directly with a timeout
      const response = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        60000,
        'Fetch Profile'
      ) as any

      const { data, error } = response
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
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
