import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const INTERNAL_USER_HEADER = "x-royalhouse-user-id";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  // Next.js 16 uses proxy.ts. Refresh the Supabase SSR session once per
  // request. Auth endpoints themselves must not go through this refresh path:
  // they are the point where a new session is being created.
  const pathname = request.nextUrl.pathname;
  if (pathname === "/account/login" || pathname === "/register" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next({ request });
  }

  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  // The proxy has already cryptographically verified the JWT. Pass only that
  // verified subject to account API routes so they do not perform a second
  // Supabase Auth lookup immediately after OTP. Delete any client-supplied
  // value first so the header can never be used for spoofing.
  if (pathname.startsWith("/api/account/")) {
    const headers = new Headers(request.headers);
    headers.delete(INTERNAL_USER_HEADER);
    if (userId) headers.set(INTERNAL_USER_HEADER, userId);

    const nextResponse = NextResponse.next({ request: { headers } });
    nextResponse.cookies.setAll(supabaseResponse.cookies.getAll());
    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = supabaseResponse.headers.get(header);
      if (value) nextResponse.headers.set(header, value);
    }
    return nextResponse;
  }

  return supabaseResponse;
}
