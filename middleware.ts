import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/dashboard", "/onboarding", "/reports", "/listings", "/leads", "/settings", "/short-term-rentals", "/appraisals", "/brochures", "/social", "/create", "/marketing", "/contacts", "/clients"];

const CANONICAL_PRODUCTION_HOST = "staypack.app";
const LEGACY_NETLIFY_HOST = "staypack.netlify.app";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";

  if (host === LEGACY_NETLIFY_HOST) {
    const url = request.nextUrl.clone();
    url.protocol = "https";
    url.host = CANONICAL_PRODUCTION_HOST;
    return NextResponse.redirect(url, 308);
  }

  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  // Public/auth pages are static. APIs authorize at their data boundary and can
  // refresh cookies themselves. Only protected page renders need this refresh.
  if (!isProtected) return NextResponse.next({ request });
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Verify/refresh the cookie here; getUser and current membership are checked
  // again at the server data boundary. Avoid a second membership database trip.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    const response = NextResponse.redirect(url);
    for (const cookie of supabaseResponse.cookies.getAll()) response.cookies.set(cookie);
    return response;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/onboarding/:path*", "/reports/:path*", "/listings/:path*",
    "/leads/:path*", "/settings/:path*", "/short-term-rentals/:path*", "/appraisals/:path*",
    "/brochures/:path*", "/social/:path*", "/create/:path*", "/marketing/str-calculator/:path*",
    "/contacts/:path*", "/clients/:path*",
  ],
};
