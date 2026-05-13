import { NextResponse } from "next/server";
import { getNotifications } from "@/app/(app)/notifications/queries";

// Returns the current notification payload for the signed-in user.
// Called by the bell after the realtime channel fires.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getNotifications(10);
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
