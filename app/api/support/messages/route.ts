import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

const clean = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = clean(body?.name, 120)
    const phone = clean(body?.phone, 40)
    const email = clean(body?.email, 160)
    const subject = clean(body?.subject, 160) || 'Umumiy murojaat'
    const message = clean(body?.message, 5000)

    if (!message) return NextResponse.json({ error: 'Xabar matni kiritilmagan.' }, { status: 400 })
    if (message.length < 3) return NextResponse.json({ error: 'Xabar juda qisqa.' }, { status: 400 })

    const admin = serviceClient()
    const { error } = await admin.from('support_messages').insert({
      name: name || null,
      phone: phone || null,
      email: email || null,
      subject,
      message,
      source: 'website',
    })

    if (error) {
      console.error('support message insert failed', error)
      return NextResponse.json({ error: 'Xabarni yuborishda xatolik yuz berdi.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('support message request failed', error)
    return NextResponse.json({ error: 'Noto‘g‘ri so‘rov.' }, { status: 400 })
  }
}
