import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily expiry sweep. Flips quotes from sent → expired when their
// validity_date has passed. Stamps outcome_reason + outcome_at so the
// "why did it expire?" data point is consistent with manually-set outcomes.
//
// Auth: same CRON_SECRET header used by /api/cron/gmail. Allow either
// "Authorization: Bearer <secret>" (Vercel Cron sets this) or ?secret= query
// for manual curling.

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Find quotes that should expire: sent status, validity_date < today.
    const { data: candidates, error: selErr } = await supabase
      .from("quotes")
      .select("id, quote_number, validity_date")
      .eq("status", "sent")
      .lt("validity_date", today)
      .is("deleted_at", null);
    if (selErr) {
      return NextResponse.json(
        { error: selErr.message },
        { status: 500 },
      );
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({ expired: 0, status: "ok" });
    }

    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("quotes")
      .update({
        status: "expired",
        outcome_reason: "Validity date passed",
        outcome_at: now,
      })
      .in(
        "id",
        candidates.map((c) => c.id),
      );
    if (updErr) {
      return NextResponse.json(
        { error: updErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      expired: candidates.length,
      status: "ok",
      quote_numbers: candidates.map((c) => c.quote_number),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "expire failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
