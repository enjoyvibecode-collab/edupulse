import * as React from "react"
import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, LogIn, Loader2, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || "/"

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError
      
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err.message || "Gagal masuk. Silakan periksa email dan kata sandi Anda.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 relative">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
      
      <div className="relative w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/30 rotate-3 transition-transform hover:rotate-0">
            <GraduationCap size={40} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-6 font-sans italic">EduPulse</h1>
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest font-mono">Smart Attendance System</p>
        </div>

        <Card className="border-none shadow-2xl shadow-slate-200/60 overflow-hidden">
          <CardHeader className="space-y-1 bg-white">
            <CardTitle className="text-xl">Selamat Datang Kembali</CardTitle>
            <CardDescription>Masukkan kredensial Anda untuk masuk ke sistem.</CardDescription>
          </CardHeader>
          
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-4">
              {error && (
                <Alert variant="destructive" className="bg-destructive/5 text-destructive border-destructive/20">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  autoComplete="email"
                  placeholder="admin@sekolah.id" 
                  className="h-11 bg-slate-50 border-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/20" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Kata Sandi</Label>
                  <button type="button" className="text-xs text-primary font-bold hover:underline">Lupa sandi?</button>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  autoComplete="current-password"
                  className="h-11 bg-slate-50 border-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/20" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit"
                className="w-full h-11 bg-primary text-white font-bold text-base shadow-lg shadow-primary/20 hover:shadow-none transition-all active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-5 w-5" />
                )}
                {loading ? "Memproses..." : "Masuk Sekarang"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Butuh bantuan? Hubungi <span className="text-primary font-bold cursor-pointer hover:underline">Tim IT Sekolah</span>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
