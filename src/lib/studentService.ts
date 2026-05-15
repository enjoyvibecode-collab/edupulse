import { supabase, withTimeout } from "./supabase";
import { Student, AttendanceLog } from "@/types";
import { startOfDay, endOfDay, subDays, format, eachDayOfInterval } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { isWindowActive } from "./attendanceConfig";

export const studentService = {
  async getAll() {
    const res = await withTimeout(
      (supabase as any)
        .from('students')
        .select('*')
        .order('created_at', { ascending: false }),
      30000,
      'Get All Students'
    ) as any;
    
    const { data, error } = res;
    
    if (error) throw error;
    return data as Student[];
  },

  async getById(id: string) {
    const res = await withTimeout(
      (supabase as any)
        .from('students')
        .select('*')
        .eq('id', id)
        .single(),
      20000,
      'Get Student By ID'
    ) as any;
    
    const { data, error } = res;
    
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

  async bulkCreate(students: Omit<Student, 'id' | 'created_at'>[]) {
    const { data, error } = await (supabase as any)
      .from('students')
      .insert(students)
      .select();
    
    if (error) throw error;
    return data as Student[];
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
    const res = await withTimeout(
      (supabase as any)
        .from('attendance_logs')
        .select(`
          *,
          students (
            full_name,
            nisn
          )
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }),
      30000,
      'Get Attendance Logs'
    ) as any;
    
    const { data, error } = res;
    
    if (error) throw error;
    return data;
  },

  async getTodayLogs(studentId: string) {
    const today = new Date();
    const start = startOfDay(today).toISOString();
    const end = endOfDay(today).toISOString();

    const { data, error } = await (supabase as any)
      .from('attendance_logs')
      .select('*')
      .eq('student_id', studentId)
      .eq('is_deleted', false)
      .gte('created_at', start)
      .lte('created_at', end);
    
    if (error) throw error;
    return data as AttendanceLog[];
  },

  async markAttendance(log: Omit<AttendanceLog, 'id' | 'created_at'>) {
    const now = new Date();
    
    // 1. Time Window Validation
    if (!isWindowActive(log.status, now)) {
      throw new Error(`Waktu presensi ${log.status.replace('_', ' ')} belum aktif atau sudah berakhir.`);
    }

    // 2. Get today's logs for this student
    const todayLogs = await this.getTodayLogs(log.student_id);
    
    const hasPagi = todayLogs.some(l => l.status === 'hadir_pagi');
    const hasDzuhur = todayLogs.some(l => l.status === 'dzuhur');
    const hasPulang = todayLogs.some(l => l.status === 'pulang');

    // 3. Validate duplicates
    if (log.status === 'hadir_pagi' && hasPagi) {
      throw new Error("Siswa sudah melakukan presensi Hadir Pagi hari ini.");
    }
    
    if (log.status === 'dzuhur' && hasDzuhur) {
      throw new Error("Siswa sudah melakukan presensi Dzuhur hari ini.");
    }
    
    if (log.status === 'pulang' && hasPulang) {
      throw new Error("Siswa sudah melakukan presensi Pulang hari ini.");
    }

    const { data, error } = await (supabase as any)
      .from('attendance_logs')
      .insert([log])
      .select()
      .single();
    
    if (error) throw error;
    return data as AttendanceLog;
  },

  async softDeleteAttendance(id: string, adminId: string, reason: string = "Salah klik / Koreksi Admin") {
    // 1. Get current data for audit
    const { data: oldLog } = await (supabase as any)
      .from('attendance_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (!oldLog) throw new Error("Log tidak ditemukan");

    // 2. Soft delete the log
    const { error: deleteError } = await (supabase as any)
      .from('attendance_logs')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: adminId,
        correction_note: reason
      })
      .eq('id', id);

    if (deleteError) throw deleteError;

    // 3. Create detailed audit log
    await (supabase as any)
      .from('attendance_audit_logs')
      .insert([{
        attendance_id: id,
        action_type: 'DELETE',
        old_data: oldLog,
        new_data: { is_deleted: true, reason },
        action_by: adminId
      }]);
  },

  async updateAttendance(id: string, updates: Partial<AttendanceLog>, adminId: string, reason: string) {
    // 1. Get current data for audit
    const { data: oldLog } = await (supabase as any)
      .from('attendance_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (!oldLog) throw new Error("Log tidak ditemukan");

    // 2. Update the log
    const { data: newLog, error: updateError } = await (supabase as any)
      .from('attendance_logs')
      .update({
        ...updates,
        edited_at: new Date().toISOString(),
        correction_note: reason
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. Create detailed audit log
    await (supabase as any)
      .from('attendance_audit_logs')
      .insert([{
        attendance_id: id,
        action_type: 'UPDATE',
        old_data: oldLog,
        new_data: newLog,
        action_by: adminId
      }]);

    return newLog;
  },

  async getDashboardStats() {
    const today = new Date();
    const start = startOfDay(today).toISOString();
    const end = endOfDay(today).toISOString();

    const results = await withTimeout(
      Promise.all([
        (supabase as any).from('students').select('*'),
        (supabase as any).from('attendance_logs').select('*').eq('is_deleted', false).gte('created_at', start).lte('created_at', end)
      ]),
      30000,
      'Get Dashboard Stats'
    ) as any[];

    const [allStudentsData, todayLogs] = results;
    const students = (allStudentsData as any).data || [];
    const totalSiswa = students.length;
    const logs = (todayLogs as any).data || [];
    
    // Count stats for each type
    const hadirPagi = new Set(logs.filter((l: any) => l.status === 'hadir_pagi').map((l: any) => l.student_id)).size;
    const dzuhur = new Set(logs.filter((l: any) => l.status === 'dzuhur').map((l: any) => l.student_id)).size;
    const pulang = new Set(logs.filter((l: any) => l.status === 'pulang').map((l: any) => l.student_id)).size;

    // Calculate Class Detailed Stats
    const classStats: Record<string, { total: number, pagi: number, dzuhur: number, pulang: number }> = {};
    
    students.forEach((s: any) => {
      const cls = s.class_name || "Tanpa Kelas";
      if (!classStats[cls]) classStats[cls] = { total: 0, pagi: 0, dzuhur: 0, pulang: 0 };
      classStats[cls].total++;
      
      const studentLogs = logs.filter((l: any) => l.student_id === s.id);
      if (studentLogs.some((l: any) => l.status === 'hadir_pagi')) classStats[cls].pagi++;
      if (studentLogs.some((l: any) => l.status === 'dzuhur')) classStats[cls].dzuhur++;
      if (studentLogs.some((l: any) => l.status === 'pulang')) classStats[cls].pulang++;
    });

    const classRekap = Object.entries(classStats)
      .map(([name, data]) => ({
        name: name,
        total: data.total,
        pagi: data.pagi,
        dzuhur: data.dzuhur,
        pulang: data.pulang
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return {
      totalSiswa,
      hadirPagi,
      dzuhur,
      pulang,
      absen: totalSiswa - hadirPagi,
      classRekap
    };
  },

  async getWeeklyStats() {
    const today = new Date();
    const sevenDaysAgo = subDays(today, 6);
    const start = startOfDay(sevenDaysAgo).toISOString();

    const { data: logs, error } = await (supabase as any)
      .from('attendance_logs')
      .select('created_at, student_id, status')
      .eq('is_deleted', false)
      .gte('created_at', start);

    if (error) throw error;

    const days = eachDayOfInterval({ start: sevenDaysAgo, end: today });
    
    const weeklyData = days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayLogs = (logs as any[]).filter(l => 
        format(new Date(l.created_at), 'yyyy-MM-dd') === dateStr && l.status === 'hadir_pagi'
      );
      
      // Unique students per day
      const uniqueStudents = new Set(dayLogs.map(l => l.student_id)).size;
      
      return {
        name: format(day, 'EEE', { locale: localeId }),
        hadir: uniqueStudents
      };
    });

    return weeklyData;
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
  },

  async getServerTime() {
    const { data, error } = await supabase.rpc('get_server_time');
    if (error) {
       // Fallback to local time if RPC fails or not defined
       return new Date();
    }
    return new Date(data);
  }
};
