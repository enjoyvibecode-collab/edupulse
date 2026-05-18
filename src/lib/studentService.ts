import { supabase, withTimeout } from "./supabase";
import { Student, AttendanceLog } from "@/types";
import { startOfDay, endOfDay, subDays, format, eachDayOfInterval } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { isWindowActive } from "./attendanceConfig";

// Simple cache to prevent redundant fetches during navigation
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 30000; // 30 seconds

function getFromCache(key: string) {
  const item = cache[key];
  if (item && (Date.now() - item.timestamp < CACHE_TTL)) {
    return item.data;
  }
  return null;
}

function setCache(key: string, data: any) {
  cache[key] = { data, timestamp: Date.now() };
}

export function clearCache() {
  Object.keys(cache).forEach(key => delete cache[key]);
}

export const studentService = {
  async getAll() {
    const cached = getFromCache('students_all');
    if (cached) return cached;

    const res = await withTimeout(
      (supabase as any)
        .from('students')
        .select('*')
        .order('created_at', { ascending: false }),
      20000,
      'Get All Students'
    ) as any;
    
    const { data, error } = res;
    
    if (error) throw error;
    setCache('students_all', data);
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
    clearCache();
    return data as Student;
  },

  async bulkCreate(students: Omit<Student, 'id' | 'created_at'>[]) {
    const { data, error } = await (supabase as any)
      .from('students')
      .insert(students)
      .select();
    
    if (error) throw error;
    clearCache();
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
    clearCache();
    return data as Student;
  },

  async delete(id: string) {
    const res = await withTimeout(
      (supabase as any)
        .from('students')
        .delete({ count: 'exact' })
        .eq('id', id),
      20000,
      'Delete Student'
    ) as any;
    
    const { error, count } = res;
    
    if (error) throw error;
    if (count === 0) {
      console.warn("No student record found to delete with ID:", id);
    }
    clearCache();
  },

  async saveFaceDescriptor(id: string, descriptor: number[]) {
    const { data, error } = await (supabase as any)
      .from('students')
      .update({ face_descriptor: JSON.stringify(Array.from(descriptor)) })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    clearCache();
    return data as Student;
  },

  async getAttendanceLogs() {
    // We don't cache logs for long because they are highly real-time, 
    // but a 5s cache helps during navigation bounces
    const cached = getFromCache('attendance_logs_all');
    if (cached) return cached;

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
      20000,
      'Get Attendance Logs'
    ) as any;
    
    const { data, error } = res;
    
    if (error) throw error;
    // Lower TTL for logs
    cache['attendance_logs_all'] = { data, timestamp: Date.now() - 25000 }; 
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
    clearCache();
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
    
    clearCache();
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

    clearCache();
    return newLog;
  },

  async getDashboardStats() {
    const cached = getFromCache('dashboard_stats');
    if (cached) return cached;

    const today = new Date();
    const start = startOfDay(today).toISOString();
    const end = endOfDay(today).toISOString();

    // Fetch in parallel but with a safety catch
    const [allStudentsData, todayLogsData] = await withTimeout(
      Promise.all([
        (supabase as any).from('students').select('id, class_name'),
        (supabase as any).from('attendance_logs').select('student_id, status').eq('is_deleted', false).gte('created_at', start).lte('created_at', end)
      ]),
      20000,
      'Dashboard Stats Fetch'
    ) as any[];

    const students = allStudentsData?.data || [];
    const logs = todayLogsData?.data || [];
    
    const result = this.processDashboardStats(students, logs);
    setCache('dashboard_stats', result);
    return result;
  },

  processDashboardStats(students: any[], logs: any[]) {
    const totalSiswa = students.length;
    
    // Efficient counting using Sets
    const hadirPagiIds = new Set();
    const dzuhurIds = new Set();
    const pulangIds = new Set();

    // Map for class stats to avoid multiple passes
    const classStats: Record<string, { total: number, pagi: number, dzuhur: number, pulang: number }> = {};
    
    // Group logs by student and type first for faster lookup
    const studentStatusMap: Record<string, Set<string>> = {};
    logs.forEach((l: any) => {
      if (!studentStatusMap[l.student_id]) studentStatusMap[l.student_id] = new Set();
      studentStatusMap[l.student_id].add(l.status);
      
      if (l.status === 'hadir_pagi') hadirPagiIds.add(l.student_id);
      if (l.status === 'dzuhur') dzuhurIds.add(l.student_id);
      if (l.status === 'pulang') pulangIds.add(l.student_id);
    });

    students.forEach((s: any) => {
      const cls = s.class_name || "Tanpa Kelas";
      if (!classStats[cls]) classStats[cls] = { total: 0, pagi: 0, dzuhur: 0, pulang: 0 };
      classStats[cls].total++;
      
      const statuses = studentStatusMap[s.id];
      if (statuses) {
        if (statuses.has('hadir_pagi')) classStats[cls].pagi++;
        if (statuses.has('dzuhur')) classStats[cls].dzuhur++;
        if (statuses.has('pulang')) classStats[cls].pulang++;
      }
    });

    const classRekap = Object.entries(classStats)
      .map(([name, data]) => ({
        name,
        total: data.total,
        pagi: data.pagi,
        dzuhur: data.dzuhur,
        pulang: data.pulang
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return {
      totalSiswa,
      hadirPagi: hadirPagiIds.size,
      dzuhur: dzuhurIds.size,
      pulang: pulangIds.size,
      absen: totalSiswa - hadirPagiIds.size,
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
  },

  clearCache() {
    clearCache();
  }
};
