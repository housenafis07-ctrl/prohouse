import { NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { createClient } from '@/utils/supabase/server'

export async function proxy(request: NextRequest) {
  const response = await updateSession(request)
  const pathname = request.nextUrl.pathname

  // RoyalHouse cabinet authentication is phone/SMS only. An old Telegram-only
  // Supabase session must never be allowed to open the cabinet directly.
  if (pathname.startsWith('/account') && pathname !== '/account/login') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const isTelegramOnly = Boolean(
      user && (
        user.user_metadata?.auth_provider === 'telegram' ||
        !user.user_metadata?.phone
      ),
    )

    if (isTelegramOnly) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/account/login'
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
