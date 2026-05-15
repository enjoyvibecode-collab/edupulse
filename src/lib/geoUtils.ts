/**
 * Calculate distance between two points in meters using Haversine formula
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

export interface GeofenceConfig {
  latitude: number;
  longitude: number;
  radius: number; // in meters
}

// Default School Zone (Example: Near a central point)
export const SCHOOL_ZONE: GeofenceConfig = {
  latitude: -7.349922, 
  longitude: 108.308728,
  radius: 300 // 300 meters
};

/**
 * Play a high-quality success beep using Web Audio API
 */
export function playSuccessSound() {
  const context = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = context.createOscillator();
  const gainValue = context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, context.currentTime); // A5 note
  oscillator.frequency.exponentialRampToValueAtTime(440, context.currentTime + 0.1); // Slide down to A4
  
  gainValue.gain.setValueAtTime(0, context.currentTime);
  gainValue.gain.linearRampToValueAtTime(0.2, context.currentTime + 0.05);
  gainValue.gain.linearRampToValueAtTime(0, context.currentTime + 0.3);

  oscillator.connect(gainValue);
  gainValue.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + 0.3);
}

export function playErrorSound() {
  const context = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = context.createOscillator();
  const gainValue = context.createGain();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(220, context.currentTime); 
  
  gainValue.gain.setValueAtTime(0, context.currentTime);
  gainValue.gain.linearRampToValueAtTime(0.1, context.currentTime + 0.05);
  gainValue.gain.linearRampToValueAtTime(0, context.currentTime + 0.2);

  oscillator.connect(gainValue);
  gainValue.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + 0.2);
}
