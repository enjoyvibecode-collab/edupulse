import { useState, useEffect, useCallback } from 'react';
import { attendanceSyncQueue, QueuedAttendanceLog } from '@/lib/attendanceSyncQueue';
import { toast } from 'sonner';

export function useAttendanceQueue() {
  const [queue, setQueue] = useState<QueuedAttendanceLog[]>(() => attendanceSyncQueue.getQueue());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  const refreshQueue = useCallback(() => {
    setQueue(attendanceSyncQueue.getQueue());
  }, []);

  useEffect(() => {
    refreshQueue();
    const unsubscribe = attendanceSyncQueue.subscribe(refreshQueue);

    const handleOnline = () => {
      setIsOnline(true);
      toast.info("Koneksi internet terhubung kembali. Memulai sinkronisasi otomatis...");
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Koneksi terputus. Presensi akan disimpan sementara di memori perangkat.");
    };

    const handleSyncedEvent = (e: any) => {
      const count = e.detail?.syncedCount || 0;
      if (count > 0) {
        toast.success(`Berhasil menyinkronkan ${count} data presensi offline ke server database!`);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('attendance_synced', handleSyncedEvent);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('attendance_synced', handleSyncedEvent);
    };
  }, [refreshQueue]);

  const syncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await attendanceSyncQueue.processSyncQueue();
      refreshQueue();
      return result;
    } catch (err: any) {
      console.error("Manual sync error:", err);
      toast.error("Gagal melakukan sinkronisasi: " + (err.message || "Kesalahan jaringan"));
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingItems = queue.filter(item => item.status === 'pending' || item.status === 'failed');
  const pendingCount = pendingItems.length;

  return {
    queue,
    pendingItems,
    pendingCount,
    isSyncing,
    isOnline,
    syncNow,
    clearSynced: () => {
      attendanceSyncQueue.clearSynced();
      refreshQueue();
    },
    clearAll: () => {
      attendanceSyncQueue.clearAll();
      refreshQueue();
    }
  };
}
