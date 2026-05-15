import { isWithinInterval, set, parse } from 'date-fns';

export const ATTENDANCE_WINDOWS = {
  hadir_pagi: {
    start: '06:30',
    end: '07:30',
    label: 'Presensi Pagi'
  },
  dzuhur: {
    start: '11:45',
    end: '13:00',
    label: 'Presensi Dzuhur'
  },
  pulang: {
    start: '14:30',
    end: '15:30',
    label: 'Presensi Pulang'
  }
} as const;

export type AttendanceType = keyof typeof ATTENDANCE_WINDOWS;

export function isWindowActive(type: AttendanceType, now: Date = new Date()) {
  const window = ATTENDANCE_WINDOWS[type];
  const [startH, startM] = window.start.split(':').map(Number);
  const [endH, endM] = window.end.split(':').map(Number);

  const startTime = set(now, { hours: startH, minutes: startM, seconds: 0, milliseconds: 0 });
  const endTime = set(now, { hours: endH, minutes: endM, seconds: 0, milliseconds: 0 });

  return isWithinInterval(now, { start: startTime, end: endTime });
}

export function getAttendanceStatus(type: AttendanceType, now: Date = new Date()) {
  const window = ATTENDANCE_WINDOWS[type];
  const [endH, endM] = window.end.split(':').map(Number);
  const endTime = set(now, { hours: endH, minutes: endM, seconds: 0, milliseconds: 0 });

  if (isWindowActive(type, now)) {
    return 'On-Time';
  }

  if (now > endTime) {
    return 'Late';
  }

  return 'Early';
}
