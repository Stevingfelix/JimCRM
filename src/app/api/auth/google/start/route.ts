import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildAuthUrl } from "@/lib/gmail/oauth";

const STATE_COOKIE = "google_oauth_state";

export async function GET() {
  try {
    const state = randomBytes(24).toString("hex");
    const url = buildAuthUrl(state);
    const res = NextResponse.redirect(url);
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 min
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth start failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
