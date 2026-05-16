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
  Edit3,
  History,
  MoreVertical,
  Undo2,
  MessageSquare
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  const isAdmin = profile?.role === 'platform_owner' || profile?.role === 'admin_sekolah' || profile?.role === 'guru'
  
  const [logs, setLogs] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Correction State
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isLogHistoryOpen, setIsLogHistoryOpen] = useState(false)
  const [correctionNote, setCorrectionNote] = useState("")
  const [editStatus, setEditStatus] = useState<string>("")
  const [editTime, setEditTime] = useState<string>("")
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)

  // Geolocation state
  const [locationStatus, setLocationStatus] = useState<"checking" | "allowed" | "denied" | "error">("checking")
  const [distanceFromSchool, setDistanceFromSchool] = useState<number | null>(null)
  const [schoolZone, setSchoolZone] = useState(SCHOOL_ZONE)

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
    const fetchSettings = async () => {
      try {
        const { data } = await (supabase.from('settings') as any)
          .select('value')
          .eq('id', 'geofence')
          .single();
        
        if (data && data.value) {
          setSchoolZone(data.value as any);
        }
      } catch (err) {
        console.warn("Using default geofence configuration");
      }
    };

    fetchSettings();
    fetchData()

    // Timer to update currentTime every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    const channel = supabase
      .channel('realtime_attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
        studentService.clearCache();
        fetchData(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        studentService.clearCache();
        fetchData(false)
      })
      .subscribe()

    return () => {
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (schoolZone) {
      checkLocation()
    }
  }, [schoolZone])

  const checkLocation = async () => {
    if (!navigator.geolocation) {
      setLocationStatus("error")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        console.log("Current location:", latitude, longitude);
        console.log("Checking against school zone:", schoolZone);
        
        const distance = calculateDistance(
          latitude,
          longitude,
          schoolZone.latitude,
          schoolZone.longitude
        )
        
        setDistanceFromSchool(Math.round(distance))
        
        if (distance <= schoolZone.radius) {
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
    const reason = prompt(`Alasan pembatalan absensi ${name}:`, "Salah klik")
    if (reason === null) return 
    
    setProcessingId(`delete-${id}`)
    try {
      await studentService.softDeleteAttendance(id, profile!.id, reason)
      toast.success("Data absensi berhasil dibatalkan")
      await fetchData(false)
    } catch (error: any) {
      toast.error("Gagal membatalkan: " + error.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleOpenEdit = (log: any) => {
    setSelectedLog(log)
    setEditStatus(log.status)
    setEditTime(format(new Date(log.created_at), "yyyy-MM-dd'T'HH:mm"))
    setCorrectionNote(log.correction_note || "")
    setIsEditDialogOpen(true)
  }

  const handleUpdateLog = async () => {
    if (!selectedLog || !isAdmin) return
    if (!correctionNote.trim()) {
      toast.error("Mohon isi alasan koreksi")
      return
    }

    setProcessingId(`edit-${selectedLog.id}`)
    try {
      await studentService.updateAttendance(
        selectedLog.id,
        {
          status: editStatus as any,
          created_at: new Date(editTime).toISOString()
        },
        profile!.id,
        correctionNote
      )
      toast.success("Data absensi berhasil diperbarui")
      setIsEditDialogOpen(false)
      await fetchData(false)
    } catch (error: any) {
      toast.error("Gagal memperbarui: " + error.message)
    } finally {
      setProcessingId(null)
    }
  }

  const fetchAuditLogs = async (attendanceId: string) => {
    setLoadingAudit(true)
    setIsLogHistoryOpen(true)
    try {
      const { data, error } = await (supabase as any)
        .from('attendance_audit_logs')
        .select(`
          *,
          profiles (full_name)
        `)
        .eq('attendance_id', attendanceId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setAuditLogs(data || [])
    } catch (error: any) {
      toast.error("Gagal mengambil riwayat audit: " + error.message)
    } finally {
      setLoadingAudit(false)
    }
  }

  // Combine students and their latest logs for today
  const attendanceData = useMemo(() => {
    const today = new Date()
    const start = startOfDay(today)
    const end = endOfDay(today)

    // Create a map of student ID to their logs for extreme performance (O(N+M) instead of O(N*M))
    const studentLogsMap: Record<string, { 
      logs: any[], 
      latest: any, 
      hasPagi: boolean, 
      hasDzuhur: boolean, 
      hasPulang: boolean 
    }> = {}

    logs.forEach(log => {
      const logDate = new Date(log.created_at)
      if (logDate >= start && logDate <= end) {
        if (!studentLogsMap[log.student_id]) {
          studentLogsMap[log.student_id] = { logs: [], latest: null, hasPagi: false, hasDzuhur: false, hasPulang: false }
        }
        
        const entry = studentLogsMap[log.student_id]
        entry.logs.push(log)
        
        // Logs are sorted DESC by created_at in fetch, so the first one we see is the latest
        if (!entry.latest) entry.latest = log
        
        if (log.status === 'hadir_pagi') entry.hasPagi = true
        if (log.status === 'dzuhur') entry.hasDzuhur = true
        if (log.status === 'pulang') entry.hasPulang = true
      }
    })

    return students.map(student => {
      const entry = studentLogsMap[student.id]
      
      return {
        ...student,
        currentStatus: entry?.latest ? entry.latest.status : 'absent',
        hasPagi: entry?.hasPagi || false,
        hasDzuhur: entry?.hasDzuhur || false,
        hasPulang: entry?.hasPulang || false,
        time: entry?.latest ? entry.latest.created_at : null,
        confidence: entry?.latest ? entry.latest.confidence : null,
        log_id: entry?.latest ? entry.latest.id : null
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
                                <div className="flex items-center gap-1.5">
                                  <Badge className={
                                    log.status === 'hadir_pagi' ? 'bg-blue-100 text-blue-600' : 
                                    log.status === 'dzuhur' ? 'bg-amber-100 text-amber-600' : 
                                    'bg-emerald-100 text-emerald-600'
                                  }>
                                    {log.status === 'hadir_pagi' ? 'Pagi' : log.status === 'dzuhur' ? 'Dzuhur' : 'Pulang'}
                                  </Badge>
                                  {log.edited_at && (
                                    <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-100">
                                      Dikoreksi
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                                  {getAttendanceStatus(log.status, new Date(log.created_at)) === 'On-Time' ? 'Tepat Waktu' : 'Terlambat'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="flex flex-col items-end">
                                  <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-tighter">
                                    {format(new Date(log.created_at), "dd/MM/yy HH:mm")}
                                  </span>
                                  {log.correction_note && (
                                    <span className="text-[10px] text-slate-400 italic">"{log.correction_note}"</span>
                                  )}
                                </div>
                                
                                {isAdmin && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button type="button" className="h-8 w-8 p-0 opacity-60 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg hover:bg-slate-100 outline-none">
                                        <MoreVertical size={14} className="text-slate-400" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 rounded-xl p-1 shadow-xl border-slate-100">
                                      <DropdownMenuItem 
                                        onClick={() => handleOpenEdit(log)}
                                        className="rounded-lg gap-2 font-bold text-slate-600 cursor-pointer"
                                      >
                                        <Edit3 size={14} className="text-indigo-500" /> Koreksi Data
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => fetchAuditLogs(log.id)}
                                        className="rounded-lg gap-2 font-bold text-slate-600 cursor-pointer"
                                      >
                                        <History size={14} className="text-amber-500" /> Lihat Riwayat
                                      </DropdownMenuItem>
                                      <div className="h-px bg-slate-100 my-1" />
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteLog(log.id, log.students?.full_name)}
                                        className="rounded-lg gap-2 font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                        disabled={processingId === `delete-${log.id}`}
                                      >
                                        <Trash2 size={14} /> Batalkan Absen
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
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
                            : !isDzuhurWindow
                            ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                            : 'bg-amber-50/50 text-amber-600 hover:bg-amber-100 border-amber-100 shadow-sm'
                          }`}
                          onClick={() => handleMarkAttendance(record.id, 'dzuhur')}
                          disabled={!!processingId || record.hasDzuhur || !isDzuhurWindow || locationStatus !== 'allowed'}
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
                            : !isPulangWindow
                            ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                            : 'bg-emerald-50/50 text-emerald-600 hover:bg-emerald-100 border-emerald-100 shadow-sm'
                          }`}
                          onClick={() => handleMarkAttendance(record.id, 'pulang')}
                          disabled={!!processingId || record.hasPulang || !isPulangWindow || locationStatus !== 'allowed'}
                        >
                          {isPulang ? <Loader2 size={14} className="animate-spin mr-2" /> : <LogOut size={14} className="mr-2" />}
                          Pulang
                        </Button>
                      </div>
                      <div className="w-px h-8 bg-slate-100 hidden xl:block" />
                      <Badge className={`${config.bg} ${config.color} border-none font-black uppercase text-[10px] tracking-widest px-4 py-2.5 rounded-xl shadow-sm min-w-[110px] justify-center`}>
                        {config.label}
                      </Badge>

                      {isAdmin && record.log_id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="h-10 w-10 p-0 rounded-xl hover:bg-slate-100 shrink-0 flex items-center justify-center outline-none">
                              <MoreVertical size={18} className="text-slate-400" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 rounded-xl p-1 shadow-xl border-slate-100">
                            <DropdownMenuItem 
                              onClick={() => {
                                // Find the full log object from the logs state
                                const fullLog = logs.find(l => l.id === record.log_id);
                                if (fullLog) handleOpenEdit(fullLog);
                              }}
                              className="rounded-lg gap-2 font-bold text-slate-600 cursor-pointer h-10"
                            >
                              <Edit3 size={16} className="text-indigo-500" /> Koreksi Terakhir
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => fetchAuditLogs(record.log_id)}
                              className="rounded-lg gap-2 font-bold text-slate-600 cursor-pointer h-10"
                            >
                              <History size={16} className="text-amber-500" /> Riwayat Audit
                            </DropdownMenuItem>
                            <div className="h-px bg-slate-100 my-1" />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteLog(record.log_id, record.full_name)}
                              className="rounded-lg gap-2 font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer h-10"
                            >
                              <Trash2 size={16} /> Batalkan Absen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
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

      {/* Edit Correction Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Edit3 className="text-indigo-500" /> Koreksi Absensi
            </DialogTitle>
            <DialogDescription className="font-medium">
              Update status atau waktu kehadiran {selectedLog?.students?.full_name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="status" className="font-bold text-slate-600">Jenis Kehadiran</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="rounded-xl h-11 border-slate-200">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100">
                  <SelectItem value="hadir_pagi">Hadir Pagi</SelectItem>
                  <SelectItem value="dzuhur">Sholat Dzuhur</SelectItem>
                  <SelectItem value="pulang">Pulang Sekolah</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="time" className="font-bold text-slate-600">Waktu Absensi</Label>
              <Input
                id="time"
                type="datetime-local"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="rounded-xl h-11 border-slate-200"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason" className="font-bold text-slate-600">Alasan Koreksi</Label>
              <Textarea
                id="reason"
                placeholder="Contoh: Salah klik saat input manual..."
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                className="rounded-xl border-slate-200 min-h-[100px]"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setIsEditDialogOpen(false)} 
              className="rounded-xl font-bold"
              disabled={!!processingId}
            >
              Batal
            </Button>
            <Button 
              onClick={handleUpdateLog} 
              className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
              disabled={!!processingId}
            >
              {processingId?.startsWith('edit-') ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle2 size={16} className="mr-2" />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit History Dialog */}
      <Dialog open={isLogHistoryOpen} onOpenChange={setIsLogHistoryOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <History className="text-amber-500" /> Riwayat Audit Koreksi
            </DialogTitle>
            <DialogDescription className="font-medium">
              Log perubahan data absensi untuk siswa ini.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-6 pt-0">
            {loadingAudit ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 size={24} className="animate-spin text-amber-500" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Memuat Riwayat...</span>
              </div>
            ) : auditLogs.length > 0 ? (
              <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                {auditLogs.map((audit) => (
                  <div key={audit.id} className="relative pl-8">
                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${
                      audit.action_type === 'DELETE' ? 'bg-rose-500' : audit.action_type === 'UPDATE' ? 'bg-indigo-500' : 'bg-emerald-500'
                    }`}>
                      {audit.action_type === 'DELETE' ? <Trash2 size={10} className="text-white" /> : 
                       audit.action_type === 'UPDATE' ? <Edit3 size={10} className="text-white" /> : 
                       <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-tight text-slate-900">
                          {audit.action_type === 'DELETE' ? 'Pembatalan' : audit.action_type === 'UPDATE' ? 'Pembaruan' : 'Pencatatan'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {format(new Date(audit.created_at), "dd MMM, HH:mm")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">
                        Oleh: <span className="text-primary font-bold">{audit.profiles?.full_name || "System"}</span>
                      </p>
                      
                      {audit.new_data?.reason && (
                        <div className="mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-start gap-2">
                          <MessageSquare size={12} className="text-slate-400 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-slate-500 leading-relaxed italic">"{audit.new_data.reason || audit.old_data?.correction_note}"</p>
                        </div>
                      )}
                      
                      {audit.action_type === 'UPDATE' && (
                        <div className="mt-2 text-[10px] grid grid-cols-2 gap-2 p-2 bg-indigo-50/30 rounded-lg border border-indigo-100/50">
                          <div className="flex flex-col">
                            <span className="text-slate-400 uppercase font-black tracking-widest text-[8px]">Sebelum</span>
                            <span className="text-slate-600 font-bold">{audit.old_data?.status}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-indigo-400 uppercase font-black tracking-widest text-[8px]">Sesudah</span>
                            <span className="text-indigo-600 font-bold">{audit.new_data?.status}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-3">
                  <History size={20} />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Belum ada riwayat</h4>
                <p className="text-xs text-slate-500">Log perubahan akan muncul di sini jika ada koreksi.</p>
              </div>
            )}
          </ScrollArea>
          
          <div className="p-6 border-t bg-slate-50/50">
            <Button onClick={() => setIsLogHistoryOpen(false)} className="w-full rounded-xl font-bold bg-white border-slate-200 text-slate-600 hover:bg-slate-100">
              Tutup Panel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
