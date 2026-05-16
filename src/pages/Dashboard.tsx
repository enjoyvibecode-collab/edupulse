import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, UserCheck, UserX, Clock, ArrowUpRight, TrendingUp, Loader2, LogOut } from "lucide-react"
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
        studentService.clearCache();
        fetchStats(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        studentService.clearCache();
        fetchStats(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchStats])

  const stats = [
    { title: "Total Siswa", value: statsData?.totalSiswa || "0", icon: Users, color: "text-blue-600", bg: "bg-blue-50", trend: "Database" },
    { title: "Hadir Pagi", value: statsData?.hadirPagi || "0", icon: UserCheck, color: "text-blue-600", bg: "bg-blue-100/50", trend: "Hadir Pagi" },
    { title: "Hadir Dzuhur", value: statsData?.dzuhur || "0", icon: Clock, color: "text-amber-600", bg: "bg-amber-100/50", trend: "Dzuhur" },
    { title: "Sudah Pulang", value: statsData?.pulang || "0", icon: LogOut, color: "text-emerald-600", bg: "bg-emerald-100/50", trend: "Pulang" },
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-sans">Ringkasan Dashboard</h1>
          <p className="text-muted-foreground">Analisis kehadiran sekolah real-time untuk hari ini.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-2 px-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Monitoring Active</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden relative rounded-2xl">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 ${stat.bg}`} />
            <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 space-y-0 p-3 md:p-6">
              <CardTitle className="text-[10px] md:text-sm font-bold text-muted-foreground uppercase tracking-wider">
                {stat.title}
              </CardTitle>
              <div className={`p-1.5 md:p-2 rounded-lg ${stat.bg} hidden sm:block`}>
                <stat.icon className={`h-3 w-3 md:h-4 md:w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
              <div className="text-xl md:text-2xl font-black font-mono tracking-tight text-slate-900">{stat.value}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-[8px] md:text-xs font-bold ${stat.color} flex items-center ${stat.bg} px-1.5 py-0.5 rounded-md`}>
                  {stat.trend}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 border-b border-slate-50">
            <CardTitle className="flex items-center justify-between text-lg md:text-xl font-black italic uppercase italic tracking-tighter">
              Grafik Mingguan
              <div className="p-2 bg-slate-50 rounded-xl text-slate-400">
                <TrendingUp size={18} />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <div className="h-[250px] md:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                  />
                  <Bar 
                    dataKey="hadir" 
                    radius={[8, 8, 0, 0]} 
                    barSize={window.innerWidth < 768 ? 20 : 32}
                  >
                    {weeklyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === weeklyData.length - 1 ? '#0F172A' : '#E2E8F0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-3 border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 border-b border-slate-50">
            <CardTitle className="text-lg md:text-xl font-black italic uppercase italic tracking-tighter">Rekap Kelas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-50/50">
                   <tr>
                     <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Kelas</th>
                     <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Pagi</th>
                     <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Dzh</th>
                     <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Plg</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {(statsData?.classRekap || []).map((item: any) => (
                     <tr key={item.name} className="hover:bg-slate-50/30 transition-colors">
                       <td className="p-4">
                         <span className="font-bold text-slate-700 text-xs uppercase tracking-tighter">{item.name}</span>
                       </td>
                       <td className="p-4 text-center">
                         <span className="font-mono text-xs font-bold text-blue-600">{item.pagi}</span>
                       </td>
                       <td className="p-4 text-center">
                         <span className="font-mono text-xs font-bold text-amber-600">{item.dzuhur}</span>
                       </td>
                       <td className="p-4 text-center">
                         <span className="font-mono text-xs font-bold text-emerald-600">{item.pulang}</span>
                       </td>
                     </tr>
                   ))}
                   {(!statsData?.classRekap || statsData.classRekap.length === 0) && (
                     <tr>
                       <td colSpan={4} className="p-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         Belum ada data hadir.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
