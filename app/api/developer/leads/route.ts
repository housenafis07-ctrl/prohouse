import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

const allowedStatuses = ['new', 'contacted', 'qualified', 'viewing', 'reserved', 'won', 'lost']

async function getDeveloperContext() {
  const cookieStore = await cookies()
  const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) return { error: NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 }) }

  const db = serviceClient()
  const { data: account, error: accountError } = await db.from('profiles')
    .select('id,account_type').eq('id', userId).maybeSingle()
  if (accountError) return { error: NextResponse.json({ error: 'ACCOUNT_LOOKUP_FAILED' }, { status: 500 }) }
  if (!account || account.account_type !== 'partner') {
    return { error: NextResponse.json({ error: 'PARTNER_ACCOUNT_REQUIRED' }, { status: 403 }) }
  }
  const { data: partner, error: partnerError } = await db.from('partner_profiles')
    .select('id').eq('user_id', userId).maybeSingle()
  if (partnerError) return { error: NextResponse.json({ error: 'PARTNER_PROFILE_LOOKUP_FAILED' }, { status: 500 }) }
  if (!partner) return { error: NextResponse.json({ error: 'PARTNER_PROFILE_REQUIRED' }, { status: 403 }) }

  const { data: developer, error: developerError } = await db.from('developer_profiles')
    .select('id,user_id,developer_name,description,verification_status')
    .eq('partner_profile_id', partner.id).maybeSingle()
  if (developerError) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 }) }
  if (!developer) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_REQUIRED' }, { status: 403 }) }
  if (developer.user_id && developer.user_id !== userId) {
    return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_ACCESS_DENIED' }, { status: 403 }) }
  }
  if (!developer.user_id) {
    const { error } = await db.from('developer_profiles').update({ user_id: userId }).eq('id', developer.id)
    if (error) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_LINK_FAILED' }, { status: 500 }) }
  }
  return { db, developer }
}

export async function GET() {
  const context = await getDeveloperContext()
  if ('error' in context) return context.error
  const { data, error } = await context.db.from('developer_lead_requests')
    .select('id,name,phone,message,status,created_at,complex_id,unit_id')
    .eq('developer_id', context.developer.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'DEVELOPER_LEADS_LOAD_FAILED' }, { status: 500 })
  return NextResponse.json({ leads: data || [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: Request) {
  const context = await getDeveloperContext()
  if ('error' in context) return context.error
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  if (!id || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: 'INVALID_LEAD_UPDATE' }, { status: 400 })
  }
  const { data, error } = await context.db.from('developer_lead_requests')
    .update({ status })
    .eq('id', id)
    .eq('developer_id', context.developer.id)
    .select('id,status')
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'LEAD_UPDATE_FAILED' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'LEAD_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ lead: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request){
 const body=await request.json().catch(()=>null)
 if(!body?.developer_id || !body?.name || !body?.phone) return NextResponse.json({error:'developer_id, name va phone majburiy'},{status:400})
 const db=await createClient(); const {data:{user}}=await db.auth.getUser()
 const {data,error}=await db.from('developer_lead_requests').insert({developer_id:body.developer_id,complex_id:body.complex_id||null,unit_id:body.unit_id||null,user_id:user?.id||null,name:String(body.name).trim(),phone:String(body.phone).trim(),message:body.message?String(body.message).trim():null,source:body.source||'royalhouse'}).select('id,status,created_at').single()
 if(error) return NextResponse.json({error:error.message},{status:400})
 return NextResponse.json({lead:data},{status:201})
}
