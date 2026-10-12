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

export async function POST(request: Request) {
  const auth = await createClient()
  const { data: { user }, error: authError } = await auth.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'AUTH_REQUIRED', message: 'Sessiya tugagan. Qayta tizimga kiring.' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'INVALID_FORM_DATA', message: 'Rasm ma’lumotlarini o‘qib bo‘lmadi.' }, { status: 400 })
  }

  const listingId = form.get('listingId')
  if (typeof listingId !== 'string' || !listingId.trim()) {
    return NextResponse.json({ error: 'LISTING_ID_REQUIRED' }, { status: 400 })
  }
  const files = form.getAll('images').filter((item): item is File => item instanceof File && item.size > 0)
  if (!files.length || files.length > MAX_FILES) {
    return NextResponse.json({ error: 'INVALID_IMAGE_COUNT', message: '1 tadan 10 tagacha rasm yuklang.' }, { status: 400 })
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
    .select('id,listing_code,status,listing_type,property_type,taxonomy_code')
    .eq('id', listingId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (listingError) {
    return NextResponse.json({ error: 'LISTING_LOOKUP_FAILED', message: listingError.message }, { status: 500 })
  }
  if (!listing) {
    return NextResponse.json({ error: 'LISTING_NOT_FOUND', message: 'E’lon qoralamasi topilmadi.' }, { status: 404 })
  }
  if (listing.listing_type !== 'service' && listing.property_type !== 'service') {
    return NextResponse.json({ error: 'NOT_A_SERVICE_LISTING' }, { status: 400 })
  }
  if (!['draft', 'rejected', 'moderation'].includes(listing.status || '')) {
    return NextResponse.json({ error: 'INVALID_LISTING_STATUS', message: 'Bu e’lonni yuborish mumkin emas.' }, { status: 409 })
  }

  const { data: existingImages, error: existingImagesError } = await db
    .from('listing_images')
    .select('id,storage_path')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true })
  if (existingImagesError) {
    return NextResponse.json({ error: 'IMAGE_LOOKUP_FAILED', message: existingImagesError.message }, { status: 500 })
  }
  if ((existingImages?.length || 0) + files.length > MAX_FILES) {
    return NextResponse.json({ error: 'INVALID_IMAGE_COUNT', message: 'E’londa jami 10 tagacha rasm bo‘lishi mumkin.' }, { status: 400 })
  }

  const uploadedPaths: string[] = []
  let imageRowsInserted = false
  try {
    const rows = []
    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      const path = `${user.id}/${listingId}/${crypto.randomUUID()}.${MIME_EXTENSIONS[file.type]}`
      const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      })
      if (uploadError) throw new Error(`Rasmni saqlashda xatolik: ${uploadError.message}`)
      uploadedPaths.push(path)
      rows.push({
        listing_id: listingId,
        image_url: '',
        storage_path: path,
        sort_order: (existingImages?.length || 0) + index,
        size_bytes: file.size,
        mime_type: file.type,
      })
    }

    const { error: insertError } = await db.from('listing_images').insert(rows)
    if (insertError) throw new Error(`Rasm ma’lumotini saqlashda xatolik: ${insertError.message}`)
    imageRowsInserted = true

    const { data: updated, error: updateError } = await db
      .from('listings')
      .update({ status: 'moderation', submitted_at: new Date().toISOString(), draft_step: 6 })
      .eq('id', listingId)
      .eq('owner_id', user.id)
      .select('id,listing_code,status')
      .single()
    if (updateError) throw new Error(`E’lonni moderatsiyaga yuborishda xatolik: ${updateError.message}`)

    return NextResponse.json({ success: true, listing: updated, images_added: rows.length })
  } catch (error) {
    if (imageRowsInserted && uploadedPaths.length) {
      await db.from('listing_images').delete().eq('listing_id', listingId).in('storage_path', uploadedPaths)
    }
    if (uploadedPaths.length) {
      await db.storage.from(BUCKET).remove(uploadedPaths)
    }
    const message = error instanceof Error ? error.message : 'E’lonni yuborishda noma’lum xatolik.'
    return NextResponse.json({ error: 'SERVICE_LISTING_SUBMIT_FAILED', message }, { status: 500 })
  }
}
