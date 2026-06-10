import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth middleware: redirects unauthenticated users to /login,
 * and authenticated users away from auth pages to /dashboard.
 */
export async function proxy(request: NextRequest) {
  // Customer short link: the dedicated `robotekstock.*` host sends its root
  // straight to the public stock page so customers can just type the bare domain.
  const host = request.headers.get("host") || "";
  if (host.startsWith("robotekstock.") && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/stock";
    return NextResponse.redirect(url);
  }

  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Forward any refreshed tokens to the outgoing response
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");
  const isPublicPage = request.nextUrl.pathname === "/";
  // Public API endpoints — authenticated by their own Bearer token, not session cookies
  const isPublicApi = request.nextUrl.pathname.startsWith("/api/stock/");

  if (!user && !isAuthPage && !isPublicPage && !isPublicApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|stock|intake|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
