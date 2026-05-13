"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

export async function markAllNotificationsSeen(): Promise<ActionResult<void>> {
  try {
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return err("auth", "Not signed in");

    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user.user_metadata,
        last_notifications_seen_at: new Date().toISOString(),
      },
    });
    if (error) return err("db_error", error.message);

    revalidatePath("/", "layout");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}
