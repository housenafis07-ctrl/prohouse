import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

const FEATURES: Record<string, Record<string, boolean>> = {
  FREE: { crm: false, analytics: true, priority_search: false, team: false, lead_distribution: false, top_up_credits: false },
  PRO: { crm: true, analytics: true, priority_search: true, team: false, lead_distribution: false, top_up_credits: true },
  BUSINESS: { crm: true, analytics: true, priority_search: true, team: true, lead_distribution: true, top_up_credits: false },
  CUSTOM: {},
}

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Forbidden' ? 403 : 401 })
  const q = request.nextUrl.searchParams.get('q')?.trim() || ''
  if (q.length < 2) return NextResponse.json({ realtors: [] })
  const db = serviceClient()
  const pattern = `%${q.replace(/[%_]/g, '\\$&')}%`
  const { data: profiles, error: searchError } = await db.from('realtor_profiles')
    .select('id,user_id,display_name,phone,agency_name,verification_status,experience_years')
    .eq('verification_status','verified')
    .or(`display_name.ilike.${pattern},phone.ilike.${pattern},agency_name.ilike.${pattern}`)
    .limit(25)
  if (searchError) return NextResponse.json({ error: searchError.message }, { status: 500 })
  const userIds = (profiles || []).map(x => x.user_id)
  const [{ data: baseProfiles }, { data: counts }, { data: grants }] = await Promise.all([
    userIds.length ? db.from('profiles').select('id,full_name,phone').in('id',userIds) : Promise.resolve({data:[],error:null}),
    userIds.length ? db.from('listings').select('owner_id,status').in('owner_id',userIds).in('status',['active','moderation','reserved']) : Promise.resolve({data:[],error:null}),
    userIds.length ? db.from('realtor_admin_benefit_grants').select('id,user_id,benefit_tier,listing_limit,features,starts_at,ends_at,note,created_at').in('user_id',userIds).is('revoked_at',null).gt('ends_at',new Date().toISOString()).order('created_at',{ascending:false}) : Promise.resolve({data:[],error:null}),
  ])
  const profileMap = new Map((baseProfiles || []).map(x => [x.id,x]))
  const listingMap = new Map<string,number>()
  for (const row of counts || []) listingMap.set(row.owner_id,(listingMap.get(row.owner_id)||0)+1)
  const grantMap = new Map<string,any>()
  for (const grant of grants || []) if (!grantMap.has(grant.user_id)) grantMap.set(grant.user_id,grant)
  return NextResponse.json({ realtors: (profiles || []).map(r => ({ ...r, profile: profileMap.get(r.user_id) || null, activeListings: listingMap.get(r.user_id)||0, activeGrant: grantMap.get(r.user_id)||null })) })
}

export async function POST(request: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error: error || 'Unauthorized' }, { status: error === 'Forbidden' ? 403 : 401 })
  const body = await request.json().catch(() => null)
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  const tier = typeof body?.tier === 'string' ? body.tier.toUpperCase() : ''
  const listingLimit = Number(body?.listingLimit)
  const startsAt = body?.startsAt ? new Date(body.startsAt) : new Date()
  const endsAt = body?.endsAt ? new Date(body.endsAt) : null
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0,500) : ''
  if (!userId || !['FREE','PRO','BUSINESS','CUSTOM'].includes(tier)) return NextResponse.json({ error: 'Rieltor va imtiyoz turini tanlang.' }, { status:400 })
  if (!Number.isInteger(listingLimit) || listingLimit<1 || listingLimit>5000) return NextResponse.json({ error: 'Faol e’lon limiti 1 dan 5000 gacha bo‘lishi kerak.' }, { status:400 })
  if (!endsAt || Number.isNaN(endsAt.getTime()) || endsAt<=startsAt) return NextResponse.json({ error: 'Imtiyoz tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak.' }, { status:400 })
  const db = serviceClient()
  const { data: realtor, error: realtorError } = await db.from('realtor_profiles').select('user_id,verification_status').eq('user_id',userId).maybeSingle()
  if (realtorError) return NextResponse.json({ error:realtorError.message },{status:500})
  if (!realtor || realtor.verification_status!=='verified') return NextResponse.json({ error:'Faqat tasdiqlangan rieltorga imtiyoz berish mumkin.' },{status:400})
  const { data, error: insertError } = await db.from('realtor_admin_benefit_grants').insert({
    user_id:userId,benefit_tier:tier,listing_limit:listingLimit,features:FEATURES[tier] || {},
    starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString(),note:note||null,granted_by:admin.user.id,
  }).select('id,benefit_tier,listing_limit,starts_at,ends_at').single()
  if (insertError) return NextResponse.json({ error:insertError.message },{status:500})
  return NextResponse.json({ ok:true,grant:data,message:'Rieltor uchun imtiyoz saqlandi.' })
}

export async function DELETE(request: NextRequest) {
  const { admin, error } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error:error||'Unauthorized' },{status:error==='Forbidden'?403:401})
  const id=request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({error:'Grant ID kerak.'},{status:400})
  const db=serviceClient()
  const { error: revokeError }=await db.from('realtor_admin_benefit_grants').update({revoked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id).is('revoked_at',null)
  if(revokeError)return NextResponse.json({error:revokeError.message},{status:500})
  return NextResponse.json({ok:true,message:'Imtiyoz bekor qilindi.'})
}
