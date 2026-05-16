import React from "react"
import { ShieldAlert, LogOut, Clock, Mail } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"

export default function PendingVerification() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate("/login")
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl shadow-slate-200/50 p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-[24px] mx-auto flex items-center justify-center border-4 border-orange-50">
          <ShieldAlert size={40} />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Akun Menunggu Verifikasi</h1>
          <p className="text-slate-500 font-medium leading-relaxed">
            Halo <span className="text-indigo-600 font-bold">{profile?.full_name}</span>, akun Anda sedang dalam proses peninjauan oleh Admin.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 space-y-4 text-left border border-slate-100">
          <div className="flex gap-3">
            <Clock className="text-orange-500 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold text-slate-800">Proses Verifikasi</p>
              <p className="text-xs text-slate-500">Biasanya membutuhkan waktu 1-24 jam hari kerja.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Mail className="text-indigo-500 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold text-slate-800">Kontak Support</p>
              <p className="text-xs text-slate-500">Hubungi Admin Madrasah jika verifikasi terlalu lama.</p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button 
            onClick={() => window.location.reload()}
            className="w-full rounded-2xl h-12 bg-indigo-600 hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-100"
          >
            Cek Status Sekarang
          </Button>
          <Button 
            onClick={handleSignOut}
            variant="ghost" 
            className="w-full mt-2 rounded-2xl h-12 text-slate-500 font-bold hover:bg-slate-50"
          >
            <LogOut size={18} className="mr-2" />
            Keluar Sesi
          </Button>
        </div>
        
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
          EduPulse Smart Attendance System
        </p>
      </div>
    </div>
  )
}
