import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, UserX, Clock, ArrowUpRight, TrendingUp, Loader2 } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { studentService } from "@/lib/studentService"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export default function Dashboard() {
  const [statsData, setStatsData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const data = await studentService.getDashboardStats()
      setStatsData(data)
    } catch (error: any) {
      toast.error("Gagal memuat statistik: " + error.message)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()

    const channel = supabase
      .channel('realtime_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
        fetchStats(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        fetchStats(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchStats])

  const stats = [
    { title: "Total Siswa", value: statsData?.totalSiswa || "0", icon: Users, color: "text-blue-600", bg: "bg-blue-50", trend: "Database" },
    { title: "Hadir Hari Ini", value: statsData?.hadirHariIni || "0", icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-50", trend: statsData ? `${((statsData.hadirHariIni / statsData.totalSiswa) * 100 || 0).toFixed(1)}%` : "0%" },
    { title: "Absen/Izin", value: statsData?.absen || "0", icon: UserX, color: "text-amber-600", bg: "bg-amber-50", trend: statsData ? `${((statsData.absen / statsData.totalSiswa) * 100 || 0).toFixed(1)}%` : "0%" },
    { title: "Pulang", value: statsData?.pulang || "0", icon: Clock, color: "text-purple-600", bg: "bg-purple-50", trend: "Real-time" },
  ]

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Memuat Dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-sans">Ringkasan Dashboard</h1>
        <p className="text-muted-foreground">Analisis kehadiran sekolah real-time untuk hari ini.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 ${stat.bg}`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono tracking-tight">{stat.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs font-semibold text-emerald-600 flex items-center bg-emerald-50 px-1.5 py-0.5 rounded">
                  <TrendingUp size={10} className="mr-1" />
                  {stat.trend}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">vs kemarin</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Grafik Kehadiran Mingguan
              <ArrowUpRight size={20} className="text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center bg-slate-50 border border-dashed rounded-lg text-muted-foreground">
              Visualisasi Grafik di sini (Recharts)
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Kehadiran Kelas Terbaik</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-6">
                {[
                  { name: "Kelas XII IPA 1", value: 100, color: "bg-emerald-500" },
                  { name: "Kelas X IPS 2", value: 98, color: "bg-blue-500" },
                  { name: "Kelas XI IPA 4", value: 95, color: "bg-indigo-500" },
                  { name: "Kelas XII IPS 1", value: 92, color: "bg-purple-500" },
                ].map((item) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="font-mono text-slate-500">{item.value}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
