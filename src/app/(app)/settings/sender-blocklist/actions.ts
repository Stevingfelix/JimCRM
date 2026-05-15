"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, err, fromException, ok } from "@/lib/result";
import { unblockSender } from "@/lib/sender-blocklist";

const UnblockSchema = z.string().trim().toLowerCase().email();

export async function unblockSenderAction(
  email: string,
): Promise<ActionResult<void>> {
  const parsed = UnblockSchema.safeParse(email);
  if (!parsed.success) return err("validation", "Invalid email");
  try {
    await unblockSender(parsed.data);
    revalidatePath("/settings/sender-blocklist");
    return ok(undefined);
  } catch (e) {
    return fromException(e);
  }
}
