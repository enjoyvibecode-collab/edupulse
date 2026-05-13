import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, MapPin, CheckCircle2, XCircle, AlertCircle, Loader2, UserX, Search, UserCheck, LogOut } from "lucide-react"
import { studentService } from "@/lib/studentService"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { format, startOfDay, endOfDay } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { Input } from "@/components/ui/input"

export default function Attendance() {
  const [logs, setLogs] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

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

  const handleMarkAttendance = async (studentId: string, status: 'arrival' | 'departure') => {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-sans">Siswa & Kehadiran</h1>
          <p className="text-muted-foreground">Monitoring status kehadiran siswa hari ini: {format(new Date(), "EEEE, d MMMM yyyy", { locale: localeId })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="text-slate-600 h-11 px-4 rounded-xl font-bold">
            <Calendar className="mr-2 h-4 w-4" /> Riwayat
          </Button>
          <Button className="bg-primary text-white h-11 px-6 rounded-xl font-bold shadow-lg shadow-primary/20">
            Ekspor Laporan
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
                          disabled={!!processingId || record.status === 'arrival'}
                        >
                          {isArriving ? <Loader2 size={14} className="animate-spin mr-2" /> : <UserCheck size={14} className="mr-2" />}
                          Hadir
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-9 px-3 rounded-lg font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700 bg-blue-50/50"
                          onClick={() => handleMarkAttendance(record.id, 'departure')}
                          disabled={!!processingId || record.status === 'departure'}
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
