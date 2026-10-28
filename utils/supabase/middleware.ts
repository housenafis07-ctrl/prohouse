import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function updateSession(request: NextRequest) {
  // OTP account bootstrap uses a signed server-side session. The first
  // /account document and its profile endpoint must not depend on a Supabase
  // Auth network request; that request was the source of the indefinite
  // "Yuklanmoqda..." state immediately after SMS verification.
  const pathname = request.nextUrl.pathname;
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

  // Next.js 16 uses proxy.ts. Refresh the Supabase SSR session on all other
  // matched requests so normal navigation keeps the existing auth behavior.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
