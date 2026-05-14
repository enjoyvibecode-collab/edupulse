import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/index';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Clean the URL: remove trailing slashes safely
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.trim().replace(/\/$/, '');
  // If it includes /rest/v1 at the end, remove it as the client adds it automatically
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1$/, '');
}

if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
  console.error('CRITICAL: VITE_SUPABASE_URL is missing or invalid. Make sure it starts with https://');
}

if (!supabaseAnonKey) {
  console.error('CRITICAL: VITE_SUPABASE_ANON_KEY is missing.');
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
