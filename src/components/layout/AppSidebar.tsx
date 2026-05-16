import * as React from "react"
import { LayoutDashboard, Users, Clock, Settings, LogOut, GraduationCap, Loader2, Scan, FileText } from "lucide-react"
import { useLocation, Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"

const adminItemsPlaceholder = [] // This is just a marker for removal point

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const [loggingOut, setLoggingOut] = React.useState(false)

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

  const adminItems = (profile?.role === 'platform_owner' || profile?.role === 'admin_sekolah') 
    ? [{ title: "User Management", icon: Users, path: "/users" }]
    : []

  const finalMenuItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/" },
    ...adminItems,
    { title: "Students", icon: Users, path: "/students" },
    { title: "Attendance", icon: Clock, path: "/attendance" },
    { title: "Reports", icon: FileText, path: "/reports" },
    { title: "AI Scanner", icon: Scan, path: "/scanner" },
    { title: "Settings", icon: Settings, path: "/settings" },
  ]

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-4 flex flex-row items-center gap-3 border-b">
        <div className="bg-primary text-primary-foreground p-2 rounded-lg shrink-0">
          <CircleGraduationCap size={24} />
        </div>
        <div className="flex flex-col group-data-[collapsible=icon]:hidden overflow-hidden text-left">
          <span className="font-black text-lg leading-none truncate uppercase italic text-primary tracking-tighter">EduPulse</span>
          <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Smart Core</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] uppercase tracking-widest font-bold opacity-50">Menu Utama</SidebarGroupLabel>
          <SidebarMenu className="px-2">
            {finalMenuItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={
                    <Link to={item.path}>
                      <item.icon size={20} />
                      <span className="font-semibold">{item.title}</span>
                    </Link>
                  }
                  isActive={location.pathname === item.path}
                  tooltip={item.title}
                  className="rounded-lg h-10 data-[active=true]:bg-primary/5 data-[active=true]:text-primary"
                />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t bg-slate-50/50">
        <SidebarMenu>
          {profile && (
            <SidebarMenuItem className="mb-4 group-data-[collapsible=icon]:hidden">
              <div className="flex flex-col gap-1 px-2">
                <span className="text-xs font-bold text-slate-900 truncate">{profile.full_name}</span>
                <span className="text-[9px] font-black uppercase text-primary/70 tracking-widest bg-primary/5 px-2 py-0.5 rounded-full w-fit">
                  {profile.role.replace('_', ' ')}
                </span>
              </div>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleSignOut}
              disabled={loggingOut}
              className="text-destructive hover:text-destructive hover:bg-destructive/5 rounded-lg h-10 font-bold"
            >
              {loggingOut ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <LogOut size={20} />
              )}
              <span>{loggingOut ? "Mengeluarkan..." : "Keluar Sesi"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function CircleGraduationCap({ size }: { size?: number }) {
  return (
    <div className="relative">
      <GraduationCap size={size} />
    </div>
  )
}
