"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { type ActionResult, err, fromException, ok } from "@/lib/result";

// Public quote actions — called from the /q/[token] page WITHOUT a logged-in
// user. The token IS the auth credential here, and the admin client bypasses
// RLS. We re-verify the token on every call so a stale link can't act.

const DecisionSchema = z.object({
  token: z.string().min(20).max(200),
  decision: z.enum(["won", "lost"]),
  reason: z.string().trim().max(500).optional().nullable(),
});

export async function recordCustomerDecision(
  input: z.input<typeof DecisionSchema>,
): Promise<ActionResult<{ status: string }>> {
  const parsed = DecisionSchema.safeParse(input);
  if (!parsed.success) return err("validation", parsed.error.issues[0].message);
  try {
    const supabase = createAdminClient();
    // Verify token + fetch current status.
    const { data: quote, error: lookupErr } = await supabase
      .from("quotes")
      .select("id, status")
      .eq("public_token", parsed.data.token)
      .is("deleted_at", null)
      .maybeSingle();
    if (lookupErr || !quote) {
      return err("not_found", "Quote not found or link expired");
    }
    // Block double-recording.
    if (["won", "lost", "expired"].includes(quote.status)) {
      return err(
        "conflict",
        `This quote is already ${quote.status} — contact us to change it.`,
      );
    }

    const now = new Date().toISOString();
    const reasonLabel =
      parsed.data.decision === "won"
        ? "Customer accepted via portal"
        : "Customer declined via portal";
    const finalReason = parsed.data.reason
      ? `${reasonLabel} — ${parsed.data.reason}`
      : reasonLabel;

    const { error } = await supabase
      .from("quotes")
      .update({
        status: parsed.data.decision,
        outcome_reason: finalReason,
        outcome_at: now,
      })
      .eq("id", quote.id);
    if (error) return err(error.code ?? "db_error", error.message);
    return ok({ status: parsed.data.decision });
  } catch (e) {
    return fromException(e);
  }
}
