import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/gmail/oauth";
import { saveCredentials } from "@/lib/gmail/credentials";

const STATE_COOKIE = "google_oauth_state";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/review?gmail_error=${encodeURIComponent(error)}`, req.url),
    );
  }

  const expected = req.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(
      new URL("/review?gmail_error=bad_state", req.url),
    );
  }

  try {
    const tokens = await exchangeCode(code);
    await saveCredentials(tokens);
    const res = NextResponse.redirect(new URL("/review?gmail=connected", req.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth exchange failed";
    return NextResponse.redirect(
      new URL(`/review?gmail_error=${encodeURIComponent(message)}`, req.url),
    );
  }
}
