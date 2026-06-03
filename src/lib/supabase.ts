import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/index';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Clean the URL: ensure it's a valid Supabase origin
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.trim().replace(/\/$/, ''); // Trim and remove trailing slash
  if (!supabaseUrl.startsWith('http')) {
    supabaseUrl = `https://${supabaseUrl}`;
  }
}

const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.supabase.co') || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = !!supabaseUrl && isValidUrl(supabaseUrl) && !!supabaseAnonKey && supabaseAnonKey !== 'placeholder-key';

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  console.warn('Supabase CONFIG WARNING: URL or Key is missing or using placeholder.');
  (window as any).__supabaseOffline = true;
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'edupulse-auth-token',
      flowType: 'pkce'
    },
    global: {
      headers: { 'x-application-name': 'edupulse' },
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        return fetch(input, init)
          .then(res => {
            if (typeof window !== 'undefined') {
              (window as any).__supabaseOffline = false;
            }
            return res;
          })
          .catch(err => {
            if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
              console.error('CORTEX NETWORK ERROR: Likely CORS or Connectivity issue.', err);
              if (typeof window !== 'undefined') {
                (window as any).__supabaseOffline = true;
              }
              throw new Error('Gagal terhubung ke server (Failed to fetch). Periksa koneksi internet Anda atau pastikan URL Supabase dapat diakses.');
            }
            throw err;
          });
      }
    }
  }
);

/**
 * Helper to wrap promises with a timeout
 */
export async function withTimeout<T>(promise: Promise<T> | any, timeoutMs: number = 30000, context: string = 'Operation'): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const errorMsg = `${context} timeout (${timeoutMs}ms). Jalankan SQL di Supabase jika ini pertama kali, atau periksa koneksi internet.`;
      console.warn('TIMEOUT:', errorMsg);
      reject(new Error(errorMsg));
    }, timeoutMs);
  });

  try {
    // Ensure the promise is actually a native promise
    const actualPromise = Promise.resolve(promise);
    const result = await Promise.race([actualPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.message && !error.message.includes('timeout')) {
      console.error(`ERROR in ${context}:`, error);
    }
    throw error;
  }
}
