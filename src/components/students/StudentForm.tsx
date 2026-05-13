import * as React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Student } from "@/types"
import { studentService } from "@/lib/studentService"
import { Loader2, Camera, Upload } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface StudentFormProps {
  student?: Student
  onSuccess: () => void
  onCancel: () => void
}

export function StudentForm({ student, onSuccess, onCancel }: StudentFormProps) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    nisn: "",
    full_name: "",
    class_name: "",
    parent_name: "",
    parent_phone: "",
    photo_url: ""
  })

  useEffect(() => {
    if (student) {
      setFormData({
        nisn: student.nisn,
        full_name: student.full_name,
        class_name: student.class_name,
        parent_name: student.parent_name,
        parent_phone: student.parent_phone,
        photo_url: student.photo_url || ""
      })
    }
  }, [student])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const publicUrl = await studentService.uploadPhoto(file)
      setFormData(prev => ({ ...prev, photo_url: publicUrl }))
      toast.success("Foto berhasil diunggah")
    } catch (error: any) {
      console.error(error)
      toast.error("Gagal mengunggah foto: " + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (student) {
        await studentService.update(student.id, formData)
        toast.success("Data siswa berhasil diperbarui")
      } else {
        await studentService.create(formData)
        toast.success("Siswa baru berhasil ditambahkan")
      }
      onSuccess()
    } catch (error: any) {
      console.error(error)
      toast.error("Gagal menyimpan data: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="relative group">
          <Avatar className="w-24 h-24 border-2 border-slate-100 ring-2 ring-primary/10">
            <AvatarImage src={formData.photo_url} />
            <AvatarFallback className="bg-slate-50 text-slate-400">
              {formData.full_name?.charAt(0) || <Camera size={32} />}
            </AvatarFallback>
          </Avatar>
          <Label 
            htmlFor="photo-upload" 
            className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          </Label>
          <input 
            id="photo-upload" 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </div>
        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest text-center">
          Foto Profil Siswa
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nisn" className="text-xs font-bold uppercase tracking-wider text-slate-500">NISN</Label>
          <Input 
            id="nisn" 
            name="nisn"
            placeholder="Contoh: 0012345678" 
            className="h-11 bg-slate-50 border-none rounded-lg" 
            value={formData.nisn}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="full_name" className="text-xs font-bold uppercase tracking-wider text-slate-500">Nama Lengkap</Label>
          <Input 
            id="full_name" 
            name="full_name"
            placeholder="Masukkan nama lengkap" 
            className="h-11 bg-slate-50 border-none rounded-lg" 
            value={formData.full_name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="class_name" className="text-xs font-bold uppercase tracking-wider text-slate-500">Kelas</Label>
          <Input 
            id="class_name" 
            name="class_name"
            placeholder="Contoh: XII IPA 1" 
            className="h-11 bg-slate-50 border-none rounded-lg" 
            value={formData.class_name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="parent_name" className="text-xs font-bold uppercase tracking-wider text-slate-500">Nama Orang Tua/Wali</Label>
          <Input 
            id="parent_name" 
            name="parent_name"
            placeholder="Masukkan nama wali" 
            className="h-11 bg-slate-50 border-none rounded-lg" 
            value={formData.parent_name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="parent_phone" className="text-xs font-bold uppercase tracking-wider text-slate-500">No. HP Orang Tua</Label>
          <Input 
            id="parent_phone" 
            name="parent_phone"
            placeholder="Contoh: 081234567890" 
            className="h-11 bg-slate-50 border-none rounded-lg" 
            value={formData.parent_phone}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <Button 
          type="button" 
          variant="ghost" 
          className="flex-1 h-11 font-bold text-slate-500"
          onClick={onCancel}
          disabled={loading}
        >
          Batal
        </Button>
        <Button 
          type="submit" 
          className="flex-1 h-11 bg-primary text-white font-bold shadow-lg shadow-primary/20"
          disabled={loading || uploading}
        >
          {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
          {student ? "Simpan Perubahan" : "Tambah Siswa"}
        </Button>
      </div>
    </form>
  )
}
