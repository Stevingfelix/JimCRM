import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles redirects from:
//   - Supabase magic-link email (?code=...)
//   - Google OAuth (?code=...)
// Both return a one-time code that we exchange for a session cookie.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const next = url.searchParams.get("next") ?? "/";

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, req.url),
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", req.url),
    );
  }

  try {
    const supabase = createClient();
    const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchErr) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(exchErr.message)}`, req.url),
      );
    }
    return NextResponse.redirect(new URL(next, req.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : "exchange failed";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, req.url),
    );
  }
}
