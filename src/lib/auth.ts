import { createClient } from "@/lib/supabase/server";

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    // env not configured yet — auth wiring lands once Jim's Supabase project is up
    return null;
  }
}
