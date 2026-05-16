export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'platform_owner' | 'admin_sekolah' | 'guru' | 'orang_tua'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      students: {
        Row: Student
        Insert: Omit<Student, 'id' | 'created_at'>
        Update: Partial<Omit<Student, 'id' | 'created_at'>>
      }
      attendance_logs: {
        Row: AttendanceLog
        Insert: Omit<AttendanceLog, 'id' | 'created_at'>
        Update: Partial<Omit<AttendanceLog, 'id' | 'created_at'>>
      }
    }
  }
}

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  is_verified: boolean
  created_at: string
}

export interface Student {
  id: string
  nisn: string
  full_name: string
  class_name: string
  parent_name: string
  parent_phone: string
  photo_url?: string
  face_descriptor?: string | null // Descriptor stored as JSON string
  created_at: string
}

export interface AttendanceLog {
  id: string
  student_id: string
  status: 'hadir_pagi' | 'dzuhur' | 'pulang'
  confidence: number
  captured_image?: string
  created_at: string
  is_deleted?: boolean
  deleted_at?: string
  deleted_by?: string
  edited_at?: string
  correction_note?: string
  students?: {
    full_name: string
  }
}

export interface AttendanceAuditLog {
  id: string
  attendance_id: string
  action_type: 'CREATE' | 'UPDATE' | 'DELETE'
  old_data: any
  new_data: any
  action_by: string
  created_at: string
  profiles?: {
    full_name: string
  }
}
