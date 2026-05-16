import * as React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import * as XLSX from 'xlsx'
import { jsPDF } from "jspdf"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Search, 
  UserPlus, 
  Filter, 
  MoreVertical, 
  Loader2, 
  UserX, 
  Edit2, 
  Trash2,
  ExternalLink,
  FileDown,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Sparkles,
  CreditCard
} from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { studentService } from "@/lib/studentService"
import { Student } from "@/types"
import { StudentForm } from "@/components/students/StudentForm"
import { FaceRegistrationModal } from "@/components/students/FaceRegistrationModal"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function Students() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClass, setSelectedClass] = useState<string>("all")
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false)
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | undefined>(undefined)
  const [selectedForFace, setSelectedForFace] = useState<Student | null>(null)
  const qrRef = useRef<HTMLCanvasElement>(null)

  const generateIDCard = async (student: Student) => {
    try {
      // Inisialisasi PDF Portrait (P) dengan ukuran ID-1 (54mm x 85.6mm)
      const doc = new jsPDF('p', 'mm', [54, 85.6]);
      const cardW = 54;
      const cardH = 85.6;

      // 1. Background Navy Deep
      doc.setFillColor(28, 35, 65); // Warna Navy yang lebih pekat
      doc.rect(0, 0, cardW, cardH, 'F');

      // 2. Aksen Gold "V" Pattern (Sesuai Gambar)
      doc.setDrawColor(184, 146, 96); // Warna Gold
      doc.setLineWidth(3); // Garis tebal
      
      // Lapisan V pertama (paling atas)
      doc.line(-5, 5, cardW / 2, 25);
      doc.line(cardW + 5, 5, cardW / 2, 25);
      
      // Lapisan V kedua (tengah)
      doc.line(-5, -5, cardW / 2, 15);
      doc.line(cardW + 5, -5, cardW / 2, 15);
      
      // Lapisan V ketiga (atas sekali)
      doc.line(-5, -15, cardW / 2, 5);
      doc.line(cardW + 5, -15, cardW / 2, 5);

      // 3. Foto Siswa (Lingkaran di Tengah)
      const photoSize = 34; // Diameter 34mm
      const centerX = cardW / 2;
      const centerY = 38; // Posisi Y pusat lingkaran

      // Lingkaran Border Gold
      doc.setDrawColor(184, 146, 96);
      doc.setLineWidth(1);
      doc.circle(centerX, centerY, (photoSize / 2) + 0.5, 'D');

      if (student.photo_url) {
        try {
          doc.saveGraphicsState();
          doc.circle(centerX, centerY, photoSize / 2, 'F');
          doc.clip();
          // Kita letakkan foto agar center di dalam clip circle
          doc.addImage(student.photo_url, 'JPEG', centerX - (photoSize / 2), centerY - (photoSize / 2), photoSize, photoSize);
          doc.restoreGraphicsState();
        } catch (e) {
          doc.setFillColor(45, 55, 85);
          doc.circle(centerX, centerY, photoSize / 2, 'F');
        }
      } else {
        doc.setFillColor(45, 55, 85);
        doc.circle(centerX, centerY, photoSize / 2, 'F');
      }

      // 4. Nama Siswa (Putih)
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      // Nama maksimal 2 baris jika terlalu panjang
      const nameParts = student.full_name.split(' ');
      const displayName = nameParts.length > 3 ? nameParts.slice(0, 3).join(' ') : student.full_name;
      doc.text(displayName.toUpperCase(), cardW / 2, 60, { align: 'center', maxWidth: 45 });

      // 5. Nama Sekolah (Gold)
      doc.setTextColor(184, 146, 96);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text("SMP NEGERI 1 MANONJAYA", cardW / 2, 66, { align: 'center' });

      // 6. Footer Layout (Garis Putih Tipis)
      doc.setDrawColor(255, 255, 255);
      doc.setAlpha(0.4);
      doc.setLineWidth(0.3);
      doc.line(5, 71, cardW - 5, 71); // Garis horizontal
      doc.setAlpha(1);

      // 7. Bagian Bawah: QR Code (Kiri) & Logo/Info (Kanan)
      // QR Code
      try {
        const qrCanvas = document.createElement('canvas');
        const QRCode = (await import('qrcode')).default;
        await QRCode.toCanvas(qrCanvas, student.nisn, {
          width: 100,
          margin: 1,
          color: {
            dark: '#FFFFFF',
            light: '#1C2341' // Sesuai navy background
          }
        });
        const qrDataUrl = qrCanvas.toDataURL('image/png');
        doc.addImage(qrDataUrl, 'PNG', 6, 73, 11, 11);
      } catch (err) {
        console.error("QR Error", err);
      }

      // Vertical Divider
      doc.setDrawColor(255, 255, 255);
      doc.setAlpha(0.4);
      doc.line(20, 72.5, 20, 83.5);
      doc.setAlpha(1);

      // School Branding (NESATMA)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text("NESATMA", 23, 79);
      
      doc.setTextColor(184, 146, 96); // Gold
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text("ID CARD", 23, 82);

      // Simpan File
      doc.save(`ID_CARD_${student.nisn}_${student.full_name.replace(/\s+/g, '_')}.pdf`);
      toast.success("ID Card Portrait Premium berhasil diunduh");
    } catch (error: any) {
      console.error("PDF Error:", error);
      toast.error("Gagal men-generate kartu: " + error.message);
    }
  };

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

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data siswa ini? Semu riwayat absensi siswa ini juga akan terhapus secara permanen.")) return
    
    try {
      console.log("Attempting to delete student with ID:", id);
      await studentService.delete(id)
      toast.success("Siswa berhasil dihapus")
      fetchStudents()
    } catch (error: any) {
      console.error("Delete Student Error:", error);
      toast.error("Gagal menghapus siswa: " + (error.message || "Pastikan Anda memiliki akses Admin"));
    }
  }

  const handleEdit = (student: Student) => {
    setEditingStudent(student)
    setIsFormOpen(true)
  }

  const handleAdd = () => {
    setEditingStudent(undefined)
    setIsFormOpen(true)
  }

  const downloadTemplate = () => {
    const headers = [
      ["NISN", "Nama Lengkap", "Kelas", "Nama Orang Tua", "No. WhatsApp", "Jenis Kelamin (L/P)"],
      ["12345678", "Contoh Siswa", "7A", "Nama Ayah/Ibu", "081234567890", "L"]
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(headers)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Siswa")
    XLSX.writeFile(workbook, "Template_Data_Siswa.xlsx")
    toast.success("Template berhasil diunduh")
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const ab = e.target?.result
          const workbook = XLSX.read(ab, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const data = XLSX.utils.sheet_to_json(sheet) as any[]

          if (data.length === 0) {
            toast.error("File excel kosong atau format tidak sesuai")
            return
          }

          // Map data to student format
          const studentsToCreate = data.map(row => ({
            nisn: String(row["NISN"] || ""),
            full_name: String(row["Nama Lengkap"] || ""),
            class_name: String(row["Kelas"] || ""),
            parent_name: String(row["Nama Orang Tua"] || ""),
            parent_phone: String(row["No. WhatsApp"] || ""),
            gender: String(row["Jenis Kelamin (L/P)"] || "L") === "P" ? "P" : "L"
          }))

          // Basic validation
          const invalidRows = studentsToCreate.filter(s => !s.nisn || !s.full_name || !s.class_name)
          if (invalidRows.length > 0) {
            toast.error(`${invalidRows.length} baris data tidak lengkap. Mohon periksa kembali.`)
            return
          }

          await studentService.bulkCreate(studentsToCreate)
          toast.success(`${studentsToCreate.length} data siswa berhasil diimpor`)
          setIsBulkImportOpen(false)
          fetchStudents()
        } catch (err: any) {
          toast.error("Gagal memproses file: " + err.message)
        }
      }
      reader.readAsArrayBuffer(file)
    } finally {
      setImporting(false)
    }
  }

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-sans">Manajemen Siswa</h1>
          <p className="text-muted-foreground">Kelola data induk siswa, wali murid, dan dokumentasi foto.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <Button 
            variant="outline"
            onClick={() => setIsBulkImportOpen(true)}
            className="w-full md:w-auto border-primary/20 text-primary hover:bg-primary/5 transition-all h-11 font-bold rounded-xl"
          >
            <Upload className="mr-2 h-4 w-4" /> Import Excel
          </Button>
          <Button 
            onClick={handleAdd}
            className="w-full md:w-auto bg-primary text-white shadow-lg shadow-primary/20 hover:shadow-none transition-all h-11 font-bold rounded-xl"
          >
            <UserPlus className="mr-2 h-5 w-5" /> Tambah Siswa
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden rounded-2xl">
        <CardHeader className="bg-white border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <CardTitle className="text-lg font-bold">Daftar Induk Siswa</CardTitle>
              <Badge variant="outline" className="ml-2 bg-slate-50 text-slate-500 border-none font-mono">
                {filteredStudents.length} Total
              </Badge>
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Cari NISN atau nama..." 
                  className="pl-10 w-full md:w-[280px] bg-slate-50 border-none h-10 rounded-lg focus-visible:ring-1 focus-visible:ring-primary/20" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-50 px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
                  >
                    <Filter className="mr-2 h-4 w-4" /> 
                    {selectedClass === "all" ? "Semua Kelas" : selectedClass}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[180px]">
                    {classes.map(c => (
                      <DropdownMenuItem 
                        key={c} 
                        onClick={() => setSelectedClass(c)}
                        className="font-semibold capitalize"
                      >
                        {c === "all" ? "Semua Kelas" : c}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Memuat Data Siswa...</p>
            </div>
          ) : filteredStudents.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest pl-6">Profil Siswa</TableHead>
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest">NISN</TableHead>
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Kelas</TableHead>
                      <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Orang Tua/Wali</TableHead>
                      <TableHead className="w-[80px] pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-1 ring-slate-100">
                              <AvatarImage src={student.photo_url} />
                              <AvatarFallback className="bg-primary/5 text-primary text-xs font-black">
                                {student.full_name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{student.full_name}</span>
                                {student.face_descriptor && (
                                  <Badge className="h-4 px-1.5 bg-emerald-100 text-emerald-600 border-none font-bold text-[8px] uppercase">
                                    AI Ready
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono tracking-tighter">ID: {student.id.split('-')[0]}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[13px] text-slate-600 font-medium">{student.nisn}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-white text-primary border-primary/20 font-black text-[10px] uppercase px-2.5">
                            {student.class_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">{student.parent_name}</span>
                            <span className="text-[10px] text-muted-foreground font-medium">{student.parent_phone}</span>
                          </div>
                        </TableCell>
                        <TableCell className="pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-white hover:text-primary outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
                            >
                              <MoreVertical size={18} />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[180px] p-2 space-y-1">
                              <DropdownMenuItem 
                                onClick={() => generateIDCard(student)}
                                className="font-bold text-xs p-2.5 cursor-pointer rounded-lg text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50"
                              >
                                <CreditCard className="mr-2 h-4 w-4" /> Cetak Kartu QR
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedForFace(student)
                                  setIsFaceModalOpen(true)
                                }}
                                className="font-bold text-xs p-2.5 cursor-pointer rounded-lg text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50"
                              >
                                <Sparkles className="mr-2 h-4 w-4" /> Register Face
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleEdit(student)}
                                className="font-bold text-xs p-2.5 cursor-pointer rounded-lg text-blue-600 focus:text-blue-700 focus:bg-blue-50"
                              >
                                <Edit2 className="mr-2 h-4 w-4" /> Edit Data
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(student.id)}
                                className="font-bold text-xs p-2.5 cursor-pointer rounded-lg text-destructive focus:text-destructive focus:bg-destructive/5"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Hapus Siswa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="p-4 flex items-center gap-4 active:bg-slate-50 transition-colors">
                    <div className="relative" onClick={() => {
                      setSelectedForFace(student)
                      setIsFaceModalOpen(true)
                    }}>
                      <Avatar className="h-14 w-14 border-2 border-white shadow-md ring-1 ring-slate-100 rounded-2xl">
                        <AvatarImage src={student.photo_url} className="rounded-2xl" />
                        <AvatarFallback className="bg-primary/5 text-primary text-lg font-black rounded-2xl">
                          {student.full_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {student.face_descriptor && (
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-lg p-1 shadow-lg shadow-emerald-500/20 border-2 border-white">
                          <CheckCircle className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0" onClick={() => handleEdit(student)}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-slate-900 truncate pr-2">{student.full_name}</span>
                        <Badge variant="outline" className="bg-primary/5 text-primary border-none font-black text-[9px] px-2 py-0 h-4">
                          {student.class_name}
                        </Badge>
                      </div>
                      <p className="text-[10px] font-mono text-slate-400 mb-1">NISN: {student.nisn}</p>
                      <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                         <p className="text-[10px] font-bold text-slate-500 truncate">Ortu: {student.parent_name}</p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 shrink-0"
                      >
                        <MoreVertical size={18} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px] p-2">
                        <DropdownMenuItem onClick={() => generateIDCard(student)} className="font-bold text-xs p-3 text-indigo-600">
                          <CreditCard className="mr-2 h-4 w-4" /> Cetak Kartu
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(student)} className="font-bold text-xs p-3">
                          <Edit2 className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                            setSelectedForFace(student)
                            setIsFaceModalOpen(true)
                          }} className="font-bold text-xs p-3 text-emerald-600">
                          <Sparkles className="mr-2 h-4 w-4" /> Face AI
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(student.id)} className="font-bold text-xs p-3 text-rose-500">
                          <Trash2 className="mr-2 h-4 w-4" /> Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center gap-4">
              <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center">
                <UserX size={40} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Data Siswa Tidak Ditemukan</h3>
                <p className="text-sm text-muted-foreground max-w-[300px]">Coba sesuaikan pencarian atau filter Anda untuk mendapatkan hasil lainnya.</p>
              </div>
              <Button 
                variant="outline" 
                className="mt-2 font-bold text-slate-600 border-none bg-slate-50 hover:bg-slate-100"
                onClick={() => { setSearchQuery(""); setSelectedClass("all"); }}
              >
                Reset Filter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[600px] border-none shadow-2xl p-0 overflow-hidden rounded-3xl">
          <div className="bg-primary p-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-2xl font-black italic">{editingStudent ? "Ubah Data Siswa" : "Tambah Siswa Baru"}</DialogTitle>
              <DialogDescription className="text-primary-foreground/70 font-medium">
                {editingStudent ? "Pastikan data induk siswa tetap akurat dan mutakhir." : "Lengkapi semua informasi dasar siswa dan orang tua wali."}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-8 bg-white">
            <StudentForm 
              student={editingStudent} 
              onSuccess={() => {
                setIsFormOpen(false)
                fetchStudents()
              }} 
              onCancel={() => setIsFormOpen(false)} 
            />
          </div>
        </DialogContent>
      </Dialog>

      <FaceRegistrationModal
        student={selectedForFace}
        isOpen={isFaceModalOpen}
        onClose={() => {
          setIsFaceModalOpen(false)
          setSelectedForFace(null)
        }}
        onSuccess={fetchStudents}
      />

      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
        <DialogContent className="sm:max-w-[500px] border-none shadow-2xl p-0 overflow-hidden rounded-3xl">
          <div className="bg-indigo-600 p-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tight">Bulk Import Siswa</DialogTitle>
              <DialogDescription className="text-indigo-100 font-medium opacity-80">
                Tambah data siswa dalam jumlah besar menggunakan file Excel.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-8 bg-white space-y-6">
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Download className="w-4 h-4 text-indigo-600" /> Tahap 1: Unduh Template
                </h4>
                <p className="text-[11px] text-slate-500 font-medium mb-4 leading-relaxed">
                  Gunakan format kolom yang sudah kami sediakan agar data dapat terbaca oleh sistem dengan sempurna.
                </p>
                <Button 
                  onClick={downloadTemplate}
                  variant="outline" 
                  className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold rounded-xl text-xs h-10"
                >
                  Download Excel Template
                </Button>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Upload className="w-4 h-4 text-emerald-600" /> Tahap 2: Unggah File
                </h4>
                <p className="text-[11px] text-slate-500 font-medium mb-4 leading-relaxed">
                  Pastikan file berekstensi .xlsx atau .xls dan semua kolom wajib (NISN, Nama, Kelas) sudah terisi.
                </p>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={importing}
                  />
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 bg-white group-hover:border-emerald-300 transition-colors">
                    {importing ? (
                      <>
                        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                        <span className="text-[10px] font-bold text-slate-400">MEMPROSES DATA...</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-8 h-8 text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Klik atau seret file ke sini</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-[10px] font-bold text-amber-800 leading-tight">
                Data dengan NISN yang sama akan ditolak secara otomatis oleh sistem keamanan database.
              </p>
            </div>
            
            <div className="pt-2">
              <Button 
                onClick={() => setIsBulkImportOpen(false)}
                variant="ghost" 
                className="w-full font-bold text-slate-500 hover:text-slate-700"
              >
                Batalkan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
