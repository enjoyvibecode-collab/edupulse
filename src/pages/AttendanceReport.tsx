import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  FileDown, 
  FileSpreadsheet, 
  FileText, 
  Calendar as CalendarIcon, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  LogOut, 
  Loader2,
  Table as TableIcon
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

// Extending jsPDF with autotable types
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export default function AttendanceReport() {
  const [logs, setLogs] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd")
  })
  const [selectedClass, setSelectedClass] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")

  const classes = useMemo(() => {
    const uniqueClasses = Array.from(new Set(students.map(s => s.class_name).filter(Boolean)))
    return ["all", ...uniqueClasses.sort()]
  }, [students])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [studentsRes, logsRes] = await Promise.all([
        supabase.from('students').select('*').order('full_name'),
        supabase.from('attendance_logs')
          .select('*, students(full_name, nisn, class_name)')
          .eq('is_deleted', false)
          .order('created_at', { ascending: true })
      ])

      if (studentsRes.error) throw studentsRes.error
      if (logsRes.error) throw logsRes.error

      setStudents(studentsRes.data || [])
      setLogs(logsRes.data || [])
    } catch (error: any) {
      toast.error("Gagal mengambil data: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredData = useMemo(() => {
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)
    end.setHours(23, 59, 59, 999)

    return students.filter(s => {
      const matchesClass = selectedClass === "all" || s.class_name === selectedClass
      const matchesSearch = s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           s.nisn.includes(searchTerm)
      return matchesClass && matchesSearch
    }).map(student => {
      const studentLogs = logs.filter(l => 
        l.student_id === student.id && 
        new Date(l.created_at) >= start && 
        new Date(l.created_at) <= end
      )

      return {
        ...student,
        logs: studentLogs
      }
    })
  }, [students, logs, dateRange, selectedClass, searchTerm])

  const exportToExcel = () => {
    try {
      const days = eachDayOfInterval({
        start: new Date(dateRange.start),
        end: new Date(dateRange.end)
      })

      const data = filteredData.map(s => {
        const row: any = {
          "Nama Siswa": s.full_name,
          "NISN": s.nisn,
          "Kelas": s.class_name || "-"
        }

        days.forEach(day => {
          const dayStr = format(day, "dd/MM")
          const dayLogs = s.logs.filter(l => isSameDay(new Date(l.created_at), day))
          
          let status = "-"
          if (dayLogs.some(l => l.status === 'hadir_pagi')) status = "H"
          if (dayLogs.some(l => l.status === 'dzuhur')) status += "D"
          if (dayLogs.some(l => l.status === 'pulang')) status += "P"
          
          row[dayStr] = status === "-" ? "A" : status.replace("-", "")
        })

        return row
      })

      const ws = XLSX.utils.json_to_sheet(data)
      
      // Mengatur lebar kolom agar profesional (wch = width in characters)
      const colWidths = [
        { wch: 30 }, // Nama Siswa
        { wch: 15 }, // NISN
        { wch: 12 }, // Kelas
      ]
      
      // Tambahkan lebar untuk kolom tanggal (rata-rata 6 karakter)
      days.forEach(() => colWidths.push({ wch: 6 }))
      
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Laporan Absensi")
      
      const fileName = `Laporan_Absensi_${selectedClass}_${dateRange.start}_${dateRange.end}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success("Excel berhasil diunduh")
    } catch (error: any) {
      toast.error("Gagal ekspor Excel: " + error.message)
    }
  }

  const exportToPDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4')
      const start = dateRange.start
      const end = dateRange.end

      doc.setFontSize(18)
      doc.text("LAPORAN ABSENSI SMART CORE EDUPULSE", 14, 22)
      
      doc.setFontSize(11)
      doc.text(`Periode: ${format(new Date(start), "d MMM yyyy")} - ${format(new Date(end), "d MMM yyyy")}`, 14, 30)
      doc.text(`Kelas: ${selectedClass === 'all' ? 'Semua Kelas' : selectedClass}`, 14, 35)

      const tableData = filteredData.map((s, index) => [
        index + 1,
        s.full_name,
        s.nisn,
        s.class_name || "-",
        s.logs.filter(l => l.status === 'hadir_pagi').length,
        s.logs.filter(l => l.status === 'dzuhur').length,
        s.logs.filter(l => l.status === 'pulang').length,
      ])

      autoTable(doc, {
        startY: 45,
        head: [['No', 'Nama Siswa', 'NISN', 'Kelas', 'Hadir Pagi', 'Dzuhur', 'Pulang']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [79, 70, 229],
          halign: 'center',
          fontSize: 10,
          fontStyle: 'bold'
        },
        styles: { 
          fontSize: 9,
          valign: 'middle'
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { fontStyle: 'bold' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'center' },
        }
      })

      doc.save(`Laporan_Absensi_${selectedClass}_${start}_${end}.pdf`)
      toast.success("PDF berhasil diunduh")
    } catch (error: any) {
      toast.error("Gagal ekspor PDF: " + error.message)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Pusat Pelaporan</h1>
          <p className="text-slate-500 font-medium">Analisis dan ekspor data kehadiran siswa secara periodik.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={exportToExcel} 
            variant="outline" 
            className="rounded-xl h-11 border-slate-200 font-bold text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button 
            onClick={exportToPDF} 
            className="rounded-xl h-11 bg-indigo-600 hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-100"
          >
            <FileText className="mr-2 h-4 w-4" /> PDF Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1 border-none shadow-sm bg-white rounded-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-500" />
              <CardTitle className="text-lg">Filter Laporan</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Pilih Kelas</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="rounded-xl h-11 border-slate-100 bg-slate-50/50">
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {classes.map(c => (
                    <SelectItem key={c} value={c}>
                      {c === "all" ? "Semua Kelas" : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Dari Tanggal</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="pl-10 rounded-xl h-11 border-slate-100 bg-slate-50/50" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Sampai Tanggal</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="pl-10 rounded-xl h-11 border-slate-100 bg-slate-50/50" 
                />
              </div>
            </div>

            <div className="pt-4">
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-tighter text-indigo-600">Smart Summary</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Siswa</p>
                    <p className="text-xl font-black text-indigo-900">{filteredData.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Log Rec.</p>
                    <p className="text-xl font-black text-indigo-900">
                      {filteredData.reduce((acc, curr) => acc + curr.logs.length, 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 border-none shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-50 pb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <TableIcon className="w-5 h-5 text-indigo-500" />
                <div>
                  <CardTitle className="text-lg">Preview Data Kehadiran</CardTitle>
                  <CardDescription className="text-xs font-bold uppercase tracking-wider">
                    {format(new Date(dateRange.start), "d MMM")} - {format(new Date(dateRange.end), "d MMM yyyy")}
                  </CardDescription>
                </div>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input 
                  placeholder="Cari siswa atau NISN..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-full bg-slate-50 border-none h-10 focus-visible:ring-1 focus-visible:ring-indigo-100" 
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-300">Mengolah Data Laporan...</p>
              </div>
            ) : filteredData.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Siswa</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Kelas</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">Pagi</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">Dzuhur</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">Pulang</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-right">Persentase</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((s) => {
                      const pagiCount = s.logs.filter(l => l.status === 'hadir_pagi').length
                      const dzuhurCount = s.logs.filter(l => l.status === 'dzuhur').length
                      const pulangCount = s.logs.filter(l => l.status === 'pulang').length
                      
                      const totalDays = eachDayOfInterval({
                        start: new Date(dateRange.start),
                        end: new Date(dateRange.end)
                      }).length
                      
                      const percentage = ((pagiCount / totalDays) * 100).toFixed(1)

                      return (
                        <TableRow key={s.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{s.full_name}</span>
                              <span className="text-[10px] font-mono text-slate-400">{s.nisn}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                              {s.class_name || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-[10px] font-black text-blue-600">
                                {pagiCount}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center text-[10px] font-black text-amber-600">
                                {dzuhurCount}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center text-[10px] font-black text-emerald-600">
                                {pulangCount}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                             <div className="flex flex-col items-end">
                               <span className={`text-sm font-black ${
                                 Number(percentage) >= 90 ? 'text-emerald-600' : 
                                 Number(percentage) >= 75 ? 'text-indigo-600' : 'text-rose-600'
                               }`}>
                                 {percentage}%
                               </span>
                               <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                 <div 
                                    className={`h-full rounded-full ${
                                      Number(percentage) >= 90 ? 'bg-emerald-500' : 
                                      Number(percentage) >= 75 ? 'bg-indigo-500' : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                               </div>
                             </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-24 flex flex-col items-center justify-center text-center gap-4">
                <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center">
                  <FileText size={40} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Data Kosong</h3>
                  <p className="text-sm text-slate-400 max-w-[300px]">
                    Tidak ada data kehadiran yang ditemukan untuk periode dan filter ini.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
