import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
  // Supabase session refresh/verification is handled once by updateSession.
  // Do not call auth.getUser() again here: that second Auth network request
  // was able to deadlock the OTP -> /account transition in the web browser
  // and Telegram Mini App.
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
