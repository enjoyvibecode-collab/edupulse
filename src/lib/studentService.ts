import { supabase } from "./supabase";
import { Student, AttendanceLog } from "@/types";
import { startOfDay, endOfDay } from "date-fns";

export const studentService = {
  async getAll() {
    const { data, error } = await (supabase as any)
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Student[];
  },

  async getById(id: string) {
    const { data, error } = await (supabase as any)
      .from('students')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Student;
  },

  async create(student: Omit<Student, 'id' | 'created_at'>) {
    const { data, error } = await (supabase as any)
      .from('students')
      .insert([student])
      .select()
      .single();
    
    if (error) throw error;
    return data as Student;
  },

  async update(id: string, updates: Partial<Omit<Student, 'id' | 'created_at'>>) {
    const { data, error } = await (supabase as any)
      .from('students')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Student;
  },

  async delete(id: string) {
    const { error } = await (supabase as any)
      .from('students')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async saveFaceDescriptor(id: string, descriptor: number[]) {
    const { data, error } = await (supabase as any)
      .from('students')
      .update({ face_descriptor: JSON.stringify(Array.from(descriptor)) })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Student;
  },

  async getAttendanceLogs() {
    const { data, error } = await (supabase as any)
      .from('attendance_logs')
      .select(`
        *,
        students (
          full_name,
          nisn
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async markAttendance(log: Omit<AttendanceLog, 'id' | 'created_at'>) {
    const { data, error } = await (supabase as any)
      .from('attendance_logs')
      .insert([log])
      .select()
      .single();
    
    if (error) throw error;
    return data as AttendanceLog;
  },

  async getDashboardStats() {
    const today = new Date();
    const start = startOfDay(today).toISOString();
    const end = endOfDay(today).toISOString();

    const [allStudents, todayLogs] = await Promise.all([
      (supabase as any).from('students').select('*', { count: 'exact', head: true }),
      (supabase as any).from('attendance_logs').select('*').gte('created_at', start).lte('created_at', end)
    ]);

    const totalSiswa = allStudents.count || 0;
    const logs = todayLogs.data || [];
    
    // Count unique students present today
    const uniquePresent = new Set(logs.filter((l: any) => l.status === 'arrival').map((l: any) => l.student_id)).size;
    const uniquePulang = new Set(logs.filter((l: any) => l.status === 'departure').map((l: any) => l.student_id)).size;
    
    return {
      totalSiswa,
      hadirHariIni: uniquePresent,
      absen: totalSiswa - uniquePresent,
      pulang: uniquePulang
    };
  },

  async uploadPhoto(file: File) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `photos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('student-photos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('student-photos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};
