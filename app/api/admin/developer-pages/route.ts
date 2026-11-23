import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const MAX_PROJECTS = 30
function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}
function validate(body: any) {
  const companyName = cleanText(body?.company_name, 160)
  const contactEmail = cleanText(body?.contact_email, 240).toLowerCase()
  const contactPhone = cleanText(body?.contact_phone, 40)
  const content = body?.page_content && typeof body.page_content === 'object' ? body.page_content : {}
  const description = cleanText(content.description, 4000)
  const logoUrl = cleanText(content.logo_url, 1000)
  const website = cleanText(content.website, 240)
  const phone = cleanText(content.phone, 40)
  const pageEmail = cleanText(content.email, 240).toLowerCase()
  const projectsInput = Array.isArray(content.projects) ? content.projects : []
  if (companyName.length < 2) return { error: 'COMPANY_NAME_REQUIRED' as const }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return { error: 'CONTACT_EMAIL_INVALID' as const }
  if (pageEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pageEmail)) return { error: 'PAGE_EMAIL_INVALID' as const }
  if (website && !/^https?:\/\//i.test(website)) return { error: 'WEBSITE_MUST_INCLUDE_PROTOCOL' as const }
  if (logoUrl && !/^https?:\/\//i.test(logoUrl)) return { error: 'LOGO_URL_INVALID' as const }
  if (projectsInput.length > MAX_PROJECTS) return { error: 'TOO_MANY_PROJECTS' as const }
  const projects = projectsInput.map((p: any) => ({
    name: cleanText(p?.name, 180),
    city: cleanText(p?.city, 120),
    district: cleanText(p?.district, 120),
    address: cleanText(p?.address, 500),
    description: cleanText(p?.description, 4000),
    completion_year: p?.completion_year === '' || p?.completion_year == null ? null : Number(p.completion_year),
    cover_image_url: cleanText(p?.cover_image_url, 1000),
  }))
  if (projects.some((p: any) => p.name.length < 2 || p.city.length < 2)) return { error: 'PROJECT_NAME_AND_CITY_REQUIRED' as const }
  if (projects.some((p: any) => p.completion_year !== null && (!Number.isInteger(p.completion_year) || p.completion_year < 2020 || p.completion_year > new Date().getFullYear() + 30))) return { error: 'PROJECT_YEAR_INVALID' as const }
  if (projects.some((p: any) => p.cover_image_url && !/^https?:\/\//i.test(p.cover_image_url))) return { error: 'PROJECT_IMAGE_URL_INVALID' as const }
  return { value: {
    company_name: companyName, contact_email: contactEmail || null, contact_phone: contactPhone || null,
    page_content: { description, logo_url: logoUrl, website, phone, email: pageEmail, projects },
  } }
}

export async function GET() {
  const { admin, error } = await requireAdmin('developer_pages.manage')
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })
  const db = serviceClient()
  const { data, error: queryError } = await db.from('admin_developer_page_drafts')
    .select('id,company_name,contact_email,contact_phone,page_content,status,developer_profile_id,handed_off_to,handed_off_at,created_at,updated_at')
    .order('updated_at', { ascending: false })
  if (queryError) return NextResponse.json({ error: 'DEVELOPER_PAGE_DRAFTS_LOAD_FAILED' }, { status: 500 })
  return NextResponse.json({ drafts: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const { admin, error } = await requireAdmin('developer_pages.manage')
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })
  const body = await request.json().catch(() => null)
  const parsed = validate(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const db = serviceClient()
  const { data, error: insertError } = await db.from('admin_developer_page_drafts')
    .insert({ ...parsed.value, status: body.status === 'ready' ? 'ready' : 'draft', created_by: admin.user.id, updated_by: admin.user.id })
    .select('id,company_name,contact_email,contact_phone,page_content,status,created_at,updated_at').single()
  if (insertError) return NextResponse.json({ error: 'DEVELOPER_PAGE_DRAFT_CREATE_FAILED' }, { status: 500 })
  return NextResponse.json({ draft: data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const { admin, error } = await requireAdmin('developer_pages.manage')
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })
  const body = await request.json().catch(() => null)
  const id = cleanText(body?.id, 64)
  if (!id) return NextResponse.json({ error: 'DRAFT_ID_REQUIRED' }, { status: 400 })
  const parsed = validate(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const db = serviceClient()
  const { data: existing, error: lookupError } = await db.from('admin_developer_page_drafts').select('id,status').eq('id', id).maybeSingle()
  if (lookupError) return NextResponse.json({ error: 'DRAFT_LOOKUP_FAILED' }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'DRAFT_NOT_FOUND' }, { status: 404 })
  if (existing.status === 'handed_off') return NextResponse.json({ error: 'DRAFT_ALREADY_HANDED_OFF' }, { status: 409 })
  const nextStatus = body.status === 'ready' ? 'ready' : 'draft'
  const { data, error: updateError } = await db.from('admin_developer_page_drafts').update({
    ...parsed.value, status: nextStatus, updated_by: admin.user.id, updated_at: new Date().toISOString(),
  }).eq('id', id).select('id,company_name,contact_email,contact_phone,page_content,status,updated_at').single()
  if (updateError) return NextResponse.json({ error: 'DEVELOPER_PAGE_DRAFT_UPDATE_FAILED' }, { status: 500 })
  return NextResponse.json({ draft: data })
}
