import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

// API routes that authenticate themselves (don't require a user session).
const API_PUBLIC_PREFIXES = [
  "/api/cron/", // CRON_SECRET-authenticated
  "/api/auth/", // OAuth + session endpoints
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // IMPORTANT: refresh session — this calls Supabase to validate the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isPublicApi = API_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Unauthenticated user trying to reach a protected page → /login
  if (!user && !isPublic && !isPublicApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user on /login → /
  if (user && pathname.startsWith("/login")) {
    const next = request.nextUrl.searchParams.get("next") ?? "/";
    return NextResponse.redirect(new URL(next, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Match everything except _next, static, and image assets.
    "/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
