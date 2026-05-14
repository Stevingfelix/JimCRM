import { NextRequest, NextResponse } from "next/server";
import { startWatch } from "@/lib/gmail/watch";

// Weekly cron that renews the Gmail watch subscription before it expires
// (Gmail expires watches after 7 days).
//
// Schedule (vercel.json): "0 6 * * 1" (Mondays at 6am UTC)
// Or trigger via Cloudflare cron / cron-job.org.

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization");
  const queryToken = new URL(req.url).searchParams.get("secret");
  if (auth !== `Bearer ${secret}` && queryToken !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await startWatch();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    historyId: result.historyId,
    expiration: result.expiration,
  });
}
