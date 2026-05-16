import React, { useState } from "react"
import { 
  Search, 
  Calendar, 
  User as UserIcon, 
  ArrowLeft, 
  MapPin, 
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  GraduationCap
} from "lucide-react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { toast } from "sonner"

interface AttendanceLog {
  id: string
  status: 'hadir_pagi' | 'dzuhur' | 'pulang'
  confidence: number
  created_at: string
  captured_image: string
}

interface StudentData {
  id: string
  nisn: string
  full_name: string
  class_name: string
  photo_url: string
}

export default function ParentCheck() {
  const [nisn, setNisn] = useState("")
  const [loading, setLoading] = useState(false)
  const [student, setStudent] = useState<StudentData | null>(null)
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nisn.trim()) return

    setLoading(true)
    setHasSearched(false)
    try {
      // 1. Find student by NISN
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('nisn', nisn.trim())
        .single()

      if (studentError || !studentData) {
        setStudent(null)
        setLogs([])
        toast.error("Siswa tidak ditemukan. Periksa kembali NISN.")
        return
      }

      setStudent(studentData)

      // 2. Get today's logs for this student
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { data: logsData, error: logsError } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('student_id', studentData.id)
        .eq('is_deleted', false)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: true })

      if (logsError) throw logsError
      setLogs(logsData || [])
      
    } catch (error: any) {
      console.error('Search error:', error)
      toast.error("Terjadi kesalahan saat mencari data.")
    } finally {
      setLoading(false)
      setHasSearched(true)
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'hadir_pagi': return { label: 'Hadir Pagi', color: 'bg-emerald-500' }
      case 'dzuhur': return { label: 'Shalat Dzuhur', color: 'bg-blue-500' }
      case 'pulang': return { label: 'Pulang', color: 'bg-amber-500' }
      default: return { label: status, color: 'bg-slate-500' }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 md:p-8">
      {/* Header */}
      <div className="w-full max-w-2xl mb-8 flex items-center justify-between">
        <Link to="/login" className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors font-medium text-sm">
          <ArrowLeft size={16} className="mr-2" />
          Kembali ke Login
        </Link>
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <GraduationCap className="text-white" size={20} />
          </div>
          <span className="font-bold text-slate-800">EduPulse</span>
        </div>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* Search Card */}
        <Card className="border-none shadow-xl shadow-slate-200/60 rounded-3xl overflow-hidden">
          <CardHeader className="bg-indigo-600 text-white p-8">
            <CardTitle className="text-2xl font-bold">Cek Kehadiran Siswa</CardTitle>
            <CardDescription className="text-indigo-100/80">
              Masukkan NISN putra/putri Anda untuk melihat status kehadiran hari ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="relative flex-grow">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  placeholder="Masukkan NISN..."
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  className="pl-12 h-14 rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-indigo-500/20 text-lg font-medium"
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="h-14 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 font-bold"
              >
                {loading ? "Mencari..." : "Cari"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results Area */}
        {hasSearched && student && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Student Profile Card */}
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-6 flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-indigo-50 border-2 border-indigo-100 flex-shrink-0">
                  {student.photo_url ? (
                    <img 
                      src={supabase.storage.from('student-photos').getPublicUrl(student.photo_url).data.publicUrl} 
                      alt={student.full_name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-indigo-300">
                      <UserIcon size={32} />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{student.full_name}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <p className="text-sm text-slate-500 flex items-center font-medium">
                      <Badge variant="outline" className="mr-2 uppercase tracking-wider text-[10px]">{student.class_name}</Badge>
                      NISN: {student.nisn}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Timeline */}
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
              <CardHeader className="border-b border-slate-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Riwayat Hari Ini</CardTitle>
                  <p className="text-sm font-medium text-slate-500">
                    {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                    <div className="p-4 bg-slate-50 rounded-full mb-4">
                      <AlertCircle size={32} />
                    </div>
                    <p className="font-medium">Belum ada catatan kehadiran hari ini.</p>
                    <p className="text-sm">Siswa mungkin belum melakukan scan di tablet sekolah.</p>
                  </div>
                ) : (
                  <div className="space-y-8 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                    {logs.map((log) => {
                      const statusInfo = getStatusLabel(log.status)
                      return (
                        <div key={log.id} className="relative pl-12">
                          <div className={`absolute left-0 top-1 w-9 h-9 rounded-full ${statusInfo.color} flex items-center justify-center text-white ring-4 ring-white z-10`}>
                            <CheckCircle2 size={20} />
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-slate-800 text-lg">{statusInfo.label}</p>
                              <div className="flex items-center gap-3 mt-1 text-slate-500 text-sm">
                                <span className="flex items-center">
                                  <Clock size={14} className="mr-1.5" />
                                  Pukul {format(new Date(log.created_at), "HH:mm")} WIB
                                </span>
                                <span className="flex items-center">
                                  <MapPin size={14} className="mr-1.5" />
                                  Kamera Gerbang
                                </span>
                              </div>
                            </div>
                            {log.captured_image && (
                              <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-sm">
                                <img 
                                  src={supabase.storage.from('attendance-photos').getPublicUrl(log.captured_image).data.publicUrl} 
                                  alt="Captured" 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {hasSearched && !student && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 animate-in fade-in zoom-in duration-300">
            <div className="p-6 bg-slate-100 rounded-full mb-6">
              <XCircle size={48} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-600 mb-2">Data Tidak Ditemukan</h3>
            <p className="max-w-xs mx-auto">Kami tidak dapat menemukan data untuk NISN yang dimasukkan. Silakan cek kembali atau hubungi admin sekolah.</p>
          </div>
        )}
      </div>

      <footer className="mt-auto py-8 text-center text-slate-400 text-xs">
        <p>&copy; {new Date().getFullYear()} EduPulse Smart Attendance System</p>
      </footer>
    </div>
  )
}
