import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

const PLAN_BUCKET = 'developer-apartment-plans'
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp']

async function getDeveloper() {
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
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'floor-plan'
}

export async function POST(request: Request) {
  const ctx = await getDeveloper()
  if ('error' in ctx) return ctx.error
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  const action = body.action === 'complete' ? 'complete' : body.action === 'init' ? 'init' : null
  const unitId = typeof body.unit_id === 'string' ? body.unit_id : ''
  if (!action || !unitId) return NextResponse.json({ error: 'INVALID_UPLOAD_REQUEST' }, { status: 400 })

  const { data: complexes, error: complexError } = await ctx.db.from('residential_complexes').select('id').eq('developer_id', ctx.developer.id)
  if (complexError) return NextResponse.json({ error: 'OWNERSHIP_CHECK_FAILED' }, { status: 500 })
  const complexIds = (complexes || []).map(item => item.id)
  if (!complexIds.length) return NextResponse.json({ error: 'UNIT_NOT_FOUND' }, { status: 404 })
  const { data: buildings, error: buildingError } = await ctx.db.from('residential_buildings').select('id').in('complex_id', complexIds)
  if (buildingError) return NextResponse.json({ error: 'OWNERSHIP_CHECK_FAILED' }, { status: 500 })
  const buildingIds = (buildings || []).map(item => item.id)
  if (!buildingIds.length) return NextResponse.json({ error: 'UNIT_NOT_FOUND' }, { status: 404 })
  const { data: unit } = await ctx.db.from('complex_units').select('id,building_id').eq('id', unitId).in('building_id', buildingIds).maybeSingle()
  if (!unit) return NextResponse.json({ error: 'UNIT_NOT_FOUND' }, { status: 404 })

  if (action === 'init') {
    const fileName = typeof body.file_name === 'string' ? body.file_name.trim() : ''
    const mimeType = typeof body.mime_type === 'string' ? body.mime_type.toLowerCase() : ''
    const size = Number(body.file_size_bytes)
    if (!fileName || !IMAGE_MIMES.includes(mimeType) || !Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'IMAGE_TYPE_OR_SIZE_INVALID' }, { status: 400 })
    }
    const path = `${ctx.developer.id}/apartment-plans/${unitId}/${crypto.randomUUID()}-${safeName(fileName)}`
    const { data, error } = await ctx.db.storage.from(PLAN_BUCKET).createSignedUploadUrl(path, { upsert: false })
    if (error || !data?.token) return NextResponse.json({ error: 'SIGNED_UPLOAD_FAILED' }, { status: 502 })
    return NextResponse.json({ bucket: PLAN_BUCKET, path, token: data.token })
  }

  const path = typeof body.path === 'string' ? body.path : ''
  if (!path.startsWith(`${ctx.developer.id}/apartment-plans/${unitId}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'UPLOAD_PATH_INVALID' }, { status: 400 })
  }
  const { data: listed, error: listError } = await ctx.db.storage.from(PLAN_BUCKET).list(path.slice(0, path.lastIndexOf('/')), { search: path.split('/').pop(), limit: 5 })
  if (listError || !(listed || []).some(item => item.name === path.split('/').pop())) {
    return NextResponse.json({ error: 'UPLOADED_FILE_NOT_FOUND' }, { status: 400 })
  }
  const publicUrl = ctx.db.storage.from(PLAN_BUCKET).getPublicUrl(path).data.publicUrl
  const { data: updated, error } = await ctx.db.from('complex_units').update({ plan_url: publicUrl })
    .eq('id', unitId).in('building_id', buildingIds)
    .select('id,plan_url').maybeSingle()
  if (error || !updated) return NextResponse.json({ error: 'PLAN_IMAGE_SAVE_FAILED' }, { status: 500 })
  return NextResponse.json({ plan_url: updated.plan_url })
}
