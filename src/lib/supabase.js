import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://yarxkehzxmvaotplfuek.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhcnhrZWh6bXZhYW90cGxmdWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NzM1MjksImV4cCI6MjEwNzQ0OTUyOX0.CiBHMJtvC71kc89EX-vgAhR_8sGc1u_wDC91R2sB_vQ';

export const supabase = createClient(supabaseUrl, supabaseKey);
