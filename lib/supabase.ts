import { createClient } from "@supabase/supabase-js";

// ✅ Read from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ✅ Create a SINGLE shared client
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);