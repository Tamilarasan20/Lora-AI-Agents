import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser-side Supabase client — import this in Client Components
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export type { Session, User } from '@supabase/supabase-js';
