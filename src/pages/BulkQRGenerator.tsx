import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import QRCode from "qrcode"
import * as XLSX from 'xlsx'
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Loader2, 
  Grid, 
  List as ListIcon,
  ChevronLeft,
  FileDown,
  Printer,
  RefreshCw
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
  const [isGeneratingPrintQR, setIsGeneratingPrintQR] = useState(false)

  // Generate all QR URLs for printing
  const [printData, setPrintData] = useState<Record<string, string>>({})
  
  const fetchStudents = async () => {
    setLoading(true)
    try {
      const data = await studentService.getAll()
      setStudents(data)
      
      // Pre-generate QR codes for print
      setIsGeneratingPrintQR(true)
      setTimeout(async () => {
        try {
          const qrPromises = data.map(async (s) => {
            const url = await QRCode.toDataURL(s.nisn, { 
              width: 200, 
              margin: 1,
              color: { dark: '#0f172a', light: '#ffffff' }
            })
            return { id: s.id, url }
          })
          const results = await Promise.all(qrPromises)
          const map: Record<string, string> = {}
          results.forEach(r => map[r.id] = r.url)
          setPrintData(map)
        } catch (err) {
          console.error("Failed to generate print QRs", err)
        } finally {
          setIsGeneratingPrintQR(false)
        }
      }, 800)
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

  const handlePrint = () => {
    if (isGeneratingPrintQR) {
      toast.info("Sedang menyiapkan data QR... Mohon tunggu sebentar.")
      return
    }
    if (Object.keys(printData).length === 0) {
      toast.error("Data QR belum siap. Silakan refresh halaman.")
      return
    }
    
    // Check if we are in an iframe (AI Studio preview environment)
    if (window.self !== window.top) {
      toast.warning("Pencetakan mungkin terbatas dalam mode preview. Jika gagal, silakan buka aplikasi di tab baru.")
    }
    
    setTimeout(() => {
      window.print()
    }, 300)
  }

  const downloadAllAsExcel = () => {
    // Professional worksheet with clear structure
    const worksheetData = [
      ["REKAPITULASI DATA QR CODE SISWA"],
      ["SMP NEGERI 1 MANONJAYA"],
      [`Tanggal Ekspor: ${new Date().toLocaleString('id-ID')}`],
      [""],
      ["NO", "NISN / ID SISWA", "NAMA LENGKAP", "KELAS", "KETERANGAN"],
    ]

    filteredStudents.forEach((s, index) => {
      worksheetData.push([
        (index + 1).toString(),
        s.nisn,
        s.full_name.toUpperCase(),
        s.class_name,
        "Siap Generate ID Card"
      ])
    })
    
    // Add guidance for the user within the Excel
    worksheetData.push([""])
    worksheetData.push(["PANDUAN PENGOLAHAN EKSTERNAL:"])
    worksheetData.push(["1. Kolom 'NISN / ID SISWA' adalah kunci untuk generate QR Code."])
    worksheetData.push(["2. Anda dapat menggunakan fitur Mail Merge di CorelDraw atau software ID Publisher."])
    worksheetData.push(["3. Hubungkan data ini ke template desain kartu Anda."])
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    
    // Professional formatting
    worksheet['!cols'] = [
      { wch: 6 },   // No
      { wch: 20 },  // NISN
      { wch: 45 },  // Nama
      { wch: 15 },  // Kelas
      { wch: 25 }   // Keterangan
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Siswa")
    
    const fileName = `EKSPOR_ID_CARD_${selectedClass === 'all' ? 'SEMUA_SISWA' : 'KELAS_' + selectedClass}_${new Date().getTime()}.xlsx`
    XLSX.writeFile(workbook, fileName)
    
    toast.success("File Excel Profesional SIAP! Silakan gunakan untuk olah data kartu eksternal.")
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 min-h-screen bg-slate-50/30">
      <style>{`
        #print-area { display: none; }
        
        @media print {
          /* Reset common UI elements */
          body, html {
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
          }

          /* Hide ALL layout containers except the ones containing print-area */
          header, 
          nav, 
          aside,
          footer,
          .md\\:hidden,
          .print-hidden,
          .print\\:hidden,
          .bg-emerald-50,
          button,
          .Card:not(#print-area) {
            display: none !important;
          }

          /* Ensure main content wrappers don't have padding/margins that mess up A4 */
          main, 
          #root, 
          .flex-1 {
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            background: white !important;
            height: auto !important;
          }

          #print-area { 
            display: block !important;
            visibility: visible !important;
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 15mm 24mm !important; /* Centering the 162mm grid on 210mm paper */
            background: white !important;
            margin: 0 auto !important;
          }
          
          #print-area * {
            visibility: visible !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 54mm) !important;
            gap: 4mm !important; /* Small gap for cutting space */
            width: fit-content !important;
          }

          .card-print {
            width: 54mm;
            height: 86mm;
            border: 0.2pt solid #e2e8f0;
            border-radius: 2mm;
            padding: 4mm 3mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            background: white !important;
            position: relative;
            overflow: hidden;
            box-sizing: border-box;
            page-break-inside: avoid;
            text-align: center;
          }

          /* Guide marks for cutting */
          .card-print::before, .card-print::after {
            content: '';
            position: absolute;
            width: 3mm;
            height: 3mm;
            border: 0.1pt solid #cbd5e1;
            pointer-events: none;
          }
          .card-print::before { top: 0; left: 0; border-right: none; border-bottom: none; }
          .card-print::after { bottom: 0; right: 0; border-left: none; border-top: none; }
          
          .page-break { 
            display: block !important;
            page-break-after: always; 
            height: 0;
            grid-column: 1 / -1;
          }
          
          @page { 
            size: A4 portrait; 
            margin: 0mm; 
          }
        }
      `}</style>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-4 md:px-0 print:hidden">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild className="-ml-2 h-8">
              <Link to="/students">
                <ChevronLeft className="h-4 w-4 mr-1" /> Kembali ke Siswa
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bulk Data Export & Print</h1>
          <p className="text-muted-foreground font-medium">Layanan ekspor data massal dan cetak kartu identitas otomatis.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={downloadAllAsExcel}
            variant="outline"
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-11 font-bold rounded-xl px-4"
          >
            <FileDown className="mr-2 h-5 w-5" /> Export Excel
          </Button>
          <Button 
            onClick={handlePrint}
            disabled={isGeneratingPrintQR}
            className="bg-slate-900 hover:bg-slate-800 text-white shadow-xl transition-all h-11 font-bold rounded-xl px-6"
          >
            {isGeneratingPrintQR ? (
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Printer className="mr-2 h-5 w-5" />
            )}
            {isGeneratingPrintQR ? "Memproses QR..." : "Cetak Kartu A4 (9/Hal)"}
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-2xl print:hidden">
        <CardHeader className="bg-white border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input 
                  id="search-students-bulk"
                  name="search-students-bulk"
                  placeholder="Cari nama atau NISN..." 
                  className="w-full md:w-[300px] bg-slate-50 border-none h-11 focus:ring-2 focus:ring-emerald-500 rounded-xl" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select 
                id="class-filter-bulk"
                name="class-filter-bulk"
                className="h-11 bg-slate-50 border-none rounded-xl px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
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
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <Button 
                variant={viewMode === "grid" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "bg-white shadow-sm font-bold h-9 rounded-lg" : "text-slate-500 h-9"}
              >
                <Grid className="h-4 w-4 mr-1" /> Grid View
              </Button>
              <Button 
                variant={viewMode === "list" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "bg-white shadow-sm font-bold h-9 rounded-lg" : "text-slate-500 h-9"}
              >
                <ListIcon className="h-4 w-4 mr-1" /> List View
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Status Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
               <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
               <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">
                 Kesiapan Data: {filteredStudents.length} Siswa ditemukan
               </p>
            </div>
            <p className="text-xs text-slate-400 font-medium italic hidden md:block">
              Pratinjau data sebelum melakukan ekspor akhir.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
              <p className="text-sm font-bold text-slate-400">Menghubungkan ke database...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-slate-50 p-4 rounded-full mb-4">
                <Search className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="font-bold text-slate-900">Data Tidak Ditemukan</h3>
              <p className="text-sm text-slate-500 max-w-xs">Gunakan kata kunci pencarian lain atau pilih kelas yang berbeda.</p>
            </div>
          ) : (
            <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" : "space-y-3"}>
              {filteredStudents.map((student: Student) => (
                <QRCard key={student.id} student={student} mode={viewMode} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden Print Area */}
      <div id="print-area">
        <div className="print-grid">
          {filteredStudents.map((student, index) => (
            <React.Fragment key={student.id}>
              <div className="card-print">
                {/* Header Text */}
                <div className="flex flex-col items-center">
                  <span className="text-[14pt] font-black text-slate-800 leading-tight uppercase tracking-tight">SCAN HERE</span>
                  <span className="text-[7pt] font-bold text-slate-500 uppercase tracking-[0.25em] -mt-1">FOR ATTENDANCE</span>
                </div>
                
                {/* QR Section with Frame */}
                <div className="relative p-2.5">
                  {/* Corner Borders (Scanning Frame) */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-slate-900 rounded-tl-[1.5mm]" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-slate-900 rounded-tr-[1.5mm]" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-slate-900 rounded-bl-[1.5mm]" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-slate-900 rounded-br-[1.5mm]" />
                  
                  {printData[student.id] ? (
                    <img src={printData[student.id]} className="w-[32mm] h-[32mm] object-contain p-1" alt="QR" />
                  ) : (
                    <div className="w-[32mm] h-[32mm] flex items-center justify-center text-[6pt] text-slate-300 italic">
                      Generating...
                    </div>
                  )}
                </div>
 
                {/* Footer Info */}
                <div className="flex flex-col items-center">
                   <span className="text-[9pt] font-black text-slate-900 leading-none uppercase mb-1">{student.full_name}</span>
                   <span className="text-[8pt] font-bold text-slate-600 leading-none mb-1">{student.nisn}</span>
                   <span className="text-[8pt] font-black text-slate-700 leading-none">{student.class_name}</span>
                </div>
 
                {/* Team Pill */}
                <div className="bg-slate-800 text-white text-[6pt] w-full py-1.5 rounded-xl font-black tracking-[0.2em] uppercase shrink-0">
                  TIM NESATMA
                </div>
              </div>
              {/* Force page break after 9 cards (3 columns x 3 rows) */}
              {(index + 1) % 9 === 0 && (index + 1) !== filteredStudents.length && (
                <div className="page-break" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* External Guideline Box */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col md:flex-row items-center md:items-start gap-4 mx-4 md:mx-0 shadow-sm print:hidden">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-emerald-200">
           <FileDown className="h-8 w-8 text-emerald-600" />
        </div>
        <div className="text-center md:text-left">
          <h3 className="font-bold text-emerald-900 text-lg mb-1">Panduan Pengolahan Data</h3>
          <p className="text-sm text-emerald-700 leading-relaxed max-w-3xl">
            Aplikasi ini telah menyediakan data dalam format Excel yang rapi. 
            Anda dapat menggunakan software desain kartu identitas profesional untuk mengimpor file Excel tersebut. 
            QR Code akan dihasilkan secara otomatis oleh software desain Anda berdasarkan kolom <strong>NISN / ID SISWA</strong> yang ada di file Excel tersebut.
          </p>
        </div>
      </div>
    </div>
  )
}

function QRCard({ student, mode }: { student: Student, mode: "grid" | "list", key?: string }) {
  const [qrUrl, setQrUrl] = useState<string>("")

  useEffect(() => {
    // We still generate QR for preview on screen, but removal of print logic prevents print issues
    QRCode.toDataURL(student.nisn, {
      width: mode === "grid" ? 300 : 150,
      margin: 1,
      color: {
        dark: '#334155',
        light: '#ffffff'
      }
    })
    .then(url => setQrUrl(url))
    .catch(err => console.error(err))
  }, [student.nisn, mode])

  if (mode === "list") {
    return (
      <div className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl hover:border-emerald-200 transition-colors shadow-sm">
        {qrUrl ? (
          <img src={qrUrl} className="w-14 h-14 shrink-0 bg-slate-50 p-1 rounded-lg border border-slate-100" alt={`QR ${student.nisn}`} />
        ) : (
          <div className="w-14 h-14 bg-slate-50 animate-pulse rounded-lg shrink-0" />
        )}
        <div className="flex-1">
          <h4 className="font-bold text-slate-900 text-sm leading-tight mb-1">{student.full_name}</h4>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-slate-500">NISN: {student.nisn}</span>
            <Badge variant="secondary" className="text-[10px] h-5 px-2 font-bold bg-slate-100 text-slate-700 border-none">{student.class_name}</Badge>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center p-4 bg-white border border-slate-100 rounded-2xl text-center group hover:border-emerald-200 transition-all shadow-sm">
      <div className="bg-slate-50 p-2 rounded-xl mb-3 border border-transparent group-hover:border-emerald-100 transition-all">
        {qrUrl ? (
          <img src={qrUrl} className="w-full max-w-[120px] mx-auto opacity-80 group-hover:opacity-100" alt={`QR ${student.nisn}`} />
        ) : (
          <div className="w-[120px] h-[120px] bg-slate-50 animate-pulse rounded-lg" />
        )}
      </div>
      <h4 className="font-bold text-slate-900 text-xs leading-tight mb-1 line-clamp-1 group-hover:text-emerald-700">{student.full_name}</h4>
      <p className="text-[9px] font-mono text-slate-400 mb-2 font-bold uppercase">{student.nisn}</p>
      <Badge variant="outline" className="text-[9px] h-5 px-2 bg-slate-50 border-slate-200 font-bold">{student.class_name}</Badge>
    </div>
  )
}
