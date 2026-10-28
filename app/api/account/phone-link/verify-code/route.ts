import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Telegram-only profiles are no longer supported.
 * Phone verification must start from /account/login and create/enter a
 * phone-authenticated RoyalHouse account directly.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'TELEGRAM_PROFILE_DISABLED',
      message: 'Telegram orqali ochilgan profilni telefon raqamiga aylantirish o‘chirildi. RoyalHouse kabinetiga kirish faqat telefon raqami va SMS OTP orqali amalga oshiriladi.',
    },
    { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
  )
}
