import { NextResponse } from 'next/server'
import { ACCOUNT_SESSION_COOKIE } from '@/utils/auth/account-session'

export async function POST() {
  const response = NextResponse.json({ ok: true }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
  response.cookies.set(ACCOUNT_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  })
  return response
}
