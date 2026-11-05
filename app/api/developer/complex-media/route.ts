import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

const DOCUMENT_BUCKET = 'developer-complex-documents'
const MEDIA_BUCKET = 'developer-construction-media'
const DOCUMENT_TYPES = ['land_rights','construction_permit','project_approval','expertise_conclusion','builder_license','commissioning_certificate','other']
const STAGES = ['foundation','structure','facade','interior','landscaping','completed','other']
const DOCUMENT_MIMES = ['application/pdf','image/jpeg','image/png','image/webp']
const MEDIA_MIMES = ['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']

async function context() {
  const jar = await cookies()
  const userId = readAccountSession(jar.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) return { error: NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 }) }
  const db = serviceClient()
  const { data: account } = await db.from('profiles').select('id,account_type').eq('id', userId).maybeSingle()
  if (!account || account.account_type !== 'partner') return { error: NextResponse.json({ error: 'PARTNER_ACCOUNT_REQUIRED' }, { status: 403 }) }
  const { data: partner } = await db.from('partner_profiles').select('id').eq('user_id', userId).maybeSingle()
  if (!partner) return { error: NextResponse.json({ error: 'PARTNER_PROFILE_REQUIRED' }, { status: 403 }) }
  const { data: developer } = await db.from('developer_profiles').select('id,user_id,verification_status').eq('partner_profile_id', partner.id).maybeSingle()
  if (!developer || developer.verification_status !== 'verified' || (developer.user_id && developer.user_id !== userId)) {
    return { error: NextResponse.json({ error: 'DEVELOPER_ACCESS_DENIED' }, { status: 403 }) }
  }
  return { db, userId, developer }
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'upload'
}

