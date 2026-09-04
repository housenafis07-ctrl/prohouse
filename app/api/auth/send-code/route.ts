import { NextResponse } from 'next/server'

export async function POST() {
  if (process.env.AUTH_TEST_MODE !== 'true') {
    return NextResponse.status(503).json({ error: 'SMS xizmati hali sozlanmagan.' })
  }

  return NextResponse.json({
    ok: true,
    testMode: true,
    message: 'Test rejimi: tasdiqlash kodi 321321.',
  })
}
