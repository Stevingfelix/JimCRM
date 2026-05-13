import { NextRequest, NextResponse } from "next/server";
import { pollGmail } from "@/lib/gmail/poll";

// Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. Also allow manual
// curl during dev by accepting the secret in a `?secret=` query param.
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
  const ok =
    auth === `Bearer ${secret}` || queryToken === secret;
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await pollGmail();
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "poll failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
