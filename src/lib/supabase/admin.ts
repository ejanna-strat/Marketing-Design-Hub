import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Service-role client: bypasses Row Level Security. Server only, and only for
// jobs no user should do directly (the email log, email recipient lists).
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
