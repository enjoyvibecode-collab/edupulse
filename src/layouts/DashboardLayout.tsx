import * as React from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Separator } from "@/components/ui/separator"
import { Bell, Search, LayoutDashboard, Users, Clock, Scan, Settings, LogOut, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { Link, useLocation } from "react-router-dom"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const location = useLocation()

  const adminMobileItems = (profile?.role === 'platform_owner' || profile?.role === 'admin_sekolah')
    ? [{ title: "Users", icon: Users, path: "/users" }]
    : []

  const mobileMenuItems = [
    { title: "Home", icon: LayoutDashboard, path: "/" },
    ...adminMobileItems,
    { title: "Students", icon: Users, path: "/students" },
    { title: "Reports", icon: FileText, path: "/reports" },
    { title: "Scan", icon: Scan, path: "/scanner" },
    { title: "Absen", icon: Clock, path: "/attendance" },
    { title: "Set", icon: Settings, path: "/settings" },
  ]

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50/50 font-sans">
        {/* Sidebar - Hidden on extreme small screens via sidebar logic, but standard for desktop */}
        <AppSidebar />
        
        <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4">
              <SidebarTrigger className="hidden md:flex" />
              <div className="md:hidden flex items-center gap-2">
                 <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                   <div className="text-white font-black text-xs uppercase italic tracking-tighter">EP</div>
                 </div>
                 <span className="font-black text-sm uppercase italic text-primary tracking-tighter">EduPulse</span>
              </div>
            </div>
            
            <Separator orientation="vertical" className="h-6 hidden md:block" />
            
            <div className="flex-1 flex items-center justify-end md:justify-start">
              <div className="relative w-full max-w-md hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari siswa..." 
                  className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-primary rounded-full md:h-10 md:w-10 h-8 w-8">
                <Bell size={18} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
              </Button>
              <div className="hidden md:flex items-center gap-3 pl-2 border-l ml-2">
                <div className="flex flex-col items-end leading-none">
                  <span className="text-sm font-bold text-slate-900">{profile?.full_name?.split(' ')[0] || "Admin"}</span>
                  <span className="text-[9px] text-primary uppercase font-black tracking-widest">
                    {profile?.role || "Admin"}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold shadow-lg shadow-primary/20">
                  {(profile?.full_name || "A").charAt(0)}
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 p-4 md:p-8 overflow-auto">
            {children}
          </div>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 flex items-center justify-around px-2 z-50 rounded-t-[1.5rem] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            {mobileMenuItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center gap-1 min-w-[64px] transition-all duration-300 ${
                    isActive ? "text-primary translate-y-[-4px]" : "text-slate-400"
                  }`}
                >
                  <div className={`p-2 rounded-2xl transition-all duration-300 ${
                    isActive ? "bg-primary/10 shadow-lg shadow-primary/5" : ""
                  }`}>
                    <item.icon size={22} className={isActive ? "scale-110" : ""} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                    isActive ? "opacity-100" : "opacity-0 invisible h-0"
                  }`}>
                    {item.title}
                  </span>
                </Link>
              )
            })}
          </nav>
        </main>
      </div>
    </SidebarProvider>
  )
}
