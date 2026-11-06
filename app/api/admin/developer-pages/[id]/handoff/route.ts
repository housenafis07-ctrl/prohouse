import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

function slugify(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72) || 'developer-project'
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, error } = await requireAdmin('developer_pages.manage')
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })
  const { id } = await context.params
  const db = serviceClient()
  const { data: draft, error: draftError } = await db.from('admin_developer_page_drafts')
    .select('*').eq('id', id).maybeSingle()
  if (draftError) return NextResponse.json({ error: 'DRAFT_LOOKUP_FAILED' }, { status: 500 })
  if (!draft) return NextResponse.json({ error: 'DRAFT_NOT_FOUND' }, { status: 404 })
  if (draft.status === 'handed_off') return NextResponse.json({ error: 'DRAFT_ALREADY_HANDED_OFF' }, { status: 409 })

  const email = typeof draft.contact_email === 'string' ? draft.contact_email.trim().toLowerCase() : ''
  const phone = typeof draft.contact_phone === 'string' ? draft.contact_phone.replace(/\D/g, '') : ''
  if (!email && phone.length < 9) return NextResponse.json({ error: 'RECIPIENT_EMAIL_OR_PHONE_REQUIRED' }, { status: 400 })

  let account: any = null
  if (email) {
    const { data, error: accountError } = await db.from('profiles')
      .select('id,email,phone,account_type,company_name').ilike('email', email).maybeSingle()
    if (accountError) return NextResponse.json({ error: 'RECIPIENT_LOOKUP_FAILED' }, { status: 500 })
    account = data
  }
  if (!account && phone) {
    const { data, error: accountError } = await db.from('profiles')
      .select('id,email,phone,account_type,company_name').eq('phone', draft.contact_phone).maybeSingle()
    if (accountError) return NextResponse.json({ error: 'RECIPIENT_LOOKUP_FAILED' }, { status: 500 })
    account = data
  }
  if (!account) return NextResponse.json({ error: 'RECIPIENT_ACCOUNT_NOT_FOUND' }, { status: 404 })
  if (account.account_type !== 'partner') return NextResponse.json({ error: 'RECIPIENT_MUST_HAVE_PARTNER_ACCOUNT' }, { status: 409 })

  const { data: partner, error: partnerError } = await db.from('partner_profiles')
    .select('id,user_id,partner_type,company_name,display_name').eq('user_id', account.id).maybeSingle()
  if (partnerError) return NextResponse.json({ error: 'PARTNER_PROFILE_LOOKUP_FAILED' }, { status: 500 })
  if (!partner) return NextResponse.json({ error: 'RECIPIENT_PARTNER_PROFILE_REQUIRED' }, { status: 409 })

  const { data: existing, error: existingError } = await db.from('developer_profiles')
    .select('id,user_id,metadata').eq('partner_profile_id', partner.id).maybeSingle()
  if (existingError) return NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 })
  if (existing?.user_id && existing.user_id !== account.id) return NextResponse.json({ error: 'DEVELOPER_PROFILE_ALREADY_LINKED' }, { status: 409 })

  const content = draft.page_content && typeof draft.page_content === 'object' ? draft.page_content as Record<string, any> : {}
  const projects = Array.isArray(content.projects) ? content.projects : []
  const now = new Date().toISOString()
  const pageContent = {
    description: content.description || '',
    logo_url: content.logo_url || '',
    website: content.website || '',
    phone: content.phone || draft.contact_phone || '',
    email: content.email || draft.contact_email || '',
    projects,
    prepared_by_admin: true,
    prepared_at: now,
  }

  let developerId = existing?.id as string | undefined
  let createdDeveloper = false
  if (!developerId) {
    const { data: created, error: createError } = await db.from('developer_profiles').insert({
      partner_profile_id: partner.id, user_id: account.id, developer_name: draft.company_name,
      description: pageContent.description || null, logo_url: pageContent.logo_url || null,
      website: pageContent.website || null, phone: pageContent.phone || null,
      verification_status: 'verified', metadata: { admin_page_content: pageContent, admin_handoff: { handed_off_by: admin.user.id, handed_off_at: now } },
    }).select('id').single()
    if (createError) return NextResponse.json({ error: 'DEVELOPER_PROFILE_CREATE_FAILED' }, { status: 500 })
    developerId = created.id
    createdDeveloper = true
  }

  const createdComplexIds: string[] = []
  for (const project of projects) {
    const base = slugify(project.name)
    let slug = base
    let available = false
    for (let n = 0; n < 10; n++) {
      const candidate = n === 0 ? base : `${base}-${n + 1}`
      const { data: found, error: slugError } = await db.from('residential_complexes').select('id').eq('slug', candidate).maybeSingle()
      if (slugError) break
      if (!found) { slug = candidate; available = true; break }
    }
    if (!available) {
      if (createdComplexIds.length) await db.from('residential_complexes').delete().in('id', createdComplexIds)
      if (createdDeveloper && developerId) await db.from('developer_profiles').delete().eq('id', developerId)
      return NextResponse.json({ error: 'PROJECT_SLUG_UNAVAILABLE' }, { status: 409 })
    }
    const image = typeof project.cover_image_url === 'string' ? project.cover_image_url : ''
    const { data: complex, error: complexError } = await db.from('residential_complexes').insert({
      developer_id: developerId, name: project.name, slug, city: project.city,
      district: project.district || null, address: project.address || null,
      description: project.description || null, completion_year: project.completion_year || null,
      status: 'planning', moderation_status: 'draft', is_verified: false,
      images: image ? [{ url: image, alt: project.name }] : [],
      map_data: { type: 'FeatureCollection', features: [] }, amenities: [],
    }).select('id').single()
    if (complexError) {
      if (createdComplexIds.length) await db.from('residential_complexes').delete().in('id', createdComplexIds)
      if (createdDeveloper && developerId) await db.from('developer_profiles').delete().eq('id', developerId)
      return NextResponse.json({ error: 'PROJECT_TRANSFER_FAILED', detail: complexError.message }, { status: 500 })
    }
    createdComplexIds.push(complex.id)
  }

  if (existing && developerId) {
    const metadata = existing.metadata && typeof existing.metadata === 'object' ? existing.metadata as Record<string, any> : {}
    const { error: updateError } = await db.from('developer_profiles').update({
      user_id: account.id, developer_name: draft.company_name, description: pageContent.description || null,
      logo_url: pageContent.logo_url || null, website: pageContent.website || null,
      phone: pageContent.phone || null, verification_status: 'verified',
      metadata: { ...metadata, admin_page_content: pageContent, admin_handoff: { handed_off_by: admin.user.id, handed_off_at: now } },
      updated_at: now,
    }).eq('id', developerId)
    if (updateError) {
      if (createdComplexIds.length) await db.from('residential_complexes').delete().in('id', createdComplexIds)
      return NextResponse.json({ error: 'DEVELOPER_PROFILE_UPDATE_FAILED' }, { status: 500 })
    }
  }

  const { error: draftUpdateError } = await db.from('admin_developer_page_drafts').update({
    status: 'handed_off', developer_profile_id: developerId, handed_off_to: account.id,
    handed_off_by: admin.user.id, handed_off_at: now, updated_by: admin.user.id, updated_at: now,
  }).eq('id', id)
  if (draftUpdateError) return NextResponse.json({ error: 'HANDOFF_AUDIT_SAVE_FAILED', developer_profile_id: developerId }, { status: 500 })

  return NextResponse.json({
    ok: true, developer_profile_id: developerId, recipient: { id: account.id, email: account.email, phone: account.phone },
    projects_created: createdComplexIds.length, cabinet_url: '/account/developer',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
