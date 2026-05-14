import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/index';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Clean the URL: ensure it's a valid Supabase origin
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.trim();
  // Remove protocols to re-add consistently
  supabaseUrl = supabaseUrl.replace(/^https?:\/\//, '');
  // Remove all path segments to get just the domain
  supabaseUrl = supabaseUrl.split('/')[0];
  // Re-add https
  supabaseUrl = `https://${supabaseUrl}`;
}

const isConfigured = !!supabaseUrl && supabaseUrl.includes('.supabase.co') && !!supabaseAnonKey && supabaseAnonKey !== 'placeholder-key';

if (!isConfigured) {
  console.warn('Supabase is not fully configured. Some features may not work.');
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

/**
 * Helper to wrap promises with a timeout
 */
export async function withTimeout<T>(promise: Promise<T> | any, timeoutMs: number = 30000, context: string = 'Operation'): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${context} timed out after ${timeoutMs}ms. Periksa koneksi internet Anda atau pastikan URL/Key Supabase sudah benar.`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise as Promise<T>, timeoutPromise]);
    clearTimeout(timeoutId);
    return result as T;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
