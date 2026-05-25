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

const INITIAL_LOCAL_STUDENTS: Student[] = [
  { id: 'student-1', nisn: '1234567801', full_name: 'Ahmad Subarjo', class_name: '9A', parent_name: 'Bpk. Subarjo', parent_phone: '081234567890', created_at: new Date().toISOString() },
  { id: 'student-2', nisn: '1234567802', full_name: 'Siti Aminah', class_name: '9B', parent_name: 'Ibu Aminah', parent_phone: '081234567891', created_at: new Date().toISOString() },
  { id: 'student-3', nisn: '1234567803', full_name: 'Budi Hartanto', class_name: '9A', parent_name: 'Bpk. Hartanto', parent_phone: '081234567892', created_at: new Date().toISOString() },
  { id: 'student-4', nisn: '1234567804', full_name: 'Dewi Lestari', class_name: '8C', parent_name: 'Ibu Lestari', parent_phone: '081234567893', created_at: new Date().toISOString() },
  { id: 'student-5', nisn: '1234567805', full_name: 'Eko Prasetyo', class_name: '7F', parent_name: 'Bpk. Prasetyo', parent_phone: '081234567894', created_at: new Date().toISOString() },
];

export const localDb = {
  getStudents(): Student[] {
    const data = localStorage.getItem('local_students');
    if (!data) {
      localStorage.setItem('local_students', JSON.stringify(INITIAL_LOCAL_STUDENTS));
      return INITIAL_LOCAL_STUDENTS;
    }
    return JSON.parse(data);
  },
  saveStudents(students: Student[]) {
    localStorage.setItem('local_students', JSON.stringify(students));
  },
  getLogs(): any[] {
    const data = localStorage.getItem('local_attendance_logs');
    return data ? JSON.parse(data) : [];
  },
  saveLogs(logs: any[]) {
    localStorage.setItem('local_attendance_logs', JSON.stringify(logs));
  }
};

