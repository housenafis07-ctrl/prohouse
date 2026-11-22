import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'mortgage-identity'
const MAX_BYTES = 5 * 1024 * 1024
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const FIELDS = ['front', 'back', 'selfie'] as const

async function hasValidImageSignature(file: File) {\n  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())\n  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff\n  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47\n  const webp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50\n  return (file.type === 'image/jpeg' && jpeg) || (file.type === 'image/png' && png) || (file.type === 'image/webp' && webp)\n}\n\nfunction cleanText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: NextRequest) {
  try {
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Kirish talab qilinadi. Avval shaxsiy kabinetga kiring.' }, { status: 401 })

    const form = await request.formData()
    const leadId = cleanText(form.get('leadId'))
    const pinfl = cleanText(form.get('pinfl')).replace(/\D/g, '')
    const dob = cleanText(form.get('dateOfBirth'))
    const passport = cleanText(form.get('passportSeriesNumber')).toUpperCase().replace(/\s+/g, '')
    const consent = cleanText(form.get('consent')) === 'true'
    if (!/^[0-9]{14}$/.test(pinfl)) return NextResponse.json({ error: 'JSHSHIR 14 ta raqamdan iborat bo‘lishi kerak.' }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob))) return NextResponse.json({ error: 'Tug‘ilgan sanani tekshiring.' }, { status: 400 })
    if (!/^[A-Z0-9]{6,12}$/.test(passport)) return NextResponse.json({ error: 'Pasport seriyasi va raqamini tekshiring.' }, { status: 400 })
    if (!consent) return NextResponse.json({ error: 'Shaxsga doir ma’lumotlarni qayta ishlashga rozilik berishingiz kerak.' }, { status: 400 })

    const files = Object.fromEntries(FIELDS.map(field => [field, form.get(field)])) as Record<typeof FIELDS[number], FormDataEntryValue | null>
    for (const field of FIELDS) {
      const file = files[field]
      if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Pasportning oldi, orqa tomoni va hujjat bilan selfi rasmini yuklang.' }, { status: 400 })
      if (file.size > MAX_BYTES || !TYPES.has(file.type) || !(await hasValidImageSignature(file))) return NextResponse.json({ error: 'Har bir rasm haqiqiy JPG, PNG yoki WebP formatida va 5 MB dan oshmasligi kerak.' }, { status: 400 })
    }

    const admin = serviceClient()
    const { data: lead, error: leadError } = await admin.from('mortgage_leads').select('id,profile_id').eq('id', leadId).maybeSingle()
    if (leadError) throw leadError
    if (!lead || lead.profile_id !== user.id) return NextResponse.json({ error: 'Ariza topilmadi yoki sizga tegishli emas.' }, { status: 404 })

    const uploaded: Partial<Record<typeof FIELDS[number], string>> = {}
    for (const field of FIELDS) {
      const file = files[field] as File
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${user.id}/${leadId}/${field}-${crypto.randomUUID()}.${ext}`
      const { error } = await admin.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw error
      uploaded[field] = path
    }

    const { error: updateError } = await admin.from('mortgage_leads').update({
      pinfl,
      date_of_birth: dob,
      passport_series_number: passport,
      identity_document_front_path: uploaded.front,
      identity_document_back_path: uploaded.back,
      identity_selfie_path: uploaded.selfie,
      identity_submitted_at: new Date().toISOString(),
      personal_data_consent_at: new Date().toISOString(),
      personal_data_consent_version: 'mortgage-identity-v1',
      updated_at: new Date().toISOString(),
    }).eq('id', leadId).eq('profile_id', user.id)
    if (updateError) {
      await Promise.all(Object.values(uploaded).filter(Boolean).map(path => admin.storage.from(BUCKET).remove([path as string])))
      throw updateError
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Mortgage identity upload]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Hujjatlarni yuborishda xatolik.' }, { status: 500 })
  }
}
