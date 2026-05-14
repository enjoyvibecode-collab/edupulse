import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, UserX, Clock, ArrowUpRight, TrendingUp, Loader2 } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { studentService } from "@/lib/studentService"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts'

export default function Dashboard() {
  const [statsData, setStatsData] = useState<any>(null)
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const [stats, weekly] = await Promise.all([
        studentService.getDashboardStats(),
        studentService.getWeeklyStats()
      ])
      setStatsData(stats)
      setWeeklyData(weekly)
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
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  />
                  <Bar 
                    dataKey="hadir" 
                    radius={[6, 6, 0, 0]} 
                    barSize={32}
                  >
                    {weeklyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === weeklyData.length - 1 ? '#2563eb' : '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Kehadiran Kelas Terbaik</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-6">
                {(statsData?.bestClasses || []).map((item: any, index: number) => {
                  const colors = ["bg-emerald-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500"];
                  const color = colors[index % colors.length];
                  
                  return (
                    <div key={item.name} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{item.name}</span>
                        <span className="font-mono text-slate-500">{item.value}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  );
                })}
                {(!statsData?.bestClasses || statsData.bestClasses.length === 0) && (
                  <p className="text-center text-xs text-slate-400 py-8">Belum ada data kehadiran kelas hari ini.</p>
                )}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