export async function GET(request: Request) {
  const ctx = await context()
  if ('error' in ctx) return ctx.error
  const complexId = new URL(request.url).searchParams.get('complex_id')
  if (!complexId) return NextResponse.json({ error: 'COMPLEX_ID_REQUIRED' }, { status: 400 })
  const { data: complex } = await ctx.db.from('residential_complexes').select('id').eq('id', complexId).eq('developer_id', ctx.developer.id).maybeSingle()
  if (!complex) return NextResponse.json({ error: 'COMPLEX_NOT_FOUND' }, { status: 404 })
  const [{ data: documents, error: documentsError }, { data: updates, error: updatesError }] = await Promise.all([
    ctx.db.from('developer_complex_documents').select('id,document_type,title,document_number,issued_at,expires_at,mime_type,file_size_bytes,moderation_status,moderation_note,created_at').eq('complex_id', complexId).order('created_at', { ascending: false }),
    ctx.db.from('developer_construction_updates').select('id,building_id,media_type,public_url,caption,construction_stage,captured_at,created_at,is_visible,moderation_note').eq('complex_id', complexId).order('captured_at', { ascending: false }),
  ])
  if (documentsError || updatesError) return NextResponse.json({ error: 'COMPLEX_MEDIA_LOAD_FAILED' }, { status: 500 })
  return NextResponse.json({ documents: documents || [], updates: updates || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const ctx = await context()
  if ('error' in ctx) return ctx.error
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  const action = body.action === 'complete' ? 'complete' : 'init'
  const kind = body.kind === 'document' ? 'document' : body.kind === 'construction' ? 'construction' : null
  const complexId = typeof body.complex_id === 'string' ? body.complex_id : ''
  if (!kind || !complexId) return NextResponse.json({ error: 'INVALID_UPLOAD_REQUEST' }, { status: 400 })
  const { data: complex } = await ctx.db.from('residential_complexes').select('id').eq('id', complexId).eq('developer_id', ctx.developer.id).maybeSingle()
  if (!complex) return NextResponse.json({ error: 'COMPLEX_NOT_FOUND' }, { status: 404 })

  if (action === 'init') {
    const fileName = typeof body.file_name === 'string' ? body.file_name.trim() : ''
    const mimeType = typeof body.mime_type === 'string' ? body.mime_type.toLowerCase() : ''
    const size = Number(body.file_size_bytes)
    const allowed = kind === 'document' ? DOCUMENT_MIMES : MEDIA_MIMES
    const maxSize = kind === 'document' ? 20 * 1024 * 1024 : 500 * 1024 * 1024
    if (!fileName || !allowed.includes(mimeType) || !Number.isFinite(size) || size <= 0 || size > maxSize) {
      return NextResponse.json({ error: 'FILE_TYPE_OR_SIZE_INVALID' }, { status: 400 })
    }
    const bucket = kind === 'document' ? DOCUMENT_BUCKET : MEDIA_BUCKET
    const path = `${ctx.developer.id}/${complexId}/${crypto.randomUUID()}-${safeName(fileName)}`
    const { data, error } = await ctx.db.storage.from(bucket).createSignedUploadUrl(path, { upsert: false })
    if (error || !data?.token || !data?.signedUrl) return NextResponse.json({ error: 'SIGNED_UPLOAD_FAILED' }, { status: 502 })
    const publicUrl = kind === 'construction' ? ctx.db.storage.from(bucket).getPublicUrl(path).data.publicUrl : null
    return NextResponse.json({ path, token: data.token, signed_url: data.signedUrl, bucket, public_url: publicUrl })
  }

  const path = typeof body.path === 'string' ? body.path : ''
  const mimeType = typeof body.mime_type === 'string' ? body.mime_type.toLowerCase() : ''
  const size = Number(body.file_size_bytes)
  const bucket = kind === 'document' ? DOCUMENT_BUCKET : MEDIA_BUCKET
  if (!path.startsWith(`${ctx.developer.id}/${complexId}/`) || path.includes('..')) return NextResponse.json({ error: 'UPLOAD_PATH_INVALID' }, { status: 400 })
  const { data: listed, error: listError } = await ctx.db.storage.from(bucket).list(path.slice(0, path.lastIndexOf('/')), { search: path.split('/').pop(), limit: 5 })
  const uploaded = (listed || []).some(item => item.name === path.split('/').pop())
  if (listError || !uploaded) return NextResponse.json({ error: 'UPLOADED_FILE_NOT_FOUND' }, { status: 400 })

  if (kind === 'document') {
    const documentType = typeof body.document_type === 'string' ? body.document_type : ''
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!DOCUMENT_TYPES.includes(documentType) || !title || title.length > 180 || !DOCUMENT_MIMES.includes(mimeType) || !Number.isFinite(size) || size <= 0 || size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'DOCUMENT_METADATA_INVALID' }, { status: 400 })
    }
    const { data, error } = await ctx.db.from('developer_complex_documents').insert({
      complex_id: complexId, developer_id: ctx.developer.id, uploaded_by: ctx.userId,
      document_type: documentType, title, document_number: typeof body.document_number === 'string' ? body.document_number.slice(0,120) : null,
      issued_at: body.issued_at || null, expires_at: body.expires_at || null,
      storage_path: path, mime_type: mimeType, file_size_bytes: size, moderation_status: 'pending',
    }).select('id,title,document_type,moderation_status,created_at').single()
    if (error) return NextResponse.json({ error: 'DOCUMENT_REGISTER_FAILED' }, { status: 500 })
    return NextResponse.json({ document: data }, { status: 201 })
  }

  const mediaType = mimeType.startsWith('video/') ? 'video' : 'image'
  const stage = typeof body.construction_stage === 'string' ? body.construction_stage : ''
  const buildingId = typeof body.building_id === 'string' ? body.building_id : null
  if (buildingId) {
    const { data: building } = await ctx.db.from('residential_buildings').select('id').eq('id', buildingId).eq('complex_id', complexId).maybeSingle()
    if (!building) return NextResponse.json({ error: 'BUILDING_NOT_FOUND_FOR_COMPLEX' }, { status: 400 })
  }
  if (!STAGES.includes(stage) || !MEDIA_MIMES.includes(mimeType) || !Number.isFinite(size) || size <= 0 || size > 500 * 1024 * 1024) {
    return NextResponse.json({ error: 'CONSTRUCTION_METADATA_INVALID' }, { status: 400 })
  }
  const publicUrl = ctx.db.storage.from(bucket).getPublicUrl(path).data.publicUrl
  const { data, error } = await ctx.db.from('developer_construction_updates').insert({
    complex_id: complexId, developer_id: ctx.developer.id, uploaded_by: ctx.userId,
    building_id: buildingId,
    media_type: mediaType, storage_path: path, public_url: publicUrl,
    caption: typeof body.caption === 'string' ? body.caption.slice(0,1200) : null,
    construction_stage: stage, captured_at: body.captured_at || new Date().toISOString().slice(0,10),
  }).select('id,media_type,public_url,caption,construction_stage,captured_at,created_at,is_visible').single()
  if (error) return NextResponse.json({ error: 'CONSTRUCTION_UPDATE_REGISTER_FAILED' }, { status: 500 })
  return NextResponse.json({ update: data }, { status: 201 })
}
