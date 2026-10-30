import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

async function currentUserId() {
  const store = await cookies()
  return readAccountSession(store.get(ACCOUNT_SESSION_COOKIE)?.value)
}

export async function PATCH(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })

  const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : ''
  const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 1200) : ''
  const agencyName = typeof body.agency_name === 'string' ? body.agency_name.trim().slice(0, 160) : ''
  const experience = Number(body.experience_years)
  const serviceAreas = Array.isArray(body.service_areas)
    ? body.service_areas.filter((v: unknown): v is string => typeof v === 'string').map((v: string) => v.trim()).filter(Boolean).slice(0, 20)
    : []

  if (!displayName || displayName.length > 160) return NextResponse.json({ error: 'F.I.O. ni to‘g‘ri kiriting.' }, { status: 400 })
  if (!Number.isInteger(experience) || experience < 0 || experience > 80) return NextResponse.json({ error: 'Tajriba yilini tekshiring.' }, { status: 400 })

  const db = serviceClient()
  const { data, error } = await db.from('realtor_profiles')
    .update({ display_name: displayName, bio: bio || null, agency_name: agencyName || null, experience_years: experience, service_areas: serviceAreas, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('id,display_name,bio,agency_name,experience_years,service_areas,avatar_url,phone,verification_status')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'REALTOR_PROFILE_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ realtor: data })
}

export async function POST(request: Request) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('avatar')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Rasm faylini tanlang.' }, { status: 400 })
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return NextResponse.json({ error: 'Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.' }, { status: 400 })
  if (file.size < 1 || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Rasm hajmi 5 MB dan oshmasligi kerak.' }, { status: 400 })

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `realtor-avatars/${userId}/profile.${extension}`
  const db = serviceClient()
  const { error: uploadError } = await db.storage.from('listing-images').upload(path, file, {
    contentType: file.type,
    upsert: true,
    cacheControl: '3600',
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  const { data: publicData } = db.storage.from('listing-images').getPublicUrl(path)
  const avatarUrl = publicData.publicUrl
  const { data, error } = await db.from('realtor_profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('id,avatar_url')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'REALTOR_PROFILE_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ avatar_url: avatarUrl })
}
