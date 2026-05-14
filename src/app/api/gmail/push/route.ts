import { NextRequest, NextResponse } from "next/server";
import { processHistorySince } from "@/lib/gmail/watch";

// Pub/Sub push notification handler. Pub/Sub POSTs here whenever Gmail
// publishes a change notification to our topic.
//
// Pub/Sub message envelope:
// {
//   "message": {
//     "data": "<base64-encoded JSON>",
//     "messageId": "...",
//     "publishTime": "..."
//   },
//   "subscription": "..."
// }
//
// The decoded data is { emailAddress, historyId }.
//
// Auth: we verify a shared secret in a query param (?token=...) that you
// configure in the Pub/Sub push subscription. Pub/Sub doesn't carry custom
// headers reliably, so query-param shared secret is the standard pattern.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const expected = process.env.GMAIL_PUSH_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "GMAIL_PUSH_SECRET not configured" },
      { status: 500 },
    );
  }
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { message?: { data?: string } } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const dataB64 = body.message?.data;
  if (!dataB64) {
    // Pub/Sub sometimes sends a verification ping with no data.
    return NextResponse.json({ ok: true, info: "no data" });
  }

  let payload: { emailAddress?: string; historyId?: string | number } = {};
  try {
    payload = JSON.parse(Buffer.from(dataB64, "base64").toString("utf8"));
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const historyId = String(payload.historyId ?? "");
  if (!historyId) {
    return NextResponse.json({ ok: true, info: "no historyId" });
  }

  try {
    const result = await processHistorySince(historyId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "process failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
