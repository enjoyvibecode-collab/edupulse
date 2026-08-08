import * as React from 'react';
import { useAttendanceQueue } from '@/hooks/useAttendanceQueue';
import { 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  X,
  Database,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export function OfflineSyncBanner() {
  const { queue, pendingCount, isSyncing, isOnline, syncNow, clearSynced } = useAttendanceQueue();
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  if (pendingCount === 0 && isOnline) {
    return null;
  }

  if (dismissed && pendingCount === 0) {
    return null;
  }

  return (
    <>
      <div className="mb-4 p-3 md:p-4 rounded-2xl bg-indigo-900/90 text-white backdrop-blur-md border border-indigo-700/50 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-800/90 rounded-xl shrink-0 text-amber-300 shadow-inner">
            {!isOnline ? (
              <WifiOff className="w-5 h-5 animate-pulse" />
            ) : (
              <Database className="w-5 h-5 text-indigo-200 animate-bounce" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-100">
                {!isOnline ? 'Mode Presensi Perangkat Offline' : 'Antrean Presensi Offline Siap Disinkronkan'}
              </h4>
              {pendingCount > 0 && (
                <Badge className="bg-amber-400 text-indigo-950 hover:bg-amber-300 font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                  {pendingCount} Presensi Tersimpan
                </Badge>
              )}
            </div>
            <p className="text-xs text-indigo-200 mt-0.5 leading-relaxed">
              {!isOnline 
                ? 'Absensi tetap berfungsi normal & tersimpan otomatis di antrean lokal TAB. Akan diunggah saat terhubung internet.'
                : `Terdapat ${pendingCount} catatan absensi offline yang dapat dikirim langsung ke server cloud.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-indigo-800/80">
          {pendingCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsDetailsOpen(true)}
              className="bg-indigo-800/60 border-indigo-700 hover:bg-indigo-800 text-indigo-100 text-xs h-9 rounded-xl font-medium"
            >
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              Lihat Antrean
            </Button>
          )}

          {pendingCount > 0 && isOnline && (
            <Button
              size="sm"
              onClick={syncNow}
              disabled={isSyncing}
              className="bg-amber-400 text-indigo-950 hover:bg-amber-300 font-black text-xs h-9 rounded-xl transition-all shadow-md shadow-amber-400/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="text-indigo-300 hover:bg-indigo-800/50 hover:text-white h-9 w-9 p-0 rounded-xl"
            title="Sembunyikan pesan"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Daftar Antrean Absensi Offline</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Data presensi yang dicatat dalam kondisi offline dan tersimpan di penyimpanan tablet/HP ini.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="my-4 space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {queue.length === 0 ? (
              <div className="text-center py-8 text-slate-500 font-medium text-sm">
                Tidak ada data presensi yang tertunda. Semua telah tersinkronisasi!
              </div>
            ) : (
              queue.map((item) => (
                <div 
                  key={item.queueId} 
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-100">
                      {item.status === 'synced' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : item.status === 'failed' ? (
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {item.studentName || item.log.student_id}
                        {item.studentNisn && (
                          <span className="text-xs text-slate-500 ml-2 font-mono">
                            (NISN: {item.studentNisn})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="capitalize font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px]">
                          {item.log.status.replace('_', ' ')}
                        </span>
                        <span>•</span>
                        <span>
                          {format(new Date(item.timestamp), 'dd MMM yyyy HH:mm', { locale: localeId })}
                        </span>
                      </div>
                      {item.lastError && item.status === 'failed' && (
                        <p className="text-[11px] text-rose-600 font-medium mt-1">
                          Penyebab: {item.lastError}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Badge 
                      variant="outline" 
                      className={
                        item.status === 'synced' 
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                          : item.status === 'failed'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }
                    >
                      {item.status === 'synced' ? 'Tersinkron' : item.status === 'failed' ? 'Gagal Sync' : 'Menunggu'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSynced}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Bersihkan yang Tersinkron
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailsOpen(false)}
                className="rounded-xl text-xs h-9"
              >
                Tutup
              </Button>
              {pendingCount > 0 && isOnline && (
                <Button
                  size="sm"
                  onClick={async () => {
                    await syncNow();
                  }}
                  disabled={isSyncing}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs h-9 font-semibold"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
