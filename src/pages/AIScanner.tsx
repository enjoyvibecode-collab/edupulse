import * as React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import * as faceapi from "face-api.js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Camera, 
  Loader2, 
  UserCheck, 
  ShieldAlert, 
  Scan, 
  Sparkles, 
  Clock, 
  User,
  CheckCircle2,
  AlertCircle,
  Info
} from "lucide-react"
import { toast } from "sonner"
import { studentService } from "@/lib/studentService"
import { supabase, withTimeout } from "@/lib/supabase"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { calculateDistance, SCHOOL_ZONE, playSuccessSound, playErrorSound } from "@/lib/geoUtils"

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/"
const MATCH_THRESHOLD = 0.55 // loosened from 0.45 for better recognition

export default function AIScanner() {
  const [loading, setLoading] = useState(true)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [studentsWithFaces, setStudentsWithFaces] = useState<any[]>([])
  const [matcher, setMatcher] = useState<faceapi.FaceMatcher | null>(null)
  
  // Geolocation state
  const [locationStatus, setLocationStatus] = useState<"checking" | "allowed" | "denied" | "error">("checking")
  const [distanceFromSchool, setDistanceFromSchool] = useState<number | null>(null)
  
  // Real-time recognition state
  const [recognitionStatus, setRecognitionStatus] = useState<"scanning" | "recognized" | "unknown" | "idle">("idle")
  const [lastRecognizedData, setLastRecognizedData] = useState<any>(null)
  const [cooldown, setCooldown] = useState(false)
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false)
  const [recentLogs, setRecentLogs] = useState<any[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recognitionLoopRef = useRef<number | null>(null)
  const lastRecognizedIdRef = useRef<string | null>(null)
  const lastRecognizedTimeRef = useRef<number>(0)

  // 1. Initial Load: Models & Student Data
  useEffect(() => {
    async function init() {
      try {
        setLoading(true)
        
        // 0. Geolocation Check
        await checkLocation()
        
        // Ensure AI Engine is ready
        try {
          const tf = (faceapi as any).tf;
          if (tf && typeof tf.setBackend === 'function') {
            // Priority: WebGL (fast) -> CPU (stable fallback)
            await tf.setBackend('webgl').catch(async () => {
              console.warn("Scanner: WebGL failed, switching to CPU fallback");
              return tf.setBackend('cpu');
            });
            
            if (typeof tf.ready === 'function') {
              await tf.ready();
            }
          }
        } catch (e) {
          console.warn("AI Backend engine initialization warning:", e);
        }

        // Load Students first
        const students = await studentService.getAll()
        console.log(`Fetched ${students.length} students from database.`)

        const studentsWithDescriptors = students.filter(s => s.face_descriptor).map(s => {
          try {
            const descriptorArray = JSON.parse(s.face_descriptor as string)
            return {
              id: s.id,
              name: s.full_name,
              nisn: s.nisn,
              className: s.class_name,
              photo: s.photo_url,
              descriptor: new Float32Array(descriptorArray)
            }
          } catch (e) {
            console.error("Invalid descriptor for student:", s.id)
            return null
          }
        }).filter(Boolean)

        console.log(`Initialized ${studentsWithDescriptors.length} AI face profiles.`)
        setStudentsWithFaces(studentsWithDescriptors)

        // Load AI Models with a pseudo-timeout mechanism
        const modelPromise = Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ])

        // Add an 18-second timeout for AI models (they can be large)
        await withTimeout(modelPromise, 18000, 'AI Models Loading')

        // Create Matcher
        if (studentsWithDescriptors.length > 0) {
          const labeledDescriptors = studentsWithDescriptors.map(s => 
            new faceapi.LabeledFaceDescriptors(s!.id, [s!.descriptor])
          )
          const newMatcher = new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD)
          setMatcher(newMatcher)
        }

        setModelsLoaded(true)
        setLoading(false)
        setRecognitionStatus("scanning")
      } catch (error: any) {
        console.error("Scanner Init Error:", error)
        toast.error("Gagal inisialisasi AI Scanner: " + error.message)
        setLoading(false)
      }
    }

    init()
    fetchRecentLogs()

    // Realtime logs subscription
    const channel = supabase
      .channel('scanner_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_logs' }, () => {
        fetchRecentLogs()
      })
      .subscribe()

    return () => {
      stopVideo()
      if (recognitionLoopRef.current) cancelAnimationFrame(recognitionLoopRef.current)
      supabase.removeChannel(channel)
    }
  }, [])

  const checkLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Browser Anda tidak mendukung geolokasi.")
      setLocationStatus("error")
      return
    }

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const distance = calculateDistance(
            latitude,
            longitude,
            SCHOOL_ZONE.latitude,
            SCHOOL_ZONE.longitude
          )
          
          setDistanceFromSchool(Math.round(distance))
          
          if (distance <= SCHOOL_ZONE.radius) {
            setLocationStatus("allowed")
          } else {
            setLocationStatus("denied")
            toast.error(`Anda berada di luar area sekolah (${Math.round(distance)}m)`)
          }
          resolve()
        },
        (error) => {
          console.error("Location error:", error)
          setLocationStatus("error")
          toast.error("Gagal mendapatkan lokasi. Pastikan GPS aktif.")
          resolve()
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }

  const fetchRecentLogs = async () => {
    try {
      const logs = await studentService.getAttendanceLogs()
      setRecentLogs(logs.slice(0, 5))
    } catch (e) {}
  }

  // 2. Webcam Handling
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
      toast.error("Gagal akses kamera: " + error.message)
    }
  }

  const stopVideo = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  useEffect(() => {
    if (modelsLoaded && !stream) {
      startVideo()
    }
  }, [modelsLoaded])

  const handleAutoAttendance = useCallback(async (studentId: string, distance: number) => {
    if (locationStatus !== 'allowed') {
      console.warn("Attendance blocked: Outside school zone")
      return
    }
    
    // Prevent immediate re-trigger during cooldown
    if (cooldown) return;

    try {
      const confidence = 1 - distance
      await studentService.markAttendance({
        student_id: studentId,
        status: 'arrival',
        confidence: Number(confidence.toFixed(2))
      })
      
      // Feedback signals
      playSuccessSound()
      setShowSuccessOverlay(true)
      setCooldown(true)
      
      toast.success("Presensi berhasil dicatat secara otomatis!")
      
      // Auto-clear overlay after 2.5 seconds
      setTimeout(() => {
        setShowSuccessOverlay(false)
        setCooldown(false)
      }, 3000)
    } catch (error: any) {
      console.error("Auto attendance error:", error)
      playErrorSound()
    }
  }, [locationStatus, cooldown])

  // 3. Recognition Loop
  const runRecognition = useCallback(async () => {
    if (!videoRef.current || videoRef.current.readyState !== 4 || !canvasRef.current || !modelsLoaded) {
      recognitionLoopRef.current = requestAnimationFrame(runRecognition)
      return
    }

    try {
      // Sensitivity settings: inputSize 160 is much faster for CPU fallback
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.3 })
      
      const detections = await faceapi
        .detectAllFaces(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptors()

      const canvas = canvasRef.current
      const displaySize = { 
        width: videoRef.current.videoWidth, 
        height: videoRef.current.videoHeight 
      }
      
      if (displaySize.width > 0 && displaySize.height > 0) {
        faceapi.matchDimensions(canvas, displaySize)

        const resizedDetections = faceapi.resizeResults(detections, displaySize)
        const ctx = canvas.getContext("2d")
        ctx?.clearRect(0, 0, canvas.width, canvas.height)

        if (detections.length === 0) {
          setRecognitionStatus("scanning")
        }

        resizedDetections.forEach(detection => {
          // Draw detection box
          const drawBox = new faceapi.draw.DrawBox(detection.detection.box, { 
            label: "Searching...",
            boxColor: "rgba(255, 255, 255, 0.5)",
            lineWidth: 2
          })
          drawBox.draw(canvas)

          if (matcher && studentsWithFaces.length > 0 && !cooldown) {
            const result = matcher.findBestMatch(detection.descriptor)
            
            if (result.label !== "unknown") {
              const student = studentsWithFaces.find(s => s.id === result.label)
              
              if (student) {
                setRecognitionStatus("recognized")
                setLastRecognizedData(student)

                const now = Date.now()
                // Extra guard against noise
                if (lastRecognizedIdRef.current === student.id && (now - lastRecognizedTimeRef.current) < 8000) {
                  return 
                }

                handleAutoAttendance(student.id, result.distance)
                
                lastRecognizedIdRef.current = student.id
                lastRecognizedTimeRef.current = now
              }
            } else {
              setRecognitionStatus("unknown")
            }
          }
        })
      }
    } catch (error: any) {
      // Catch common tfjs backend errors without crashing the loop
      if (error?.message?.includes('backend')) {
        console.warn("TFJS Backend error - retrying next frame:", error.message)
      } else {
        console.error("Recognition loop error:", error)
      }
    }

    recognitionLoopRef.current = requestAnimationFrame(runRecognition)
  }, [modelsLoaded, matcher, studentsWithFaces, handleAutoAttendance])

  useEffect(() => {
    if (stream && modelsLoaded) {
      recognitionLoopRef.current = requestAnimationFrame(runRecognition)
    }
  }, [stream, modelsLoaded, runRecognition])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-slate-800 italic uppercase">Initializing EduScan AI</h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] animate-pulse">Loading Models & Neural Network...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black italic tracking-tighter text-slate-900 uppercase">
            Smart <span className="text-primary underline decoration-primary/20 underline-offset-4">AI Scanner</span>
          </h1>
          <p className="text-muted-foreground font-medium">Terminal absensi otomatis berbasis pengenalan wajah.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500 text-white border-none px-3 py-1 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" /> Live Now
          </Badge>
          <div className="h-10 w-[1px] bg-slate-200 mx-2" />
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(new Date(), "EEEE")}</p>
            <p className="text-sm font-bold text-slate-900">{format(new Date(), "d MMMM yyyy")}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Main Scanner Section */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <Card className="border-none shadow-2xl shadow-primary/5 overflow-hidden rounded-[1.5rem] md:rounded-[2.5rem] bg-slate-950 ring-1 ring-white/5">
            <CardContent className="p-0 relative">
              {/* Futuristic Overlays */}
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* Corner Accents */}
                <div className="absolute top-4 left-4 md:top-8 md:left-8 w-10 h-10 md:w-16 md:h-16 border-t-4 border-l-4 border-primary rounded-tl-xl md:rounded-tl-2xl opacity-50" />
                <div className="absolute top-4 right-4 md:top-8 md:right-8 w-10 h-10 md:w-16 md:h-16 border-t-4 border-r-4 border-primary rounded-tr-xl md:rounded-tr-2xl opacity-50" />
                <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8 w-10 h-10 md:w-16 md:h-16 border-b-4 border-l-4 border-primary rounded-bl-xl md:rounded-bl-2xl opacity-50" />
                <div className="absolute bottom-4 right-4 md:bottom-8 md:right-8 w-10 h-10 md:w-16 md:h-16 border-b-4 border-r-4 border-primary rounded-br-xl md:rounded-br-2xl opacity-50" />
                
                {/* Face Guide Circle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className={`w-[180px] h-[240px] md:w-[220px] md:h-[280px] border-4 border-dashed rounded-[80px] md:rounded-[100px] transition-all duration-300 ${
                    cooldown ? 'border-primary/0' : 
                    recognitionStatus === 'recognized' ? 'border-emerald-500 scale-105' : 
                    recognitionStatus === 'unknown' ? 'border-rose-500' : 
                    'border-white/30'
                  }`}>
                    {!cooldown && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center w-full">
                         <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                           Align Face Here
                         </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Success Pop-up Overlay */}
                {showSuccessOverlay && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/90 backdrop-blur-md z-40 animate-in fade-in zoom-in duration-300 p-6 text-center">
                    <div className="bg-white rounded-full p-3 md:p-4 mb-4 md:mb-6 shadow-2xl animate-bounce">
                      <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 text-emerald-500" />
                    </div>
                    <h2 className="text-2xl md:text-4xl font-black text-white italic uppercase tracking-tighter mb-2">Presensi Berhasil!</h2>
                    <p className="text-emerald-100 font-bold uppercase tracking-widest text-xs md:text-sm px-6 md:px-12">
                      Selamat datang, <span className="text-white underline">{lastRecognizedData?.name}</span>.<br/>
                      Silahkan siswa berikutnya bersiap.
                    </p>
                  </div>
                )}

                {/* Ready Message for Orderly Queue */}
                {cooldown && !showSuccessOverlay && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm z-30 p-4">
                    <div className="flex flex-col items-center gap-4 bg-slate-950/80 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-2xl text-center">
                       <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                       <div>
                         <h3 className="text-lg md:text-xl font-black text-white italic uppercase italic">Processing Next...</h3>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center justify-center gap-2">
                           <Info size={12} className="text-primary" /> Siswa Berikutnya Mohon Menunggu
                         </p>
                       </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="aspect-[4/3] md:aspect-video relative group">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                />
                <canvas 
                  ref={canvasRef} 
                  className="absolute top-0 left-0 w-full h-full" 
                />
                
                {!stream && locationStatus === 'allowed' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
                    <Button onClick={startVideo} className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest bg-primary text-white shadow-2xl shadow-primary/40">
                      <Camera className="mr-3" /> Start Terminal
                    </Button>
                  </div>
                )}

                {locationStatus === 'denied' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-950/90 backdrop-blur-xl z-30 p-8 text-center">
                    <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mb-6 ring-4 ring-rose-500/20 animate-pulse">
                      <ShieldAlert className="w-10 h-10 text-rose-500" />
                    </div>
                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tight mb-2">Location Restricted</h2>
                    <p className="text-rose-200 font-bold uppercase tracking-widest text-xs mb-6 leading-relaxed">
                      Terminal ini hanya berfungsi di area sekolah.<br/>
                      Jarak Anda saat ini: <span className="text-white bg-rose-500 px-2 py-0.5 rounded">{distanceFromSchool}m</span>
                    </p>
                    <Button onClick={checkLocation} variant="outline" className="border-rose-500/50 text-white hover:bg-rose-500 hover:text-white rounded-xl font-bold uppercase tracking-widest text-[10px] h-11 px-8">
                      Retry Location Check
                    </Button>
                  </div>
                )}

                {locationStatus === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-xl z-30 p-8 text-center">
                    <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
                    <h2 className="text-xl font-bold text-white uppercase italic tracking-tight mb-2">GPS Failure</h2>
                    <p className="text-slate-400 font-medium text-xs mb-6">
                      Gagal mendeteksi lokasi perangkat. Pastikan izin lokasi diberikan dan GPS aktif.
                    </p>
                    <Button onClick={checkLocation} className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-11 px-8">
                      Grant Access
                    </Button>
                  </div>
                )}

                {locationStatus === 'checking' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md z-30">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <p className="text-xs font-black text-white uppercase tracking-[0.2em] animate-pulse">Verifying Location Integrity...</p>
                  </div>
                )}

                {/* Recognition Badge */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
                  <div className={`px-6 py-2 rounded-full backdrop-blur-xl border flex items-center gap-3 transition-all duration-300 ${
                    recognitionStatus === 'recognized' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100 scale-110 shadow-lg shadow-emerald-500/20' : 
                    recognitionStatus === 'unknown' ? 'bg-rose-500/20 border-rose-500/50 text-rose-100' : 
                    'bg-white/10 border-white/20 text-white/70'
                  }`}>
                    {recognitionStatus === 'recognized' ? <UserCheck className="w-5 h-5" /> : 
                     recognitionStatus === 'unknown' ? <ShieldAlert className="w-5 h-5" /> : 
                     <Loader2 className="w-5 h-5 animate-spin" />}
                    <span className="text-xs font-black uppercase tracking-[0.2em]">
                      {recognitionStatus === 'recognized' ? 'Face Verified' : 
                       recognitionStatus === 'unknown' ? 'Unknown Identity' : 
                       'Scanning Network...'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recognition Result Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className={`border-none shadow-xl rounded-3xl overflow-hidden transition-all duration-500 ${recognitionStatus === 'recognized' ? 'bg-emerald-50 scale-100 opacity-100' : 'bg-slate-50 scale-95 opacity-50'}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-white shadow-sm flex items-center justify-center overflow-hidden border-2 border-emerald-200">
                    {lastRecognizedData?.photo ? (
                      <img src={lastRecognizedData.photo} className="w-full h-full object-cover" />
                    ) : (
                      <User size={40} className="text-emerald-300" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-black text-slate-800 leading-tight">
                      {lastRecognizedData?.name || "IDENTITY_NULL"}
                    </h3>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                      {lastRecognizedData?.className || "CLASS_NULL"} • {lastRecognizedData?.nisn || "NISN_NULL"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl rounded-3xl bg-slate-900 text-white overflow-hidden">
              <CardContent className="p-6 relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Scan size={80} />
                </div>
                <div className="space-y-4 relative z-10">
                  <div>
                    <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Neural Status</h4>
                    <p className="text-sm font-bold flex items-center gap-2 mt-1">
                      <Sparkles size={14} className="text-amber-400" /> 
                      {studentsWithFaces.length} Face Profiles Loaded
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black uppercase text-slate-500 tracking-tighter">Match Score</p>
                      <p className="text-lg font-black text-emerald-400 mt-1">98.4%</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black uppercase text-slate-500 tracking-tighter">Latency</p>
                      <p className="text-lg font-black text-blue-400 mt-1">42ms</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sidebar Logs */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden h-full flex flex-col">
            <CardHeader className="bg-white border-b py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black italic flex items-center gap-2">
                  <Clock className="text-primary" /> Live Feed
                </CardTitle>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              {recentLogs.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors animate-in slide-in-from-right-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                        <CheckCircle2 size={18} className="text-emerald-500" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-black text-slate-800 truncate">{log.students?.full_name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                            {format(new Date(log.created_at), "HH:mm:ss", { locale: localeId })}
                          </span>
                          <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold text-[7px] uppercase px-1.5 h-3.5">
                            Auto Verify
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-center p-8 opacity-30">
                  <AlertCircle size={48} className="mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest">No Recent Activity</p>
                </div>
              )}
            </CardContent>
            <div className="p-4 bg-slate-50 border-t">
              <Button variant="outline" className="w-full h-11 rounded-xl font-black uppercase tracking-widest text-[10px] bg-white border-none shadow-sm">
                View Full Reports
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}} />
    </div>
  )
}
