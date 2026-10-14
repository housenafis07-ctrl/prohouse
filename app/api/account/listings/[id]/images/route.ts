import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'listing-images'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES = 10
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED', message: 'Sessiya tugagan. Qayta kiring.' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'INVALID_FORM_DATA', message: 'Rasm ma’lumotlarini o‘qib bo‘lmadi.' }, { status: 400 })
  }

  const files = form.getAll('images').filter((item): item is File => item instanceof File && item.size > 0)
  if (!files.length || files.length > MAX_FILES) {
    return NextResponse.json({ error: 'INVALID_IMAGE_COUNT', message: '1 tadan 10 tagacha rasm yuborish mumkin.' }, { status: 400 })
  }

  for (const file of files) {
    if (!(file.type in MIME_EXTENSIONS)) {
      return NextResponse.json({ error: 'INVALID_IMAGE_TYPE', message: 'Faqat JPG, PNG, WebP yoki GIF formatidagi rasmlar qabul qilinadi.' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'IMAGE_TOO_LARGE', message: 'Har bir rasm 10 MB dan oshmasligi kerak.' }, { status: 400 })
    }
  }

  const db = serviceClient()
  const { data: listing, error: listingError } = await db
    .from('listings')
    .select('id,owner_id,status')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (listingError) return NextResponse.json({ error: 'LISTING_LOOKUP_FAILED', message: listingError.message }, { status: 500 })
  if (!listing) return NextResponse.json({ error: 'LISTING_NOT_FOUND', message: 'E’lon topilmadi.' }, { status: 404 })
  if (!['draft', 'rejected', 'moderation', 'active'].includes(listing.status)) {
    return NextResponse.json({ error: 'LISTING_IMAGE_EDIT_FORBIDDEN', message: 'Bu e’lon uchun rasm qo‘shish mumkin emas.' }, { status: 409 })
  }

  const { count, error: countError } = await db
    .from('listing_images')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', id)
  if (countError) return NextResponse.json({ error: 'IMAGE_COUNT_FAILED', message: countError.message }, { status: 500 })
  if ((count || 0) + files.length > MAX_FILES) {
    return NextResponse.json({ error: 'INVALID_IMAGE_COUNT', message: 'E’londa jami 10 tagacha rasm bo‘lishi mumkin.' }, { status: 400 })
  }

  const uploadedPaths: string[] = []
  const insertedIds: string[] = []

  try {
    const startOrder = count || 0
    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      const path = `${user.id}/${id}/${crypto.randomUUID()}.${MIME_EXTENSIONS[file.type]}`
      const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      })
      if (uploadError) throw new Error(`Rasmni saqlashda xatolik: ${uploadError.message}`)
      uploadedPaths.push(path)

      const { data: row, error: insertError } = await db
        .from('listing_images')
        .insert({ listing_id: id, image_url: '', storage_path: path, sort_order: startOrder + index, size_bytes: file.size, mime_type: file.type })
        .select('id,listing_id,image_url,sort_order,storage_path')
        .single()
      if (insertError || !row) throw new Error(insertError?.message || 'Rasm ma’lumotini saqlashda xatolik.')
      insertedIds.push(row.id)

      const { data: normalized, error: normalizeError } = await db
        .from('listing_images')
        .update({ image_url: `/api/listing-images/${row.id}` })
        .eq('id', row.id)
        .eq('listing_id', id)
        .select('id,listing_id,image_url,sort_order,storage_path')
        .single()
      if (normalizeError || !normalized) throw new Error(normalizeError?.message || 'Rasm havolasini saqlashda xatolik.')
    }

    await db.from('listings').update({ updated_at: new Date().toISOString() }).eq('id', id).eq('owner_id', user.id)

    const { data: images } = await db.from('listing_images').select('id,listing_id,image_url,sort_order,storage_path').eq('listing_id', id).order('sort_order', { ascending: true })
    return NextResponse.json({ success: true, images_added: insertedIds.length, images: images || [] })
  } catch (error) {
    if (insertedIds.length) await db.from('listing_images').delete().in('id', insertedIds).eq('listing_id', id)
    if (uploadedPaths.length) await db.storage.from(BUCKET).remove(uploadedPaths)
    return NextResponse.json({ error: 'LISTING_IMAGE_SAVE_FAILED', message: error instanceof Error ? error.message : 'Rasmni saqlashda xatolik yuz berdi.' }, { status: 500 })
  }
}
