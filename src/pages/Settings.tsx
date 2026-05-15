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
  Lock
} from "lucide-react"
import { toast } from "sonner"
import { SCHOOL_ZONE } from "@/lib/geoUtils"
import { supabase } from "@/lib/supabase"

export default function Settings() {
  const [geoConfig, setGeoConfig] = useState({
    latitude: SCHOOL_ZONE.latitude,
    longitude: SCHOOL_ZONE.longitude,
    radius: SCHOOL_ZONE.radius
  })
  
  const [schoolName, setSchoolName] = useState("SMPN 1 Manonjaya")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('settings')
        .select('*')
      
      if (error) throw error

      const geofence = data?.find(s => s.id === 'geofence')?.value
      const profile = data?.find(s => s.id === 'school_profile')?.value

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
        .upsert({ id: 'geofence', value: geoConfig })
      
      if (geoError) throw geoError

      // Save School Profile
      const { error: profileError } = await supabase
        .from('settings')
        .upsert({ id: 'school_profile', value: { schoolName } })
      
      if (profileError) throw profileError

      toast.success("Pengaturan berhasil disimpan secara permanen!")
    } catch (error: any) {
      console.error('Error saving settings:', error.message)
      toast.error("Gagal menyimpan pengaturan: " + error.message)
    } finally {
      setSaving(false)
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
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Latitude</Label>
                    <Input 
                      type="number"
                      value={geoConfig.latitude}
                      onChange={(e) => setGeoConfig({...geoConfig, latitude: parseFloat(e.target.value)})}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Longitude</Label>
                    <Input 
                      type="number"
                      value={geoConfig.longitude}
                      onChange={(e) => setGeoConfig({...geoConfig, longitude: parseFloat(e.target.value)})}
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex justify-between items-center mb-1">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Radius Jangkauan (Meter)</Label>
                      <span className="text-xs font-black text-primary">{geoConfig.radius} m</span>
                    </div>
                    <Input 
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
                  Semua perubahan akan berdampak langsung pada seluruh terminal scanner yang terhubung.
                </p>
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="w-full bg-white text-primary hover:bg-slate-50 font-bold rounded-2xl h-12 text-sm shadow-xl"
                >
                  {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
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
