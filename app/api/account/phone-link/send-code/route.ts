import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const origin = new URL(request.url).origin
  const response = await fetch(`${origin}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await request.json()),
    cache: 'no-store',
  })

  const data = await response.json().catch(() => ({ error: 'SMS yuborilmadi.' }))
  return NextResponse.json(data, { status: response.status })
}
