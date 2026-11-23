import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const BUCKET = 'telegram-media'
const ALLOWED: Record<string, 'image' | 'video'> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image',
  'video/mp4': 'video', 'video/quicktime': 'video', 'video/webm': 'video',
}

export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin('listings.moderate')
  if (error) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })
  const body = await req.json().catch(() => ({}))
  const contentType = String(body.contentType || '')
  const fileName = String(body.fileName || 'media').trim()
  const mediaType = ALLOWED[contentType]
  if (!mediaType) return NextResponse.json({ error: 'Faqat JPG, PNG, WEBP, GIF yoki MP4/MOV/WEBM fayllari qabul qilinadi.' }, { status: 400 })
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'media'
  const path = `broadcast/${admin!.user.id}/${crypto.randomUUID()}-${safeName}`
  const supabase = serviceClient()
  const { data, error: uploadError } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
  if (uploadError || !data?.token) return NextResponse.json({ error: uploadError?.message || 'Media yuklash havolasini yaratib bo‘lmadi.' }, { status: 500 })
  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ path, token: data.token, url: publicData.publicUrl, mediaType, contentType })
}
