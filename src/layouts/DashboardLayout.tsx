import * as React from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Separator } from "@/components/ui/separator"
import { Bell, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50/50">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-6">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex-1 flex items-center">
              <div className="relative w-full max-w-md hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari siswa atau catatan..." 
                  className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-primary rounded-full">
                <Bell size={20} />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
              </Button>
              <Separator orientation="vertical" className="h-6 mx-2" />
              <div className="flex items-center gap-3 pl-2">
                <div className="hidden md:flex flex-col items-end leading-none">
                  <span className="text-sm font-bold text-slate-900">{profile?.full_name || "Admin Sekolah"}</span>
                  <span className="text-[9px] text-primary uppercase font-black tracking-widest">
                    {profile?.role?.replace('_', ' ') || "Super Admin"}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold shadow-lg shadow-primary/20">
                  {(profile?.full_name || "A").charAt(0)}
                </div>
              </div>
            </div>
          </header>
          <div className="flex-1 p-6 md:p-8 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}