export const studentService = {
  async getAll() {
    const cached = getFromCache('students_all');
    if (cached) return cached;

    try {
      const res = await withTimeout(
        (supabase as any)
          .from('students')
          .select('*')
          .order('created_at', { ascending: false }),
        10000,
        'Get All Students'
      ) as any;
      
      const { data, error } = res;
      if (error) throw error;
      setCache('students_all', data);
      localDb.saveStudents(data as Student[]);
      return data as Student[];
    } catch (e: any) {
      console.warn("Using offline localDb fallback for getAll:", e.message);
      const data = localDb.getStudents();
      setCache('students_all', data);
      return data;
    }
  },

  async getById(id: string) {
    try {
      const res = await withTimeout(
        (supabase as any)
          .from('students')
          .select('*')
          .eq('id', id)
          .single(),
        10000,
        'Get Student By ID'
      ) as any;
      
      const { data, error } = res;
      if (error) throw error;
      return data as Student;
    } catch (e: any) {
      console.warn("Using offline localDb fallback for getById:", e.message);
      const student = localDb.getStudents().find(s => s.id === id);
      if (!student) throw new Error("Student not found locally or online.");
      return student;
    }
  },

  async create(student: Omit<Student, 'id' | 'created_at'>) {
    try {
      const { data, error } = await (supabase as any)
        .from('students')
        .insert([student])
        .select()
        .single();
      
      if (error) throw error;
      clearCache();
      return data as Student;
    } catch (e: any) {
      console.warn("Using offline localDb fallback for create:", e.message);
      const list = localDb.getStudents();
      const newStudent: Student = {
        ...student,
        id: `student-${Math.random().toString(36).substring(2, 11)}`,
        created_at: new Date().toISOString()
      };
      list.unshift(newStudent);
      localDb.saveStudents(list);
      clearCache();
      return newStudent;
    }
  },

  async bulkCreate(students: Omit<Student, 'id' | 'created_at'>[]) {
    try {
      const { data, error } = await (supabase as any)
        .from('students')
        .insert(students)
        .select();
      
      if (error) throw error;
      clearCache();
      return data as Student[];
    } catch (e: any) {
      console.warn("Using offline localDb fallback for bulkCreate:", e.message);
      const list = localDb.getStudents();
      const created: Student[] = students.map(s => ({
        ...s,
        id: `student-${Math.random().toString(36).substring(2, 11)}`,
        created_at: new Date().toISOString()
      }));
      const newList = [...created, ...list];
      localDb.saveStudents(newList);
      clearCache();
      return created;
    }
  },

  async bulkUpsert(students: Student[]) {
    try {
      const { data, error } = await (supabase as any)
        .from('students')
        .upsert(students)
        .select();
      
      if (error) throw error;
      clearCache();
      return data as Student[];
    } catch (e: any) {
      console.warn("Using offline localDb fallback for bulkUpsert:", e.message);
      const list = localDb.getStudents();
      const updatedList = [...list];
      students.forEach(s => {
        const idx = updatedList.findIndex(item => item.id === s.id || item.nisn === s.nisn);
        if (idx !== -1) {
          updatedList[idx] = { ...updatedList[idx], ...s };
        } else {
          updatedList.unshift(s);
        }
      });
      localDb.saveStudents(updatedList);
      clearCache();
      return students;
    }
  },

  async update(id: string, updates: Partial<Omit<Student, 'id' | 'created_at'>>) {
    try {
      const { data, error } = await (supabase as any)
        .from('students')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      clearCache();
      return data as Student;
    } catch (e: any) {
      console.warn("Using offline localDb fallback for update:", e.message);
      const list = localDb.getStudents();
      const idx = list.findIndex(s => s.id === id);
      if (idx === -1) throw new Error("Student not found locally.");
      const updated = { ...list[idx], ...updates };
      list[idx] = updated;
      localDb.saveStudents(list);
      clearCache();
      return updated;
    }
  },

  async delete(id: string) {
    try {
      const res = await withTimeout(
        (supabase as any)
          .from('students')
          .delete({ count: 'exact' })
          .eq('id', id),
        10000,
        'Delete Student'
      ) as any;
      
      const { error, count } = res;
      if (error) throw error;
      clearCache();
    } catch (e: any) {
      console.warn("Using offline localDb fallback for delete:", e.message);
      const list = localDb.getStudents();
      const filtered = list.filter(s => s.id !== id);
      localDb.saveStudents(filtered);
      clearCache();
    }
  },

  async saveFaceDescriptor(id: string, descriptor: number[]) {
    try {
      const { data, error } = await (supabase as any)
        .from('students')
        .update({ face_descriptor: JSON.stringify(Array.from(descriptor)) })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      clearCache();
      return data as Student;
    } catch (e: any) {
      console.warn("Using offline localDb fallback for saveFaceDescriptor:", e.message);
      return this.update(id, { face_descriptor: JSON.stringify(Array.from(descriptor)) });
    }
  },

  async getAttendanceLogs() {
    const cached = getFromCache('attendance_logs_all');
    if (cached) return cached;

    try {
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
        12000,
        'Get Attendance Logs'
      ) as any;
      
      const { data, error } = res;
      if (error) throw error;
      
      localDb.saveLogs(data);
      cache['attendance_logs_all'] = { data, timestamp: Date.now() - 25000 }; 
      return data;
    } catch (e: any) {
      console.warn("Using offline localDb fallback for getAttendanceLogs:", e.message);
      const logs = localDb.getLogs();
      const students = localDb.getStudents();
      const joinedLogs = logs.map(log => {
        const student = students.find(s => s.id === log.student_id);
        return {
          ...log,
          students: student ? {
            full_name: student.full_name,
            nisn: student.nisn
          } : {
            full_name: "Unknown Student",
            nisn: "0000000000"
          }
        };
      });
      cache['attendance_logs_all'] = { data: joinedLogs, timestamp: Date.now() - 25000 };
      return joinedLogs;
    }
  },

  async getTodayLogs(studentId: string) {
    try {
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
    } catch (e: any) {
      console.warn("Using offline localDb fallback for getTodayLogs:", e.message);
      const logs = localDb.getLogs();
      const today = new Date();
      const startStr = startOfDay(today).toISOString();
      const endStr = endOfDay(today).toISOString();
      
      return logs.filter(l => 
        l.student_id === studentId && 
        !l.is_deleted && 
        l.created_at >= startStr && 
        l.created_at <= endStr
      ) as AttendanceLog[];
    }
  },

  async markAttendance(log: Omit<AttendanceLog, 'id' | 'created_at'>) {
    const todayLogs = await this.getTodayLogs(log.student_id);
    
    const hasPagi = todayLogs.some(l => l.status === 'hadir_pagi');
    const hasDzuhur = todayLogs.some(l => l.status === 'dzuhur');
    const hasPulang = todayLogs.some(l => l.status === 'pulang');

    if (log.status === 'hadir_pagi' && hasPagi) {
      throw new Error("Siswa sudah melakukan presensi Hadir Pagi hari ini.");
    }
    if (log.status === 'dzuhur' && hasDzuhur) {
      throw new Error("Siswa sudah melakukan presensi Dzuhur hari ini.");
    }
    if (log.status === 'pulang' && hasPulang) {
      throw new Error("Siswa sudah melakukan presensi Pulang hari ini.");
    }

    try {
      const { data, error } = await (supabase as any)
        .from('attendance_logs')
        .insert([log])
        .select()
        .single();
      
      if (error) throw error;
      clearCache();
      return data as AttendanceLog;
    } catch (e: any) {
      console.warn("Using offline localDb fallback for markAttendance:", e.message);
      const logs = localDb.getLogs();
      const newLog: AttendanceLog = {
        ...log,
        id: `log-${Math.random().toString(36).substring(2, 11)}`,
        created_at: new Date().toISOString()
      };
      logs.unshift(newLog);
      localDb.saveLogs(logs);
      clearCache();
      return newLog;
    }
  },

  async softDeleteAttendance(id: string, adminId: string, reason: string = "Salah klik / Koreksi Admin") {
    try {
      const { data: oldLog } = await (supabase as any)
        .from('attendance_logs')
        .select('*')
        .eq('id', id)
        .single();

      if (!oldLog) throw new Error("Log tidak ditemukan");

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
    } catch (e: any) {
      console.warn("Using offline localDb fallback for softDeleteAttendance:", e.message);
      const logs = localDb.getLogs();
      const idx = logs.findIndex(l => l.id === id);
      if (idx !== -1) {
        logs[idx].is_deleted = true;
        logs[idx].deleted_at = new Date().toISOString();
        logs[idx].deleted_by = adminId;
        logs[idx].correction_note = reason;
        localDb.saveLogs(logs);
      }
      clearCache();
    }
  },

  async updateAttendance(id: string, updates: Partial<AttendanceLog>, adminId: string, reason: string) {
    try {
      const { data: oldLog } = await (supabase as any)
        .from('attendance_logs')
        .select('*')
        .eq('id', id)
        .single();

      if (!oldLog) throw new Error("Log tidak ditemukan");

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
    } catch (e: any) {
      console.warn("Using offline localDb fallback for updateAttendance:", e.message);
      const logs = localDb.getLogs();
      const idx = logs.findIndex(l => l.id === id);
      if (idx === -1) throw new Error("Log not found locally.");
      const updated = {
        ...logs[idx],
        ...updates,
        edited_at: new Date().toISOString(),
        correction_note: reason
      };
      logs[idx] = updated;
      localDb.saveLogs(logs);
      clearCache();
      return updated;
    }
  },

  async getDashboardStats() {
    const cached = getFromCache('dashboard_stats');
    if (cached) return cached;

    const today = new Date();
    const start = startOfDay(today).toISOString();
    const end = endOfDay(today).toISOString();

    try {
      const [allStudentsData, todayLogsData] = await withTimeout(
        Promise.all([
          (supabase as any).from('students').select('id, class_name'),
          (supabase as any).from('attendance_logs').select('student_id, status').eq('is_deleted', false).gte('created_at', start).lte('created_at', end)
        ]),
        10000,
        'Dashboard Stats Fetch'
      ) as any[];

      const students = allStudentsData?.data || [];
      const logs = todayLogsData?.data || [];
      
      const result = this.processDashboardStats(students, logs);
      setCache('dashboard_stats', result);
      return result;
    } catch (e: any) {
      console.warn("Using offline localDb fallback for getDashboardStats:", e.message);
      const students = localDb.getStudents();
      const logs = localDb.getLogs().filter(l => 
        !l.is_deleted && 
        l.created_at >= start && 
        l.created_at <= end
      );
      const result = this.processDashboardStats(students, logs);
      setCache('dashboard_stats', result);
      return result;
    }
  },

  processDashboardStats(students: any[], logs: any[]) {
    const totalSiswa = students.length;
    
    const hadirPagiIds = new Set();
    const dzuhurIds = new Set();
    const pulangIds = new Set();

    const classStats: Record<string, { total: number, pagi: number, dzuhur: number, pulang: number }> = {};
    
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

    try {
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
        const uniqueStudents = new Set(dayLogs.map(l => l.student_id)).size;
        return {
          name: format(day, 'EEE', { locale: localeId }),
          hadir: uniqueStudents
        };
      });

      return weeklyData;
    } catch (e: any) {
      console.warn("Using offline localDb fallback for getWeeklyStats:", e.message);
      const logs = localDb.getLogs().filter(l => !l.is_deleted && l.created_at >= start);
      const days = eachDayOfInterval({ start: sevenDaysAgo, end: today });
      
      const weeklyData = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayLogs = logs.filter(l => 
          format(new Date(l.created_at), 'yyyy-MM-dd') === dateStr && l.status === 'hadir_pagi'
        );
        const uniqueStudents = new Set(dayLogs.map(l => l.student_id)).size;
        return {
          name: format(day, 'EEE', { locale: localeId }),
          hadir: uniqueStudents
        };
      });
      return weeklyData;
    }
  },

  async uploadPhoto(file: File) {
    try {
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
    } catch (e: any) {
      console.warn("Using offline localDb fallback for uploadPhoto:", e.message);
      return URL.createObjectURL(file);
    }
  },

  async getServerTime() {
    try {
      const { data, error } = await supabase.rpc('get_server_time');
      if (error) throw error;
      return new Date(data);
    } catch (e) {
      return new Date();
    }
  },

  clearCache() {
    clearCache();
  }
};
