import * as React from "react"
import { useState, useEffect, useRef } from "react"
import * as faceapi from "face-api.js"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Camera, UserCheck, ShieldAlert, Sparkles, RefreshCcw } from "lucide-react"
import { toast } from "sonner"
import { Student } from "@/types"
import { studentService } from "@/lib/studentService"

interface FaceRegistrationModalProps {
  student: Student | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/"

export function FaceRegistrationModal({ student, isOpen, onClose, onSuccess }: FaceRegistrationModalProps) {
  const [loading, setLoading] = useState(true)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [detectionResult, setDetectionResult] = useState<{ detected: boolean; message: string; descriptor?: Float32Array } | null>(null)
  const [saving, setSaving] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    async function loadModels() {
      try {
        setLoading(true)
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ])
        setModelsLoaded(true)
        setLoading(false)
      } catch (error: any) {
        console.error("Failed to load models:", error)
        toast.error("Gagal memuat model AI. Silakan periksa koneksi internet.")
        setLoading(false)
      }
    }

    if (isOpen) {
      loadModels()
    }

    return () => {
      stopVideo()
    }
  }, [isOpen])

  const startVideo = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Fitur kamera tidak tersedia. Pastikan Anda menggunakan HTTPS dan memberikan izin kamera.")
      return
    }

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: "user" } 
      })
      setStream(videoStream)
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream
      }
    } catch (error: any) {
      console.error("Error accessing webcam:", error)
      toast.error("Gagal mengakses kamera: " + error.message)
    }
  }

  const stopVideo = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  useEffect(() => {
    if (modelsLoaded && isOpen && !stream) {
      startVideo()
    }
  }, [modelsLoaded, isOpen])

  const handleDetect = async () => {
    if (!videoRef.current || !modelsLoaded) return

    setDetecting(true)
    try {
      const options = new faceapi.TinyFaceDetectorOptions()
      const result = await faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!result) {
        setDetectionResult({ detected: false, message: "Wajah tidak terdeteksi. Pastikan pencahayaan cukup." })
      } else {
        setDetectionResult({ 
          detected: true, 
          message: "Wajah berhasil dideteksi!", 
          descriptor: result.descriptor 
        })
        
        // Draw to canvas for preview
        if (canvasRef.current) {
          const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true)
          const resized = faceapi.resizeResults(result, dims)
          canvasRef.current.getContext("2d")?.clearRect(0,0, dims.width, dims.height)
          faceapi.draw.drawDetections(canvasRef.current, resized)
        }
      }
    } catch (error: any) {
      console.error("Detection error:", error)
      toast.error("Error saat deteksi: " + error.message)
    } finally {
      setDetecting(false)
    }
  }

  const handleSave = async () => {
    if (!student || !detectionResult?.descriptor) return

    setSaving(true)
    try {
      const descriptorArray = Array.from(detectionResult.descriptor) as any as number[]
      await studentService.saveFaceDescriptor(student.id, descriptorArray)
      toast.success("Data wajah berhasil didaftarkan!")
      onSuccess()
      onClose()
    } catch (error: any) {
      toast.error("Gagal menyimpan data wajah: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
        <div className="bg-primary p-6 text-white relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-2xl font-black italic flex items-center gap-2">
              <Sparkles className="text-amber-300" />
              Registrasi Wajah AI
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/70 font-medium">
              Siswa: <span className="text-white font-bold">{student?.full_name}</span> ({student?.nisn})
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8 bg-slate-50 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Inisialisasi AI Engine...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-inner ring-4 ring-white">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                <canvas 
                  ref={canvasRef} 
                  className="absolute top-0 left-0 w-full h-full pointer-events-none" 
                />
                {!stream && !loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                    <Button onClick={startVideo} variant="secondary" className="font-bold">
                      <Camera className="mr-2" /> Aktifkan Kamera
                    </Button>
                  </div>
                )}
                
                {detectionResult && (
                  <div className={`absolute bottom-4 left-4 right-4 p-3 rounded-xl backdrop-blur-md border ${detectionResult.detected ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100' : 'bg-rose-500/20 border-rose-500/50 text-rose-100'} flex items-center gap-3 transition-all animate-in slide-in-from-bottom-2`}>
                    {detectionResult.detected ? <UserCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                    <span className="text-sm font-bold tracking-wide">{detectionResult.message}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">
                  Instruksi: Posisikan wajah di tengah kamera dengan pencahayaan yang cukup.
                </p>
                
                <div className="flex items-center gap-3 w-full">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-12 rounded-xl font-bold border-none bg-white shadow-sm hover:bg-slate-100"
                    onClick={handleDetect}
                    disabled={detecting || !stream}
                  >
                    {detecting ? <Loader2 className="animate-spin mr-2" /> : <RefreshCcw className="mr-2" />}
                    {detectionResult ? "Ulangi Deteksi" : "Deteksi Wajah"}
                  </Button>
                  
                  <Button 
                    className="flex-1 h-12 rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 disabled:opacity-50"
                    disabled={!detectionResult?.detected || saving}
                    onClick={handleSave}
                  >
                    {saving ? <Loader2 className="animate-spin mr-2" /> : <UserCheck className="mr-2" />}
                    Daftarkan Wajah
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
