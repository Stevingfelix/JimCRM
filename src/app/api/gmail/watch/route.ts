import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { startWatch, stopWatch } from "@/lib/gmail/watch";

// POST → start the Gmail Push watch for the connected mailbox.
// DELETE → stop it.

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await startWatch();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    historyId: result.historyId,
    expiration: result.expiration,
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await stopWatch();
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    info: "POST to start watch, DELETE to stop. Requires authenticated session.",
  });
}
