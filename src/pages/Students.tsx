import * as React from "react"
import { useState, useEffect, useMemo } from "react"
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
  Sparkles
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
  const [editingStudent, setEditingStudent] = useState<Student | undefined>(undefined)
  const [selectedForFace, setSelectedForFace] = useState<Student | null>(null)

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
    if (!confirm("Apakah Anda yakin ingin menghapus data siswa ini?")) return
    
    try {
      await studentService.delete(id)
      toast.success("Siswa berhasil dihapus")
      fetchStudents()
    } catch (error: any) {
      toast.error("Gagal menghapus siswa: " + error.message)
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
        <Button 
          onClick={handleAdd}
          className="w-full md:w-auto bg-primary text-white shadow-lg shadow-primary/20 hover:shadow-none transition-all h-11 font-bold rounded-xl"
        >
          <UserPlus className="mr-2 h-5 w-5" /> Tambah Siswa
        </Button>
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
            <div className="overflow-x-auto">
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
                            <DropdownMenuItem className="font-bold text-xs p-2.5 cursor-pointer rounded-lg">
                              <ExternalLink className="mr-2 h-4 w-4" /> Lihat Detail
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
    </div>
  )
}
