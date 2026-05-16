import * as React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import QRCode from "qrcode"
import * as XLSX from 'xlsx'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Printer, 
  Search, 
  Loader2, 
  Grid, 
  List as ListIcon,
  ChevronLeft,
  FileDown
} from "lucide-react"
import { studentService } from "@/lib/studentService"
import { Student } from "@/types"
import { toast } from "sonner"
import { Link } from "react-router-dom"

export default function BulkQRGenerator() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClass, setSelectedClass] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  
  const fetchStudents = async () => {
    setLoading(true)
    try {
      const data = await studentService.getAll()
      setStudents(data)
    } catch (error: any) {
      toast.error("Gagal mengambil data siswa: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           s.nisn.includes(searchQuery)
      const matchesClass = selectedClass === "all" || s.class_name === selectedClass
      return matchesSearch && matchesClass
    })
  }, [students, searchQuery, selectedClass])

  const classes = useMemo(() => {
    const uniqueClasses = Array.from(new Set(students.map(s => s.class_name)))
    return ["all", ...uniqueClasses]
  }, [students])

  const downloadAllAsExcel = () => {
    // Generate technical instruction for the user
    const worksheetData = [
      ["DATA QR CODE SISWA - SMP NEGERI 1 MANONJAYA"],
      [`Tanggal Ekspor: ${new Date().toLocaleString('id-ID')}`],
      [""], // Empty row
      ["NO", "NISN/ID", "NAMA LENGKAP", "KELAS", "STATUS QR"]
    ]

    filteredStudents.forEach((s, index) => {
      worksheetData.push([
        (index + 1).toString(),
        s.nisn,
        s.full_name.toUpperCase(),
        s.class_name,
        "READY TO SCAN"
      ])
    })
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    
    // Set column widths for professional look
    worksheet['!cols'] = [
      { wch: 5 },  // No
      { wch: 15 }, // NISN
      { wch: 40 }, // Nama
      { wch: 15 }, // Kelas
      { wch: 15 }  // Status
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data_QR_Siswa")
    
    // Download
    const fileName = `REKAP_QR_SISWA_${selectedClass === 'all' ? 'SEMUA_KELAS' : 'KELAS_' + selectedClass}_${new Date().getTime()}.xlsx`
    XLSX.writeFile(workbook, fileName)
    
    toast.success("Data Excel berhasil di-generate secara profesional")
  }

  const handlePrint = () => {
    toast.info("Menyiapkan dokumen untuk dicetak...")
    setTimeout(() => {
      window.print()
    }, 500)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 min-h-screen bg-slate-50/30">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide app layout elements */
          nav, aside, header, footer, .no-print, [role="navigation"] {
            display: none !important;
          }
          
          /* Reset main container padding/margin for print */
          main, .flex-1 {
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }

          body, html {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Grid layout for printing QR cards */
          .print-container {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 10mm !important;
            padding: 10mm !important;
            width: 100% !important;
          }

          /* Card specific print styles */
          .qr-card {
            border: 1px solid #eee !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            padding: 15px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            background: white !important;
            border-radius: 8px !important;
          }

          /* Small adjustments for list mode print if needed */
          .space-y-2.print-container {
            display: block !important;
          }
          .space-y-2.print-container .qr-card {
            margin-bottom: 5mm !important;
            flex-direction: row !important;
          }
        }
      `}} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print px-4 md:px-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild className="-ml-2 h-8">
              <Link to="/students">
                <ChevronLeft className="h-4 w-4 mr-1" /> Kembali
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bulk QR Generator</h1>
          <p className="text-muted-foreground">Unduh dan cetak kode QR siswa untuk pembuatan kartu identitas eksternal.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={downloadAllAsExcel}
            className="border-primary/20 text-primary font-bold h-11 rounded-xl"
          >
            <FileDown className="mr-2 h-4 w-4" /> Export Data
          </Button>
          <Button 
            onClick={handlePrint}
            className="bg-primary text-white shadow-lg shadow-primary/20 hover:shadow-none transition-all h-11 font-bold rounded-xl"
          >
            <Printer className="mr-2 h-4 w-4" /> Cetak QR
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm no-print rounded-2xl">
        <CardHeader className="bg-white border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Cari siswa..." 
                  className="w-full md:w-[250px] bg-slate-50 border-none h-10" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select 
                className="h-10 bg-slate-50 border-none rounded-lg px-3 text-sm font-semibold outline-none"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classes.map(c => (
                  <option key={c} value={c}>
                    {c === "all" ? "Semua Kelas" : `Kelas ${c}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <Button 
                variant={viewMode === "grid" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "bg-white shadow-sm font-bold h-8" : "text-slate-500 h-8"}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === "list" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "bg-white shadow-sm font-bold h-8" : "text-slate-500 h-8"}
              >
                <ListIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500 font-medium">
              Menampilkan <strong>{filteredStudents.length}</strong> siswa
            </p>
            <p className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded">
              Gunakan mode cetak (Ctrl+P) untuk hasil terbaik
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-bold text-slate-400">Memproses QR Codes...</p>
            </div>
          ) : (
            <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 print-container" : "space-y-2 print-container"}>
              {filteredStudents.map((student: Student) => (
                <QRCard key={student.id} student={student} mode={viewMode} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invisible print view for forcing specific layout if needed, though media queries are usually better */}
    </div>
  )
}

function QRCard({ student, mode }: { student: Student, mode: "grid" | "list", key?: string }) {
  const [qrUrl, setQrUrl] = useState<string>("")

  useEffect(() => {
    QRCode.toDataURL(student.nisn, {
      width: mode === "grid" ? 300 : 150,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
    .then(url => setQrUrl(url))
    .catch(err => console.error(err))
  }, [student.nisn, mode])

  if (mode === "list") {
    return (
      <div className="flex items-center gap-4 p-3 bg-white border rounded-xl qr-card">
        {qrUrl ? (
          <img src={qrUrl} className="w-16 h-16 shrink-0" alt={`QR ${student.nisn}`} />
        ) : (
          <div className="w-16 h-16 bg-slate-100 animate-pulse rounded-lg shrink-0" />
        )}
        <div className="flex-1">
          <h4 className="font-bold text-slate-900 text-sm leading-tight">{student.full_name}</h4>
          <p className="text-[10px] font-mono text-slate-500">NISN: {student.nisn}</p>
          <Badge variant="outline" className="text-[8px] h-4 px-1.5 uppercase font-black">{student.class_name}</Badge>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center p-4 bg-white border rounded-2xl text-center qr-card">
      <div className="bg-slate-50 p-2 rounded-xl mb-3">
        {qrUrl ? (
          <img src={qrUrl} className="w-full max-w-[120px] mx-auto" alt={`QR ${student.nisn}`} />
        ) : (
          <div className="w-[120px] h-[120px] bg-slate-100 animate-pulse rounded-lg" />
        )}
      </div>
      <h4 className="font-bold text-slate-900 text-xs leading-tight mb-1 line-clamp-1">{student.full_name}</h4>
      <p className="text-[9px] font-mono text-slate-500 mb-2">{student.nisn}</p>
      <Badge variant="outline" className="text-[8px] h-4 px-1.5 uppercase font-black">{student.class_name}</Badge>
    </div>
  )
}
