import * as React from "react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, MapPin, CheckCircle2, XCircle, AlertCircle, Loader2, UserX, Search, UserCheck, LogOut, FileDown, ShieldAlert } from "lucide-react"
import { studentService } from "@/lib/studentService"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { format, startOfDay, endOfDay } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { Input } from "@/components/ui/input"
import { calculateDistance, SCHOOL_ZONE } from "@/lib/geoUtils"
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
  const [logs, setLogs] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

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
          const status = log.status === 'arrival' ? 'MASUK' : 'PULANG'
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

  const handleMarkAttendance = async (studentId: string, status: 'arrival' | 'departure') => {
    if (locationStatus !== 'allowed') {
      toast.error("Akses Ditolak: Anda berada di luar area sekolah")
      return
    }
    setProcessingId(`${studentId}-${status}`)
    try {
      await studentService.markAttendance({
        student_id: studentId,
        status,
        confidence: 1
      })
      toast.success(status === 'arrival' ? "Siswa berhasil diabsen masuk" : "Siswa berhasil diabsen pulang")
      await fetchData(false) // Refresh silent
    } catch (error: any) {
      toast.error("Gagal memproses absensi: " + error.message)
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
        status: latestLog ? latestLog.status : 'absent',
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
      case 'arrival': return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100', label: 'Hadir/Masuk' };
      case 'departure': return { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Selesai/Pulang' };
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
                        <TableHead className="font-bold text-right">Waktu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.length > 0 ? (
                        logs.map((log) => (
                          <TableRow key={log.id} className="hover:bg-slate-50/50">
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{log.students?.full_name || "Siswa Dihapus"}</span>
                                <span className="text-[10px] text-muted-foreground">{log.students?.nisn || "-"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={log.status === 'arrival' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}>
                                {log.status === 'arrival' ? 'Masuk' : 'Pulang'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono font-bold text-slate-500">
                              {format(new Date(log.created_at), "dd/MM/yy HH:mm")}
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
                const config = getStatusConfig(record.status);
                const timeStr = record.time ? format(new Date(record.time), "HH:mm:ss", { locale: localeId }) : "-";
                const isArriving = processingId === `${record.id}-arrival`;
                const isDeparting = processingId === `${record.id}-departure`;
                
                return (
                  <div key={record.id} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors group">
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
                          {record.confidence && (
                            <span className="flex items-center gap-1">
                              <AlertCircle size={12} className="text-primary" /> Confidence: {(record.confidence * 100).toFixed(1)}%
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-primary" /> {record.time ? "Camera-Gate-01" : "Belum Terdeteksi"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex flex-col md:flex-row items-center gap-2">
                         <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-9 px-3 rounded-lg font-bold text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 bg-emerald-50/50"
                          onClick={() => handleMarkAttendance(record.id, 'arrival')}
                          disabled={!!processingId || record.status === 'arrival' || locationStatus !== 'allowed'}
                        >
                          {isArriving ? <Loader2 size={14} className="animate-spin mr-2" /> : <UserCheck size={14} className="mr-2" />}
                          Hadir
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-9 px-3 rounded-lg font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700 bg-blue-50/50"
                          onClick={() => handleMarkAttendance(record.id, 'departure')}
                          disabled={!!processingId || record.status === 'departure' || locationStatus !== 'allowed'}
                        >
                          {isDeparting ? <Loader2 size={14} className="animate-spin mr-2" /> : <LogOut size={14} className="mr-2" />}
                          Pulang
                        </Button>
                      </div>
                      <div className="w-px h-8 bg-slate-100 hidden md:block" />
                      <Badge className={`${config.bg} ${config.color} border-none font-black uppercase text-[10px] tracking-widest px-4 py-2 rounded-full shadow-sm min-w-[110px] justify-center`}>
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
