import * as React from "react"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { Separator } from "@/components/ui/separator"
import { 
  Bell, 
  Search, 
  LayoutDashboard, 
  Users, 
  Clock, 
  Scan, 
  Settings, 
  LogOut, 
  FileText, 
  MoreHorizontal,
  QrCode,
  Loader2,
  Sparkles,
  AlertTriangle,
  Smartphone
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { isSupabaseConfigured } from "@/lib/supabase"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { OfflineSyncBanner } from "@/components/common/OfflineSyncBanner"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = React.useState(false)
  const [isMoreOpen, setIsMoreOpen] = React.useState(false)
  const [isOffline, setIsOffline] = React.useState(false)
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = React.useState(false)

  React.useEffect(() => {
    // Check initially
    setIsOffline(!isSupabaseConfigured || (typeof window !== "undefined" && !!(window as any).__supabaseOffline))

    // Set up a quick check interval to make it responsive
    const interval = setInterval(() => {
      const offlineState = !isSupabaseConfigured || (typeof window !== "undefined" && !!(window as any).__supabaseOffline)
      setIsOffline(offlineState)
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallBanner(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // Check if running in standalone mode (already installed)
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setShowInstallBanner(false)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallApp = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`PWA install choice: ${outcome}`)
    setDeferredPrompt(null)
    setShowInstallBanner(false)
  }

  const handleSignOut = async () => {
    setLoggingOut(true)
    try {
      await signOut()
      navigate("/login")
    } catch (error) {
      console.error("Logout failed:", error)
    } finally {
      setLoggingOut(false)
    }
  }

  const isAdmin = profile?.role === 'platform_owner' || profile?.role === 'admin_sekolah'

  const bottomNavItems = [
    { title: "Home", icon: LayoutDashboard, path: "/" },
    { title: "Siswa", icon: Users, path: "/students" },
    { title: "Scan", icon: Scan, path: "/scanner" },
    { title: "Report", icon: FileText, path: "/reports" },
  ]

  const moreItems = [
    ...(isAdmin ? [{ title: "User Manager", icon: Users, path: "/users" }] : []),
    { title: "Attendance", icon: Clock, path: "/attendance" },
    { title: "Bulk QR", icon: QrCode, path: "/students/bulk-qr" },
    { title: "Pengaturan", icon: Settings, path: "/settings" },
  ]

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50/50 font-sans">
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
            <OfflineSyncBanner />

            {isOffline && (
              <div className="mb-6 p-4 rounded-3xl bg-amber-50 border border-amber-200/60 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100/80 rounded-2xl text-amber-700 shrink-0 mt-0.5 md:mt-0">
                    <Sparkles className="w-5 h-5 animate-pulse text-amber-700" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 mb-1">
                      Mode Offline Lokal Aktif (Fallback Otomatis)
                    </h4>
                    <p className="text-xs text-amber-700 leading-relaxed font-semibold">
                      Koneksi ke Supabase Cloud belum terhubung atau diblokir. 
                      Aplikasi telah beralih ke local storage browser Anda secara otomatis—semua fitur pendaftaran wajah, impor siswa masal, absensi, dan scanner tetap dapat dicoba dengan aman tanpa internet!
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 self-stretch md:self-auto shrink-0">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        (window as any).__supabaseOffline = false;
                        setIsOffline(false);
                      }
                    }}
                    className="flex-1 md:flex-none h-9 text-amber-800 hover:bg-amber-100 text-[10px] uppercase font-black tracking-wider rounded-xl transition-all"
                  >
                    Sembunyikan
                  </Button>
                </div>
              </div>
            )}

            {showInstallBanner && (
              <div className="mb-6 p-4 rounded-3xl bg-emerald-50 border border-emerald-200/60 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100/80 rounded-2xl text-emerald-700 shrink-0 mt-0.5 md:mt-0">
                    <Smartphone className="w-5 h-5 text-emerald-600 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-1">
                      Instal Aplikasi EduPulse di HP Anda
                    </h4>
                    <p className="text-xs text-emerald-700 leading-relaxed font-semibold">
                      Dapatkan akses instan dari layar utama, performa super cepat, scanning wajah AI yang stabil, serta fungsionalitas offline yang andal!
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 self-stretch md:self-auto shrink-0">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowInstallBanner(false)}
                    className="flex-1 md:flex-none h-9 text-emerald-800 hover:bg-emerald-100 text-[10px] uppercase font-black tracking-wider rounded-xl transition-all"
                  >
                    Nanti Saja
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleInstallApp}
                    className="flex-1 md:flex-none h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-black tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/20"
                  >
                    Instal Sekarang
                  </Button>
                </div>
              </div>
            )}
            {children}
          </div>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 flex items-center justify-around px-2 z-50 rounded-t-[1.5rem] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            {bottomNavItems.map((item) => {
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
            
            <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
              <SheetTrigger 
                render={
                  <button
                    className={`flex flex-col items-center justify-center gap-1 min-w-[64px] transition-all duration-300 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                      isMoreOpen ? "text-primary translate-y-[-4px]" : "text-slate-400"
                    }`}
                  >
                    <div className={`p-2 rounded-2xl transition-all duration-300 ${
                      isMoreOpen ? "bg-primary/10 shadow-lg shadow-primary/5" : ""
                    }`}>
                      <MoreHorizontal size={22} className={isMoreOpen ? "scale-110" : ""} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                      isMoreOpen ? "opacity-100" : "opacity-0 invisible h-0"
                    }`}>
                      Menu
                    </span>
                  </button>
                }
              />
              <SheetContent side="bottom" className="rounded-t-[2rem] p-6">
                <SheetHeader className="mb-6">
                  <SheetTitle className="text-xl font-black uppercase italic tracking-tighter text-primary">
                    Navigasi Lainnya
                  </SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-2 gap-4">
                  {moreItems.map((item) => {
                    const isActive = location.pathname === item.path
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMoreOpen(false)}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                          isActive 
                            ? "bg-primary/5 border-primary text-primary" 
                            : "bg-slate-50 border-transparent text-slate-600 active:bg-slate-100"
                        }`}
                      >
                        <item.icon className={`mb-2 ${isActive ? "text-primary" : "text-slate-400"}`} size={24} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-center">{item.title}</span>
                      </Link>
                    )
                  })}
                  
                  <button
                    onClick={handleSignOut}
                    disabled={loggingOut}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl border border-transparent bg-red-50 text-red-600 active:bg-red-100 col-span-2 mt-2"
                  >
                    {loggingOut ? (
                      <Loader2 className="mb-2 animate-spin" size={24} />
                    ) : (
                      <LogOut className="mb-2" size={24} />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-widest">{loggingOut ? "MENGELUARKAN..." : "KELUAR SESI"}</span>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </nav>
        </main>
      </div>
    </SidebarProvider>
  )
}
