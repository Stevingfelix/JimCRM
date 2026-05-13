import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? null,
      full_name:
        (data.user.user_metadata?.full_name as string | undefined) ?? null,
      role: (data.user.app_metadata?.role as string | undefined) ?? "user",
    };
  } catch {
    return null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}
