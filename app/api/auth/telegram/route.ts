import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Telegram is not an authentication or registration method for RoyalHouse.
 * Users must authenticate with their RoyalHouse phone number via SMS OTP.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: 'TELEGRAM_AUTH_DISABLED',
      message: 'RoyalHouse akkauntiga Telegram orqali kirish o‘chirildi. Kabinetga kirish uchun telefon raqamingizni SMS OTP orqali tasdiqlang.',
    },
    { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
  )
}
