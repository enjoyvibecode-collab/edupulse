import * as React from "react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, MapPin, CheckCircle2, XCircle, AlertCircle, Loader2, UserX, Search, UserCheck, LogOut, FileDown, ShieldAlert } from "lucide-react"
import { studentService } from "@/lib/studentService"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { format, startOfDay, endOfDay } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { Input } from "@/components/ui/input"
import { calculateDistance, SCHOOL_ZONE } from "@/lib/geoUtils"
import { isWindowActive, ATTENDANCE_WINDOWS, getAttendanceStatus } from "@/lib/attendanceConfig"
import {
  Trash2,
  AlertTriangle,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function Attendance() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'platform_owner' || profile?.role === 'admin_sekolah'
  
  const [logs, setLogs] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Geolocation state
  const [locationStatus, setLocationStatus] = useState<"checking" | "allowed" | "denied" | "error">("checking")
  const [distanceFromSchool, setDistanceFromSchool] = useState<number | null>(null)

  const handleExport = useCallback(() => {
    try {
      if (logs.length === 0) {
        toast.error("Tidak ada data untuk diekspor")
        return
      }

      const headers = ["Nama Siswa", "NISN", "Status", "Waktu", "Confidence"]
      const csvContent = [
        headers.join(","),
        ...logs.map(log => {
          const name = log.students?.full_name || "N/A"
          const nisn = log.students?.nisn || "N/A"
          const status = log.status === 'hadir_pagi' ? 'PAGI' : log.status === 'dzuhur' ? 'DZUHUR' : 'PULANG'
          const time = format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")
          const conf = (log.confidence * 100).toFixed(1) + "%"
          return `"${name}","${nisn}","${status}","${time}","${conf}"`
        })
      ].join("\n")

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `Laporan_Kehadiran_${format(new Date(), "yyyy-MM-dd")}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success("Laporan berhasil diekspor!")
    } catch (error: any) {
      toast.error("Gagal mengekspor laporan: " + error.message)
    }
  }, [logs])

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const [studentsData, logsData] = await Promise.all([
        studentService.getAll(),
        studentService.getAttendanceLogs()
      ])
      setStudents(studentsData || [])
      setLogs(logsData || [])
    } catch (error: any) {
      toast.error("Gagal mengambil data: " + error.message)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    checkLocation()
    fetchData()

    // Timer to update currentTime every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    const channel = supabase
      .channel('realtime_attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
        fetchData(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        fetchData(false)
      })
      .subscribe()

    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [])

  const checkLocation = async () => {
    if (!navigator.geolocation) {
      setLocationStatus("error")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const distance = calculateDistance(
          latitude,
          longitude,
          SCHOOL_ZONE.latitude,
          SCHOOL_ZONE.longitude
        )
        
        setDistanceFromSchool(Math.round(distance))
        
        if (distance <= SCHOOL_ZONE.radius) {
          setLocationStatus("allowed")
        } else {
          setLocationStatus("denied")
        }
      },
      (error) => {
        console.error("Location error:", error)
        setLocationStatus("error")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleMarkAttendance = async (studentId: string, status: 'hadir_pagi' | 'dzuhur' | 'pulang') => {
    if (locationStatus !== 'allowed') {
      toast.error("Akses Ditolak: Anda berada di luar area sekolah")
      return
    }

    if (!isWindowActive(status, currentTime)) {
      const window = ATTENDANCE_WINDOWS[status]
      toast.error(`Waktu presensi ${window.label} belum aktif (Aktif: ${window.start} - ${window.end})`)
      return
    }

    setProcessingId(`${studentId}-${status}`)
    try {
      await studentService.markAttendance({
        student_id: studentId,
        status,
        confidence: 1
      })
      
      const statusLabel = 
        status === 'hadir_pagi' ? 'Hadir Pagi' : 
        status === 'dzuhur' ? 'Dzuhur' : 'Pulang'
      
      toast.success(`Siswa berhasil presensi ${statusLabel}`)
      await fetchData(false) // Refresh silent
    } catch (error: any) {
      toast.error("Gagal memproses absensi: " + error.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeleteLog = async (id: string, name: string) => {
    if (!isAdmin) return
    if (!confirm(`Hapus data absensi ${name}? Tindakan ini akan dicatat di audit log.`)) return
    
    setProcessingId(`delete-${id}`)
    try {
      await studentService.deleteAttendance(id, profile!.id)
      toast.success("Data absensi berhasil dihapus")
      await fetchData(false)
    } catch (error: any) {
      toast.error("Gagal menghapus: " + error.message)
    } finally {
      setProcessingId(null)
    }
  }

  // Combine students and their latest logs for today
  const attendanceData = useMemo(() => {
    const today = new Date()
    const start = startOfDay(today)
    const end = endOfDay(today)

    return students.map(student => {
      const studentLogs = logs.filter(log => 
        log.student_id === student.id &&
        new Date(log.created_at) >= start &&
        new Date(log.created_at) <= end
      )
      
      const latestLog = studentLogs[0] // Logs are sorted DESC by created_at
      
      return {
        ...student,
        currentStatus: latestLog ? latestLog.status : 'absent',
        hasPagi: studentLogs.some(l => l.status === 'hadir_pagi'),
        hasDzuhur: studentLogs.some(l => l.status === 'dzuhur'),
        hasPulang: studentLogs.some(l => l.status === 'pulang'),
        time: latestLog ? latestLog.created_at : null,
        confidence: latestLog ? latestLog.confidence : null,
        log_id: latestLog ? latestLog.id : null
      }
    }).filter(s => 
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.nisn.includes(searchQuery)
    )
  }, [students, logs, searchQuery])

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'hadir_pagi': return { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Hadir Pagi' };
      case 'dzuhur': return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-100', label: 'Sholat Dzuhur' };
      case 'pulang': return { icon: LogOut, color: 'text-emerald-500', bg: 'bg-emerald-100', label: 'Pulang Sekolah' };
      default: return { icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-50', label: 'Belum Hadir' };
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {locationStatus === 'denied' && (
        <Card className="bg-rose-50 border-2 border-rose-200 shadow-none rounded-2xl overflow-hidden">
          <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500 rounded-lg">
                <ShieldAlert className="text-white h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-rose-900 uppercase text-xs tracking-tight">Geofence Violation Detected</span>
                <p className="text-rose-700 text-[10px] font-bold uppercase tracking-widest leading-none mt-1">
                  Anda berada {distanceFromSchool}m di luar area sekolah. Fungsi absensi dinonaktifkan.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={checkLocation} className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] uppercase h-9">
              Refresh Location
            </Button>
          </CardContent>
        </Card>
      )}

      {locationStatus === 'error' && (
        <Card className="bg-amber-50 border-2 border-amber-200 shadow-none rounded-2xl overflow-hidden">
          <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <AlertCircle className="text-white h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-amber-900 uppercase text-xs tracking-tight">GPS Signal Error</span>
                <p className="text-amber-700 text-[10px] font-bold uppercase tracking-widest leading-none mt-1">
                  Gagal mendeteksi lokasi. Pastikan GPS aktif untuk dapat melakukan presensi.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={checkLocation} className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10px] uppercase h-9">
              Enable GPS
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-sans">Siswa & Kehadiran</h1>
          <p className="text-muted-foreground">Monitoring status kehadiran siswa hari ini: {format(new Date(), "EEEE, d MMMM yyyy", { locale: localeId })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <SheetTrigger 
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 h-11 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Calendar className="mr-2 h-4 w-4" /> Riwayat
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-2xl">
              <SheetHeader>
                <SheetTitle className="font-bold text-2xl flex items-center gap-2">
                  <Clock className="text-primary" /> Riwayat Kehadiran Lengkap
                </SheetTitle>
                <SheetDescription>
                  Daftar seluruh aktivitas presensi yang tercatat di sistem.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 border rounded-xl overflow-hidden">
                <ScrollArea className="h-[calc(100vh-180px)]">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="font-bold">Nama Siswa</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="font-bold text-right pr-12">Waktu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.length > 0 ? (
                        logs.map((log) => (
                          <TableRow key={log.id} className="hover:bg-slate-50/50 group">
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{log.students?.full_name || "Siswa Dihapus"}</span>
                                <span className="text-[10px] text-muted-foreground">{log.students?.nisn || "-"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge className={
                                  log.status === 'hadir_pagi' ? 'bg-blue-100 text-blue-600' : 
                                  log.status === 'dzuhur' ? 'bg-amber-100 text-amber-600' : 
                                  'bg-emerald-100 text-emerald-600'
                                }>
                                  {log.status === 'hadir_pagi' ? 'Pagi' : log.status === 'dzuhur' ? 'Dzuhur' : 'Pulang'}
                                </Badge>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                                  {getAttendanceStatus(log.status, new Date(log.created_at)) === 'On-Time' ? 'Tepat Waktu' : 'Terlambat'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-3 text-xs font-mono font-bold text-slate-500">
                                {format(new Date(log.created_at), "dd/MM/yy HH:mm")}
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteLog(log.id, log.students?.full_name)}
                                    className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                    disabled={processingId === `delete-${log.id}`}
                                  >
                                    {processingId === `delete-${log.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-10 text-muted-foreground font-bold italic">
                            Belum ada riwayat tercatat
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>

          <Button 
            className="bg-primary text-white h-11 px-6 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90"
            onClick={handleExport}
          >
            <FileDown className="mr-2 h-4 w-4" /> Ekspor Laporan
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden rounded-2xl">
        <CardHeader className="bg-white border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <CardTitle className="text-lg font-bold">Status Kehadiran Hari Ini</CardTitle>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cari nama siswa..." 
                className="pl-10 w-full md:w-[300px] bg-slate-50 border-none h-10 rounded-lg focus-visible:ring-1 focus-visible:ring-primary/20" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sinkronisasi Data Kehadiran...</p>
            </div>
          ) : attendanceData.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {attendanceData.map((record) => {
                const config = getStatusConfig(record.currentStatus);
                const timeStr = record.time ? format(new Date(record.time), "HH:mm:ss", { locale: localeId }) : "-";
                const isPagi = processingId === `${record.id}-hadir_pagi`;
                const isDzuhur = processingId === `${record.id}-dzuhur`;
                const isPulang = processingId === `${record.id}-pulang`;
                
                 const isPagiWindow = isWindowActive('hadir_pagi', currentTime);
                 const isDzuhurWindow = isWindowActive('dzuhur', currentTime);
                 const isPulangWindow = isWindowActive('pulang', currentTime);

                 return (
                  <div key={record.id} className="p-4 md:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors group">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-3 rounded-xl ${config.bg} shadow-sm group-hover:scale-110 transition-transform`}>
                        <config.icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{record.full_name}</span>
                          <Badge variant="outline" className="text-[9px] font-bold border-slate-200 text-slate-400 uppercase tracking-tighter">
                            {record.class_name}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-primary" /> {timeStr}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-primary" /> {record.time ? "Camera-Gate-01" : "Belum Terdeteksi"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                         <Button 
                          size="sm" 
                          variant="ghost"
                          className={`h-10 px-3 rounded-xl font-bold transition-all border ${
                            record.hasPagi 
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                            : !isPagiWindow
                            ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                            : 'bg-blue-50/50 text-blue-600 hover:bg-blue-100 border-blue-100 shadow-sm'
                          }`}
                          onClick={() => handleMarkAttendance(record.id, 'hadir_pagi')}
                          disabled={!!processingId || record.hasPagi || !isPagiWindow || locationStatus !== 'allowed'}
                        >
                          {isPagi ? <Loader2 size={14} className="animate-spin mr-2" /> : <UserCheck size={14} className="mr-2" />}
                          Pagi
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className={`h-10 px-3 rounded-xl font-bold transition-all border ${
                            record.hasDzuhur 
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                            : (!record.hasPagi || !isDzuhurWindow)
                            ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                            : 'bg-amber-50/50 text-amber-600 hover:bg-amber-100 border-amber-100 shadow-sm'
                          }`}
                          onClick={() => handleMarkAttendance(record.id, 'dzuhur')}
                          disabled={!!processingId || record.hasDzuhur || !record.hasPagi || !isDzuhurWindow || locationStatus !== 'allowed'}
                        >
                          {isDzuhur ? <Loader2 size={14} className="animate-spin mr-2" /> : <Clock size={14} className="mr-2" />}
                          Dzuhur
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className={`h-10 px-3 rounded-xl font-bold transition-all border ${
                            record.hasPulang
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                            : (!record.hasPagi || !record.hasDzuhur || !isPulangWindow)
                            ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                            : 'bg-emerald-50/50 text-emerald-600 hover:bg-emerald-100 border-emerald-100 shadow-sm'
                          }`}
                          onClick={() => handleMarkAttendance(record.id, 'pulang')}
                          disabled={!!processingId || record.hasPulang || !record.hasPagi || !record.hasDzuhur || !isPulangWindow || locationStatus !== 'allowed'}
                        >
                          {isPulang ? <Loader2 size={14} className="animate-spin mr-2" /> : <LogOut size={14} className="mr-2" />}
                          Pulang
                        </Button>
                      </div>
                      <div className="w-px h-8 bg-slate-100 hidden xl:block" />
                      <Badge className={`${config.bg} ${config.color} border-none font-black uppercase text-[10px] tracking-widest px-4 py-2.5 rounded-xl shadow-sm min-w-[110px] justify-center`}>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center">
                <UserX size={40} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Siswa Tidak Ditemukan</h3>
                <p className="text-sm text-muted-foreground max-w-[300px]">Data siswa atau filter pencarian Anda tidak menghasilkan record apapun.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
