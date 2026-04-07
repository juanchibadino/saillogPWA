import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  MissingEnvironmentVariableError,
  getOptionalSupabaseSecretKey,
  getSupabasePublicEnv,
} from "./env";

export function createAdminSupabaseClient(): SupabaseClient<Database> {
  const { NEXT_PUBLIC_SUPABASE_URL } = getSupabasePublicEnv();
  const secretKey = getOptionalSupabaseSecretKey();

  if (!secretKey) {
    throw new MissingEnvironmentVariableError("SUPABASE_SECRET_KEY");
  }

  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
