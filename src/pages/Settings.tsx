import * as React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { 
  Settings as SettingsIcon, 
  MapPin, 
  ShieldCheck, 
  BellRing, 
  Save, 
  RefreshCw,
  Globe,
  Trash2,
  AlertTriangle,
  Lock,
  X
} from "lucide-react"
import { toast } from "sonner"
import { SCHOOL_ZONE } from "@/lib/geoUtils"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

export default function Settings() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'platform_owner' || profile?.role === 'admin_sekolah'
  
  const [geoConfig, setGeoConfig] = useState({
    latitude: SCHOOL_ZONE.latitude,
    longitude: SCHOOL_ZONE.longitude,
    radius: SCHOOL_ZONE.radius
  })
  
  const [schoolName, setSchoolName] = useState("SMPN 1 Manonjaya")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [confirmValue, setConfirmValue] = useState("")

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSeedData = async () => {
    setSeeding(true)
    try {
      // 1. Create Mock Students
      const mockStudents = [
        { nisn: '1234567801', full_name: 'Ahmad Subarjo', class_name: '9A', parent_name: 'Bpk. Subarjo', parent_phone: '081234567890' },
        { nisn: '1234567802', full_name: 'Siti Aminah', class_name: '9B', parent_name: 'Ibu Aminah', parent_phone: '081234567891' },
        { nisn: '1234567803', full_name: 'Budi Hartanto', class_name: '9A', parent_name: 'Bpk. Hartanto', parent_phone: '081234567892' },
        { nisn: '1234567804', full_name: 'Dewi Lestari', class_name: '8C', parent_name: 'Ibu Lestari', parent_phone: '081234567893' },
        { nisn: '1234567805', full_name: 'Eko Prasetyo', class_name: '7F', parent_name: 'Bpk. Prasetyo', parent_phone: '081234567894' },
      ]

      const { data: insertedStudents, error: studentError } = await supabase
        .from('students')
        .insert(mockStudents as any)
        .select()

      if (studentError) throw studentError

      // 2. Create Today's Logs for some students
      if (insertedStudents && insertedStudents.length > 0) {
        const today = new Date()
        const mockLogs = [
          { student_id: (insertedStudents[0] as any).id, status: 'hadir_pagi', confidence: 0.98, created_at: today.toISOString() },
          { student_id: (insertedStudents[1] as any).id, status: 'hadir_pagi', confidence: 0.95, created_at: today.toISOString() },
          { student_id: (insertedStudents[0] as any).id, status: 'dzuhur', confidence: 0.92, created_at: new Date(today.getTime() + 4 * 3600000).toISOString() },
        ]

        const { error: logError } = await supabase
          .from('attendance_logs')
          .insert(mockLogs as any)

        if (logError) throw logError
      }

      toast.success("5 Siswa & Riwayat Absensi berhasil dibuat (Mock Data)!")
    } catch (error: any) {
      console.error('Error seeding data:', error)
      toast.error("Gagal membuat mock data: " + error.message)
    } finally {
      setSeeding(false)
    }
  }

  async function fetchSettings() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('settings')
        .select('*')
      
      if (error) throw error

      const geofence = (data as any[])?.find(s => s.id === 'geofence')?.value
      const profile = (data as any[])?.find(s => s.id === 'school_profile')?.value

      if (geofence) setGeoConfig(geofence)
      if (profile?.schoolName) setSchoolName(profile.schoolName)
    } catch (error: any) {
      console.error('Error fetching settings:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save Geofence
      const { error: geoError } = await supabase
        .from('settings')
        .upsert({ id: 'geofence', value: geoConfig } as any)
      
      if (geoError) throw geoError

      // Save School Profile
      const { error: profileError } = await supabase
        .from('settings')
        .upsert({ id: 'school_profile', value: { schoolName } } as any)
      
      if (profileError) throw profileError

      toast.success("Pengaturan berhasil disimpan secara permanen!")
    } catch (error: any) {
      console.error('Error saving settings:', error.message)
      toast.error("Gagal menyimpan pengaturan: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleResetData = async () => {
    const expectedText = "HAPUS DATA PERMANEN"
    if (confirmValue !== expectedText) {
      toast.error("Konfirmasi tidak cocok. Pastikan Anda mengetik dengan benar.")
      return
    }

    setResetting(true)
    try {
      // 1. Delete all attendance logs
      const { error: attError } = await supabase
        .from('attendance_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
      
      if (attError) throw attError

      // 2. Delete all students
      const { error: studentError } = await supabase
        .from('students')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (studentError) throw studentError

      toast.success("Seluruh data berhasil dihapus permanen!")
      setShowConfirmReset(false)
      setConfirmValue("")
    } catch (error: any) {
      console.error('Error resetting data:', error.message)
      toast.error("Gagal menghapus data: " + (error.message || "Pastikan Anda memiliki izin akses penuh"))
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <RefreshCw size={40} className="animate-spin text-primary" />
        <p className="font-bold text-slate-500">Memuat pengaturan...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-sans">Pengaturan Sistem</h1>
        <p className="text-muted-foreground font-medium">Konfigurasi operasional dan keamanan EduPulse Smart Attendance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* General Settings */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <Globe size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg">Profil Sekolah</CardTitle>
                  <CardDescription>Informasi dasar identitas sekolah Anda.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school-name" className="text-xs font-bold uppercase tracking-wider text-slate-500">Nama Instansi Sekolah</Label>
                <Input 
                  id="school-name" 
                  name="school_name"
                  value={schoolName} 
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="rounded-xl h-11 border-slate-200 focus:ring-primary/20"
                  placeholder="Contoh: SMPN 1 Manonjaya"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-xl text-orange-600">
                  <MapPin size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg">Geofencing (Kunci Lokasi)</CardTitle>
                  <CardDescription>Aturan batas wilayah operasional alat absensi.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="geo-latitude" className="text-xs font-bold uppercase tracking-wider text-slate-500">Latitude</Label>
                    <Input 
                      id="geo-latitude"
                      name="latitude"
                      type="number"
                      value={geoConfig.latitude}
                      onChange={(e) => setGeoConfig({...geoConfig, latitude: parseFloat(e.target.value)})}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="geo-longitude" className="text-xs font-bold uppercase tracking-wider text-slate-500">Longitude</Label>
                    <Input 
                      id="geo-longitude"
                      name="longitude"
                      type="number"
                      value={geoConfig.longitude}
                      onChange={(e) => setGeoConfig({...geoConfig, longitude: parseFloat(e.target.value)})}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex justify-between items-center mb-1">
                      <Label htmlFor="geo-radius" className="text-xs font-bold uppercase tracking-wider text-slate-500">Radius Jangkauan (Meter)</Label>
                      <span className="text-xs font-black text-primary">{geoConfig.radius} m</span>
                    </div>
                    <Input 
                      id="geo-radius"
                      name="radius"
                      type="range"
                      min="50"
                      max="1000"
                      step="50"
                      value={geoConfig.radius}
                      onChange={(e) => setGeoConfig({...geoConfig, radius: parseInt(e.target.value)})}
                      className="h-2 accent-primary appearance-none bg-slate-100 rounded-lg"
                    />
                  </div>
               </div>
               
               <div className="mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-4">
                  <div className="p-2 bg-blue-500 rounded-xl self-start">
                    <Lock className="text-white" size={16} />
                  </div>
                  <p className="text-xs font-medium text-blue-800 leading-relaxed">
                    <strong>Catatan Keamanan:</strong> Lokasi saat ini terkunci pada koordinat <span className="font-mono bg-white px-1 rounded">{geoConfig.latitude}, {geoConfig.longitude}</span>. 
                    Setiap upaya absensi di luar radius {geoConfig.radius} meter akan ditolak oleh sistem secara otomatis.
                  </p>
               </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          {isAdmin && (
            <Card className="border-2 border-rose-100 shadow-sm rounded-3xl overflow-hidden bg-rose-50/30">
              <CardHeader className="bg-rose-50 border-b border-rose-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-500/10 rounded-xl text-rose-600">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-rose-700">Zona Bahaya</CardTitle>
                    <CardDescription className="text-rose-600/80">Tindakan kritis yang berdampak pada integritas data.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-rose-100 shadow-sm">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">Generate Mock Data</p>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                      Membuat data siswa dan log kehadiran acak untuk keperluan testing dan demo aplikasi.
                    </p>
                  </div>
                  <Button 
                    onClick={handleSeedData}
                    disabled={seeding}
                    className="rounded-xl font-bold bg-white border border-indigo-200 text-indigo-600 hover:bg-slate-50 h-11 px-6 shrink-0 shadow-sm"
                  >
                    {seeding ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    {seeding ? "Memproses..." : "Buat Mock Data"}
                  </Button>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-rose-100 shadow-sm">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">Reset Semua Data Siswa & Absensi</p>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                      Menghapus seluruh daftar siswa dan semua riwayat log kehadiran yang ada dalam sistem. Tindakan ini tidak dapat dibatalkan.
                    </p>
                  </div>
                  
                  {!showConfirmReset ? (
                    <Button 
                      variant="destructive" 
                      onClick={() => setShowConfirmReset(true)}
                      className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 h-11 px-6 shrink-0 shadow-lg shadow-rose-200"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Hapus Semua
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-3 w-full md:w-auto min-w-[280px]">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                          Ketik "HAPUS DATA PERMANEN"
                        </Label>
                        <div className="flex gap-2">
                          <Input 
                            value={confirmValue}
                            onChange={(e) => setConfirmValue(e.target.value)}
                            placeholder="Ketik konfirmasi..."
                            className="h-10 rounded-xl border-rose-200 focus:ring-rose-500/20 text-sm"
                            autoFocus
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setShowConfirmReset(false)
                              setConfirmValue("")
                            }}
                            className="rounded-xl text-slate-400 hover:text-slate-600 shrink-0"
                          >
                            <X size={18} />
                          </Button>
                        </div>
                      </div>
                      <Button 
                        variant="destructive" 
                        onClick={handleResetData}
                        disabled={resetting || confirmValue !== "HAPUS DATA PERMANEN"}
                        className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 h-10 w-full shadow-lg shadow-rose-200"
                      >
                        {resetting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        {resetting ? "Menghapus..." : "Konfirmasi Hapus"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Settings Panel */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-primary text-white">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center animate-pulse">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="text-xl font-black italic uppercase tracking-tighter">Konfirmasi Data</h3>
                <p className="text-xs font-medium text-white/80 leading-relaxed">
                  {isAdmin 
                    ? "Semua perubahan akan berdampak langsung pada seluruh terminal scanner yang terhubung." 
                    : "Anda tidak memiliki izin (peran Admin) untuk mengubah pengaturan sistem ini."}
                </p>
                <Button 
                  onClick={handleSave} 
                  disabled={saving || !isAdmin}
                  className={`w-full font-bold rounded-2xl h-12 text-sm shadow-xl transition-all ${
                    isAdmin 
                      ? "bg-white text-primary hover:bg-slate-50" 
                      : "bg-white/50 text-white/50 cursor-not-allowed"
                  }`}
                >
                  {!isAdmin && <Lock className="mr-2 h-4 w-4" />}
                  {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : (!isAdmin ? null : <Save className="mr-2 h-4 w-4" />)}
                  {saving ? "Menyimpan..." : (isAdmin ? "Simpan Perubahan" : "Akses Terkunci")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl overflow-hidden border border-slate-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BellRing size={16} className="text-rose-500" /> Notifikasi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-bold text-slate-700">Audio Feedback</span>
                <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-xs font-bold text-slate-700">Scan Confirmation</span>
                <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
