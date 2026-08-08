import * as React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import * as XLSX from 'xlsx'
import { jsPDF } from "jspdf"
import html2canvas from "html2canvas"
import QRCode from "qrcode"
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
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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
  QrCode,
  ArrowUpCircle
} from "lucide-react"
import { Link } from "react-router-dom"
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
import { supabase } from "@/lib/supabase"
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
  const [faceFilter, setFaceFilter] = useState<"all" | "registered" | "unregistered">("all")
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false)
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)
  const [isBulkPromoteOpen, setIsBulkPromoteOpen] = useState(false)
  const [promotingClass, setPromotingClass] = useState(false)
  const [sourceClass, setSourceClass] = useState("")
  const [targetClassInput, setTargetClassInput] = useState("")
  const [importing, setImporting] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | undefined>(undefined)
  const [selectedForFace, setSelectedForFace] = useState<Student | null>(null)

  const fetchStudents = async () => {
    setLoading(true)
    try {
      const data = await studentService.getAll()
      setStudents(data)
    } catch (error: any) {
      console.warn("Gagal mengambil data siswa:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()

    const channel = supabase
      .channel('realtime_students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, () => {
        studentService.clearCache();
        fetchStudents()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
      ["NISN", "Nama Lengkap", "Kelas", "Nama Orang Tua", "No. WhatsApp"],
      ["12345678", "Contoh Siswa", "7A", "Nama Ayah/Ibu", "081234567890"]
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
            setImporting(false)
            return
          }

          // Case-insensitive & helper search for excel keys in row
          const findValueByPossibleKeys = (row: any, ...keys: string[]): string => {
            const rowKeys = Object.keys(row);
            
            // 1. Exact matches
            for (const k of keys) {
              if (row[k] !== undefined && row[k] !== null) {
                return String(row[k]).trim();
              }
            }
            
            // 2. Normalized/lower case match without space/symbols
            for (const rk of rowKeys) {
              const rkLower = rk.toLowerCase().trim();
              for (const k of keys) {
                const kLower = k.toLowerCase().trim();
                if (rkLower === kLower || rkLower.replace(/[^a-z0-9]/g, "") === kLower.replace(/[^a-z0-9]/g, "")) {
                  return String(row[rk]).trim();
                }
              }
            }

            // 3. Word substring match (e.g. "nama" inside "nama lengkap", "ortu" in "nama ortu")
            for (const rk of rowKeys) {
              const rkLower = rk.toLowerCase().trim();
              for (const k of keys) {
                const kLower = k.toLowerCase().trim();
                if (rkLower.includes(kLower)) {
                  return String(row[rk]).trim();
                }
              }
            }

            return "";
          };

          // Map data to student format
          const rawStudents = data.map(row => {
            const nisn = findValueByPossibleKeys(row, "NISN", "Nisn", "nisn", "No Induk", "id").trim();
            const full_name = findValueByPossibleKeys(row, "Nama Lengkap", "nama", "Nama Siswa", "Nama", "full_name").trim();
            const class_name = findValueByPossibleKeys(row, "Kelas", "kelas", "class", "Class", "class_name").trim();
            const parent_name = findValueByPossibleKeys(row, "Nama Orang Tua", "Nama Ortu", "orang tua", "ortu", "wali", "Wali", "parent_name").trim();
            const parent_phone = findValueByPossibleKeys(row, "No. WhatsApp", "No WhatsApp", "No. WA", "No WA", "WhatsApp", "whatsapp", "wa", "parent_phone").trim();

            return {
              nisn,
              full_name,
              class_name,
              parent_name: parent_name || "Orang Tua/Wali",
              parent_phone: parent_phone || "-"
            };
          });

          // Filter out completely blank lines at bottom of excel sheet
          const activeRows = rawStudents.filter(s => s.nisn || s.full_name || s.class_name);

          // Find rows where critical keys (NISN, Nama Lengkap, or Kelas) are missing
          const invalidRows = activeRows.filter(s => !s.nisn || !s.full_name || !s.class_name);
          const validRows = activeRows.filter(s => s.nisn && s.full_name && s.class_name);

          if (validRows.length === 0) {
            toast.error("Tidak ada data siswa valid. Pastikan kolom wajib (NISN, Nama Lengkap, Kelas) sudah terisi.");
            setImporting(false);
            return;
          }

          // Deduplicate NISNs within the spreadsheets to avoid duplicates in the same batch
          const seenNisns = new Set<string>();
          const uniqueUploaded = [];
          let duplicateInSheetCount = 0;

          for (const item of validRows) {
            if (seenNisns.has(item.nisn)) {
              duplicateInSheetCount++;
              continue;
            }
            seenNisns.add(item.nisn);
            uniqueUploaded.push(item);
          }

          // Check against the Supabase database to avoid unique constraint violating errors
          const existingStudents = await studentService.getAll();
          const existingMap = new Map<string, Student>();
          existingStudents.forEach(s => existingMap.set(s.nisn, s));

          const toInsert: any[] = [];
          const toUpdate: any[] = [];

          for (const item of uniqueUploaded) {
            const existing = existingMap.get(item.nisn);
            if (existing) {
              toUpdate.push({
                id: existing.id,
                nisn: item.nisn,
                full_name: item.full_name,
                class_name: item.class_name,
                parent_name: item.parent_name || existing.parent_name || "Orang Tua/Wali",
                parent_phone: item.parent_phone || existing.parent_phone || "-",
                photo_url: existing.photo_url || null,
                face_descriptor: existing.face_descriptor || null,
                created_at: existing.created_at
              });
            } else {
              toInsert.push(item);
            }
          }

          let insertResultCount = 0;
          let updateResultCount = 0;

          if (toInsert.length > 0) {
            const res = await studentService.bulkCreate(toInsert);
            if (res) insertResultCount = res.length;
          }

          if (toUpdate.length > 0) {
            // Use our new bulkUpsert function to update profiles cleanly
            const res = await studentService.bulkUpsert(toUpdate);
            if (res) updateResultCount = res.length;
          }

          // Build summary message
          let summaryMessage = `${insertResultCount} siswa baru berhasil diimpor.`;
          if (updateResultCount > 0) {
            summaryMessage += ` ${updateResultCount} data siswa diperbarui.`;
          }
          if (duplicateInSheetCount > 0) {
            summaryMessage += ` (mengabaikan ${duplicateInSheetCount} duplikat di file)`;
          }
          if (invalidRows.length > 0) {
            toast.warning(`${invalidRows.length} baris tidak lengkap dilewati (NISN/Nama/Kelas kosong).`);
          }

          toast.success(summaryMessage);
          setIsBulkImportOpen(false);
          fetchStudents();
        } catch (err: any) {
          console.error("Gagal mengimpor:", err);
          toast.error("Gagal memproses file: " + (err.message || "Konflik database atau format salah"));
        } finally {
          setImporting(false);
        }
      };
      reader.onerror = () => {
        toast.error("Gagal membaca file")
        setImporting(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      toast.error("Gagal mengunggah file: " + err.message);
      setImporting(false);
    }
  };

  const handleBulkPromote = async () => {
    if (!sourceClass.trim() || !targetClassInput.trim()) {
      toast.error("Format tidak lengkap", {
        description: "Harap pilih kelas asal dan isi nama kelas baru."
      });
      return;
    }

    const normSource = sourceClass.trim();
    const normTarget = targetClassInput.trim();

    if (normSource === normTarget) {
      toast.error("Kelas Asal dan Kelas Tujuan Sama", {
        description: "Nama kelas asal dan kelas tujuan tidak boleh sama."
      });
      return;
    }

    const members = students.filter(s => s.class_name === normSource);
    if (members.length === 0) {
      toast.error("Kelas Kosong", {
        description: `Tidak ada siswa yang terdata di Kelas "${normSource}".`
      });
      return;
    }

    setPromotingClass(true);
    try {
      await studentService.bulkPromoteClasses(normSource, normTarget);
      toast.success("Kenaikan Kelas Berhasil!", {
        description: `Sebanyak ${members.length} siswa dari Kelas ${normSource} berhasil dipindahkan ke Kelas ${normTarget}.`
      });
      setIsBulkPromoteOpen(false);
      setSourceClass("");
      setTargetClassInput("");
      fetchStudents();
    } catch (error: any) {
      toast.error("Gagal memproses kenaikan kelas: " + error.message);
    } finally {
      setPromotingClass(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           s.nisn.includes(searchQuery)
      const matchesClass = selectedClass === "all" || s.class_name === selectedClass
      
      let matchesFace = true
      if (faceFilter === "registered") {
        matchesFace = !!s.face_descriptor
      } else if (faceFilter === "unregistered") {
        matchesFace = !s.face_descriptor
      }
      
      return matchesSearch && matchesClass && matchesFace
    })
  }, [students, searchQuery, selectedClass, faceFilter])

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
            <Link 
              to="/students/bulk-qr"
              className={cn(buttonVariants({ variant: "outline" }), "w-full md:w-auto bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-all h-11 font-bold rounded-xl flex items-center justify-center")}
            >
              <QrCode className="mr-2 h-4 w-4" /> Bulk QR Generate
            </Link>
            <Button 
              variant="outline"
              onClick={() => setIsBulkImportOpen(true)}
              className="w-full md:w-auto border-primary/20 text-primary hover:bg-primary/5 transition-all h-11 font-bold rounded-xl"
            >
              <Upload className="mr-2 h-4 w-4" /> Import Excel
            </Button>
            <Button 
              variant="outline"
              onClick={() => setIsBulkPromoteOpen(true)}
              className="w-full md:w-auto bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100 transition-all h-11 font-bold rounded-xl"
            >
              <ArrowUpCircle className="mr-2 h-4 w-4" /> Naik Kelas Massal
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
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-50 px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 outline-none focus-visible:ring-1 focus-visible:ring-primary/20 animate-in fade-in"
                  >
                    <Filter className="mr-2 h-4 w-4" /> 
                    {selectedClass === "all" ? "Semua Kelas" : `Kelas: ${selectedClass}`}
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

                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-50 px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 outline-none focus-visible:ring-1 focus-visible:ring-primary/20 animate-in fade-in"
                  >
                    <Sparkles className="mr-2 h-4 w-4 text-indigo-500" />
                    {faceFilter === "all" ? "Status Wajah: Semua" : faceFilter === "registered" ? "Wajah: Terdaftar" : "Wajah: Belum Terdaftar"}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuItem onClick={() => setFaceFilter("all")} className="font-semibold">
                      Semua Siswa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFaceFilter("registered")} className="font-semibold text-emerald-600">
                      Terdaftar Face AI Only
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFaceFilter("unregistered")} className="font-semibold text-rose-500">
                      Belum Terdaftar Face AI
                    </DropdownMenuItem>
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
                                {student.face_descriptor ? (
                                  <Badge className="h-4 px-1.5 bg-emerald-100 text-emerald-600 border-none font-bold text-[8px] uppercase">
                                    AI Ready
                                  </Badge>
                                ) : (
                                  <Badge className="h-4 px-1.5 bg-rose-50 text-rose-500 border border-rose-100 font-bold text-[8px] uppercase">
                                    Belum Register
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
                                onClick={() => {
                                  setSelectedForFace(student)
                                  setIsFaceModalOpen(true)
                                }}
                                className="font-bold text-xs p-2.5 cursor-pointer rounded-lg text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50"
                              >
                                <Sparkles className="mr-2 h-4 w-4" /> Register Face AI
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
                      {student.face_descriptor ? (
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-lg p-1 shadow-lg shadow-emerald-500/20 border-2 border-white">
                          <CheckCircle className="w-3 h-3" />
                        </div>
                      ) : (
                        <div className="absolute -bottom-1 -right-1 bg-rose-500 text-white rounded-lg p-1 shadow-lg shadow-rose-500/20 border-2 border-white">
                          <AlertTriangle className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0" onClick={() => handleEdit(student)}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-slate-900 truncate pr-2">{student.full_name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className="bg-primary/5 text-primary border-none font-black text-[9px] px-2 py-0 h-4">
                            {student.class_name}
                          </Badge>
                          {student.face_descriptor ? (
                            <Badge className="bg-emerald-100 text-emerald-600 border-none font-bold text-[8px] h-4 uppercase">Ready</Badge>
                          ) : (
                            <Badge className="bg-rose-100 text-rose-500 border-none font-bold text-[8px] h-4 uppercase">Belum AI</Badge>
                          )}
                        </div>
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
                        <DropdownMenuItem onClick={() => handleEdit(student)} className="font-bold text-xs p-3">
                          <Edit2 className="mr-2 h-4 w-4" /> Edit Data
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

      <Dialog open={isBulkPromoteOpen} onOpenChange={setIsBulkPromoteOpen}>
        <DialogContent className="sm:max-w-[480px] border-none shadow-2xl p-0 overflow-hidden rounded-3xl animate-in fade-in zoom-in-95">
          <div className="bg-amber-500 p-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl animate-pulse" />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <ArrowUpCircle className="w-6 h-6 animate-bounce" /> Kenaikan Kelas Massal
              </DialogTitle>
              <DialogDescription className="text-amber-50 font-semibold opacity-90">
                Pindahkan seluruh siswa dari satu kelas ke kelas baru sekaligus untuk semester/tahun baru.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-8 bg-white space-y-6">
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Fitur cerdas ini membantu Anda memperbarui data kelas secara massal tanpa perlu menghapus siswa atau mendaftarkan ulang wajah AI mereka.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500 tracking-wider">Pilih Kelas Saat Ini (Asal)</label>
                <select 
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                  value={sourceClass}
                  onChange={(e) => setSourceClass(e.target.value)}
                >
                  <option value="" disabled className="text-slate-400">--- Pilih Kelas ---</option>
                  {classes.filter(c => c !== "all").map(c => (
                    <option key={c} value={c} className="font-bold">{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500 tracking-wider">Ketik Nama Kelas Baru (Tujuan)</label>
                <Input 
                  placeholder="Contoh: 8A atau Alumni / Lulus" 
                  value={targetClassInput}
                  onChange={(e) => setTargetClassInput(e.target.value)}
                  className="h-11 rounded-xl font-bold bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>

              {sourceClass && (
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] font-bold text-amber-900 leading-normal">
                    Terdeteksi <span className="font-extrabold text-amber-700 underline">{students.filter(s => s.class_name === sourceClass).length} siswa</span> aktif di kelas <span className="underline">{sourceClass}</span>. 
                    Semua profil, wali murid, dan data wajah AI mereka akan otomatis dialihkan ke kelas <span className="underline text-emerald-600 font-extrabold">{targetClassInput || "..."}</span> dengan sangat aman!
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button 
                onClick={() => setIsBulkPromoteOpen(false)}
                variant="outline" 
                className="flex-1 border-slate-200 text-slate-500 hover:bg-slate-50 font-bold rounded-xl h-12"
                disabled={promotingClass}
              >
                Batalkan
              </Button>
              <Button 
                onClick={handleBulkPromote}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg shadow-amber-500/20 hover:shadow-none transition-all rounded-xl h-12"
                disabled={promotingClass || !sourceClass || !targetClassInput.trim()}
              >
                {promotingClass ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" /> Proses Kenaikan
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
