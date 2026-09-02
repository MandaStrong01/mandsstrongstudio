import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type MovieProject = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  duration: number;
  current_phase: number;
  phase_1_data: Record<string, any>;
  phase_2_data: Record<string, any>;
  phase_3_data: Record<string, any>;
  completed: boolean;
  created_at: string;
  updated_at: string;
};
