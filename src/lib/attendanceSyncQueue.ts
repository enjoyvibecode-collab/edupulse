import { supabase, isSupabaseConfigured } from "./supabase";
import { AttendanceLog } from "@/types";

export interface QueuedAttendanceLog {
  queueId: string;
  log: Omit<AttendanceLog, 'id' | 'created_at'> & { id?: string; created_at?: string };
  timestamp: string;
  studentName?: string;
  studentNisn?: string;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  retryCount: number;
  lastError?: string;
}

const QUEUE_STORAGE_KEY = 'offline_attendance_queue';
const EVENT_NAME = 'attendance_queue_updated';

let isSyncingInProgress = false;

export const attendanceSyncQueue = {
  getQueue(): QueuedAttendanceLog[] {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to parse offline attendance queue:", e);
      return [];
    }
  },

  saveQueue(queue: QueuedAttendanceLog[]): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      this.notifyListeners();
    } catch (e) {
      console.error("Failed to save offline attendance queue:", e);
    }
  },

  getPendingQueue(): QueuedAttendanceLog[] {
    return this.getQueue().filter(item => item.status === 'pending' || item.status === 'failed');
  },

  getPendingCount(): number {
    return this.getPendingQueue().length;
  },

  addToQueue(
    log: Omit<AttendanceLog, 'id' | 'created_at'> & { id?: string; created_at?: string },
    meta?: { studentName?: string; studentNisn?: string }
  ): QueuedAttendanceLog {
    const queue = this.getQueue();
    const queueId = `qlog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    const newItem: QueuedAttendanceLog = {
      queueId,
      log: {
        student_id: log.student_id,
        status: log.status,
        confidence: log.confidence,
        captured_image: log.captured_image,
        is_deleted: log.is_deleted ?? false,
      },
      timestamp: log.created_at || new Date().toISOString(),
      studentName: meta?.studentName,
      studentNisn: meta?.studentNisn,
      status: 'pending',
      retryCount: 0
    };

    queue.unshift(newItem);
    this.saveQueue(queue);

    // Try background sync immediately if browser reports online
    if (navigator.onLine && isSupabaseConfigured) {
      setTimeout(() => {
        this.processSyncQueue();
      }, 500);
    }

    return newItem;
  },

  async processSyncQueue(): Promise<{ syncedCount: number; failedCount: number }> {
    if (isSyncingInProgress) {
      console.log("Sync process already running...");
      return { syncedCount: 0, failedCount: 0 };
    }

    if (!navigator.onLine) {
      console.log("Device is offline, skipping queue sync.");
      return { syncedCount: 0, failedCount: this.getPendingCount() };
    }

    const queue = this.getQueue();
    const pendingItems = queue.filter(item => item.status === 'pending' || item.status === 'failed');

    if (pendingItems.length === 0) {
      return { syncedCount: 0, failedCount: 0 };
    }

    isSyncingInProgress = true;
    let syncedCount = 0;
    let failedCount = 0;

    // Mark pending items as syncing
    pendingItems.forEach(item => {
      item.status = 'syncing';
    });
    this.saveQueue(queue);

    for (const item of pendingItems) {
      try {
        // Clean log object to send to Supabase
        const payload = {
          student_id: item.log.student_id,
          status: item.log.status,
          confidence: item.log.confidence,
          captured_image: item.log.captured_image,
          created_at: item.timestamp,
          is_deleted: false
        };

        const { data, error } = await (supabase as any)
          .from('attendance_logs')
          .insert([payload])
          .select()
          .single();

        if (error) {
          // If duplicate or conflict, treat as synced or update error
          if (error.code === '23505') { // Unique constraint violation (e.g., student already logged for window)
            console.warn("Log already exists on server, marking synced:", item.queueId);
            item.status = 'synced';
            syncedCount++;
          } else {
            throw error;
          }
        } else {
          item.status = 'synced';
          syncedCount++;
        }
      } catch (err: any) {
        console.error(`Failed to sync item ${item.queueId}:`, err);
        item.status = 'failed';
        item.retryCount += 1;
        item.lastError = err?.message || 'Error koneksi server';
        failedCount++;

        // If network error, stop processing further items in loop
        if (!navigator.onLine || err?.message?.includes('FetchError') || err?.message?.includes('NetworkError')) {
          break;
        }
      }
    }

    // Retain non-synced items and recent synced items (keep last 50 synced for audit UI)
    const activeQueue = queue.filter(item => item.status !== 'synced');
    this.saveQueue(activeQueue);

    isSyncingInProgress = false;

    if (syncedCount > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('attendance_synced', { 
        detail: { syncedCount, timestamp: new Date().toISOString() } 
      }));
    }

    return { syncedCount, failedCount };
  },

  clearSynced(): void {
    const queue = this.getQueue().filter(i => i.status !== 'synced');
    this.saveQueue(queue);
  },

  clearAll(): void {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
    this.notifyListeners();
  },

  notifyListeners(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME));
    }
  },

  subscribe(callback: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    
    const handleUpdate = () => callback();
    const handleOnline = () => {
      callback();
      this.processSyncQueue();
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener('online', handleOnline);
    };
  }
};
