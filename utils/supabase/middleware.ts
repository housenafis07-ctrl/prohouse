import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // The OTP cabinet bootstrap is intentionally independent from a Supabase
  // Auth network round-trip. The old getClaims() call here could stall the
  // first /account request immediately after SMS verification.
  if (pathname === "/account" || pathname === "/api/account/profile") {
    return NextResponse.next({ request });
  }

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

  if (pathname === "/account/login" || pathname === "/register" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next({ request });
  }

  await supabase.auth.getClaims();
  return supabaseResponse;
}
