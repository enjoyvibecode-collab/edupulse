import { supabase, withTimeout } from "./supabase";
import { Student, AttendanceLog } from "@/types";
import { startOfDay, endOfDay, subDays, format, eachDayOfInterval } from "date-fns";
import { id as localeId } from "date-fns/locale";

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
        .order('created_at', { ascending: false }),
      30000,
      'Get Attendance Logs'
    ) as any;
    
    const { data, error } = res;
    
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

    const results = await withTimeout(
      Promise.all([
        (supabase as any).from('students').select('*'), // Need all students to group by class
        (supabase as any).from('attendance_logs').select('*').gte('created_at', start).lte('created_at', end)
      ]),
      30000,
      'Get Dashboard Stats'
    ) as any[];

    const [allStudentsData, todayLogs] = results;
    const students = (allStudentsData as any).data || [];
    const totalSiswa = students.length;
    const logs = (todayLogs as any).data || [];
    
    // Count unique students present today
    const uniquePresentIds = new Set(logs.filter((l: any) => l.status === 'arrival').map((l: any) => l.student_id));
    const uniquePresent = uniquePresentIds.size;
    const uniquePulang = new Set(logs.filter((l: any) => l.status === 'departure').map((l: any) => l.student_id)).size;

    // Calculate Class Attendance
    const classStats: Record<string, { total: number, present: number }> = {};
    
    students.forEach((s: any) => {
      const cls = s.kelas || "Tanpa Kelas";
      if (!classStats[cls]) classStats[cls] = { total: 0, present: 0 };
      classStats[cls].total++;
      if (uniquePresentIds.has(s.id)) {
        classStats[cls].present++;
      }
    });

    const bestClasses = Object.entries(classStats)
      .map(([name, data]) => ({
        name: `Kelas ${name}`,
        value: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4); // Top 4
    
    return {
      totalSiswa,
      hadirHariIni: uniquePresent,
      absen: totalSiswa - uniquePresent,
      pulang: uniquePulang,
      bestClasses: bestClasses.length > 0 ? bestClasses : [
        { name: "Memuat Data...", value: 0 }
      ]
    };
  },

  async getWeeklyStats() {
    const today = new Date();
    const sevenDaysAgo = subDays(today, 6);
    const start = startOfDay(sevenDaysAgo).toISOString();

    const { data: logs, error } = await (supabase as any)
      .from('attendance_logs')
      .select('created_at, student_id, status')
      .gte('created_at', start);

    if (error) throw error;

    const days = eachDayOfInterval({ start: sevenDaysAgo, end: today });
    
    const weeklyData = days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayLogs = (logs as any[]).filter(l => 
        format(new Date(l.created_at), 'yyyy-MM-dd') === dateStr && l.status === 'arrival'
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
  }
};
