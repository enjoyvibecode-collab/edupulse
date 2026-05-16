import React, { useState, useEffect } from "react"
import { 
  Users, 
  UserPlus, 
  Shield, 
  Search, 
  MoreVertical, 
  Trash2, 
  Edit2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  User as UserIcon,
  BadgeCheck
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

import { Profile, UserRole } from "@/types/index"

interface UserProfile extends Profile {}

export default function UserManagement() {
  const { profile: currentUserProfile } = useAuth()
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('is_verified', { ascending: true })
        .order('role', { ascending: true })

      if (error) throw error
      setProfiles((data || []) as UserProfile[])
    } catch (error: any) {
      console.error('Error fetching profiles:', error)
      toast.error("Gagal memuat data pengguna.")
    } finally {
      setLoading(false)
    }
  }

  const updateRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
      
      toast.success(`Role berhasil diperbarui menjadi ${newRole.replace('_', ' ')}`)
      fetchProfiles()
    } catch (error: any) {
      toast.error("Gagal memperbarui role: " + error.message)
    }
  }

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ is_verified: !currentStatus })
        .eq('id', userId)

      if (error) throw error
      
      toast.success(currentStatus ? "Akses akun dinonaktifkan." : "Akun berhasil diverifikasi!")
      fetchProfiles()
    } catch (error: any) {
      toast.error("Gagal memproses verifikasi: " + error.message)
    }
  }

  const filteredProfiles = profiles.filter(p => 
    p.role !== 'platform_owner' && 
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'platform_owner': return <Badge className="bg-rose-500 hover:bg-rose-600 rounded-lg">Platform Owner</Badge>
      case 'admin_sekolah': return <Badge className="bg-indigo-600 hover:bg-indigo-700 rounded-lg">Admin Sekolah</Badge>
      case 'guru': return <Badge variant="outline" className="text-slate-600 border-slate-200 rounded-lg">Guru / Staff</Badge>
      default: return <Badge variant="secondary" className="rounded-lg">{role}</Badge>
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="text-indigo-600" size={32} />
            Manajemen Pengguna
          </h1>
          <p className="text-slate-500 font-medium mt-1">Kelola staf, guru, dan admin sekolah Anda.</p>
        </div>
        <Button className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 h-12 px-6 font-bold shadow-lg shadow-indigo-100">
          <UserPlus size={20} className="mr-2" />
          Tambah Pengguna Baru
        </Button>
      </div>

      <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden bg-white">
        <CardHeader className="bg-white border-b border-slate-50 p-8 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold">Daftar Akun Terdaftar</CardTitle>
            <CardDescription>Total {filteredProfiles.length} staf & guru terdaftar di sistem.</CardDescription>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="Cari nama..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-11 rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500/10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                    <th className="px-8 py-4">Nama & Informasi</th>
                    <th className="px-8 py-4">Role / Jabatan</th>
                    <th className="px-8 py-4">Tanggal Daftar</th>
                    <th className="px-8 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredProfiles.map((user) => (
                    <tr key={user.id} className={`hover:bg-slate-50/30 transition-colors group ${!user.is_verified ? 'bg-orange-50/20' : ''}`}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg border-2 ${
                            user.is_verified ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}>
                            {user.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800">{user.full_name}</p>
                              {!user.is_verified && (
                                <Badge className="bg-orange-100 text-orange-600 hover:bg-orange-100 border-orange-200 text-[9px] font-black uppercase tracking-tighter shadow-none">Menunggu Verifikasi</Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                              ID: {user.id.substring(0, 8)}...
                              {user.id === currentUserProfile?.id && (
                                <Badge variant="secondary" className="text-[9px] h-4 py-0 ml-2 bg-indigo-50 text-indigo-600 border-indigo-100 font-bold uppercase tracking-wider">Anda</Badge>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-medium text-slate-600">
                          {new Date(user.created_at).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded-xl size-9 inline-flex items-center justify-center hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200 group/trigger outline-none cursor-pointer">
                            <MoreVertical size={20} className="text-slate-400 group-hover/trigger:text-indigo-600" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl border-none shadow-2xl">
                            <div className="px-2 py-1.5 mb-1">
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Kontrol Akses</p>
                            </div>
                            <DropdownMenuItem 
                              onClick={() => toggleVerification(user.id, user.is_verified)}
                              disabled={user.id === currentUserProfile?.id}
                              className={`rounded-xl gap-2 py-2.5 font-bold ${
                                user.is_verified ? 'text-orange-600 focus:bg-orange-50 focus:text-orange-600' : 'text-emerald-600 focus:bg-emerald-50 focus:text-emerald-600'
                              } ${user.id === currentUserProfile?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {user.is_verified ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                              {user.is_verified ? "Nonaktifkan Akses" : "Verifikasi User"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-slate-50" />
                            <div className="px-2 py-1.5 mb-1">
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Ubah Role</p>
                            </div>
                            <DropdownMenuItem 
                              onClick={() => updateRole(user.id, 'admin_sekolah')}
                              disabled={user.id === currentUserProfile?.id}
                              className="rounded-xl gap-2 focus:bg-indigo-50 focus:text-indigo-600 py-2.5"
                            >
                              <Shield size={16} />
                              Jadikan Admin Sekolah
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateRole(user.id, 'guru')}
                              disabled={user.id === currentUserProfile?.id}
                              className="rounded-xl gap-2 focus:bg-indigo-50 focus:text-indigo-600 py-2.5"
                            >
                              <BadgeCheck size={16} />
                              Jadikan Guru / Staff
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-slate-50" />
                            <DropdownMenuItem className="rounded-xl gap-2 text-rose-600 focus:bg-rose-50 focus:text-rose-600 py-2.5 font-bold">
                              <Trash2 size={16} />
                              Hapus Akses
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProfiles.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  <UserIcon size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="font-medium">Tidak ada pengguna yang ditemukan.</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
            <Shield size={24} />
          </div>
          <div>
            <h4 className="font-black text-slate-800">Keamanan & Privasi</h4>
            <p className="text-sm text-slate-500 font-medium">Setiap perubahan role akan segera berdampak pada hak akses pengguna di seluruh sistem.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-xl border-slate-200 font-bold h-11 px-6">Bantuan</Button>
          <Button onClick={fetchProfiles} className="rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold h-11 px-6 shadow-sm">
            <RefreshCw size={18} className="mr-2" />
            Muat Ulang
          </Button>
        </div>
      </div>
    </div>
  )
}
