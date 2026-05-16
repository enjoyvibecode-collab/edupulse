import * as React from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500 animate-pulse">Menghubungkan ke EduPulse...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (profile && !profile.is_verified && profile.role !== 'platform_owner' && location.pathname !== '/pending-verification') {
    console.log('Account not verified, redirecting to pending page');
    return <Navigate to="/pending-verification" replace />
  }

  // If on pending page but verified, redirect to dashboard handled by PendingVerification component
  
  return <>{children}</>
}
