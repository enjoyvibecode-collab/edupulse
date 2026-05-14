/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { DashboardLayout } from "./layouts/DashboardLayout"
import Dashboard from "./pages/Dashboard"
import Students from "./pages/Students"
import Attendance from "./pages/Attendance"
import AIScanner from "./pages/AIScanner"
import Settings from "./pages/Settings"
import Login from "./pages/Login"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "./contexts/AuthContext"
import { ProtectedRoute } from "./components/auth/ProtectedRoute"

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected Dashboard Routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Dashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/students" 
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Students />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/attendance" 
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Attendance />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/scanner" 
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <AIScanner />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Settings />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-right" closeButton richColors />
        </Router>
      </TooltipProvider>
    </AuthProvider>
  )
}
