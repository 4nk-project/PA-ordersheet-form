import { createClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";

function getRuntimeEnv(name: string) {
  const processValue = process.env[name];
  if (processValue) return processValue;

  try {
    const cloudflareEnv = getCloudflareContext().env as Record<string, unknown>;
    const cloudflareValue = cloudflareEnv[name];
    return typeof cloudflareValue === "string" ? cloudflareValue : undefined;
  } catch {
    return undefined;
  }
}

export function createSupabaseAdminClient() {
  const supabaseUrl = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
