import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'
import { deliverPendingTelegramNotifications, queueTelegramNotification } from '@/utils/telegram/notifications'

const STATUSES = ['new','contacted','reviewing','approved','rejected','closed'] as const

type MortgageStatus = typeof STATUSES[number]

const statusText: Record<MortgageStatus, string> = {
  new: 'Ariza yuborildi',
  contacted: 'Siz bilan bog‘lanildi',
  reviewing: 'Ariza ko‘rib chiqilmoqda',
  approved: 'Ariza tasdiqlandi',
  rejected: 'Ariza rad etildi',
  closed: 'Ariza yopildi',
}

export async function GET() {
  const { error: authError } = await requireAdmin('listings.moderate')
  if (authError) return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })
  try {
    const admin=serviceClient()
    const {data,error}=await admin.from('mortgage_leads').select('*,listing:listings(title,price)').order('created_at',{ascending:false}).limit(200)
    if(error) throw error
    return NextResponse.json({leads:data||[]})
  } catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Leadlar yuklanmadi.'},{status:500})}
}

export async function PATCH(request:NextRequest){
 const { error: authError } = await requireAdmin('listings.moderate')
 if (authError) return NextResponse.json({ error: authError }, { status: authError === 'Unauthorized' ? 401 : 403 })
 try{
  const {id,status}=await request.json()
  if(!id||!STATUSES.includes(status as MortgageStatus)) return NextResponse.json({error:'Noto‘g‘ri status.'},{status:400})
  const admin=serviceClient()
  const { data: lead, error: leadError } = await admin.from('mortgage_leads').select('id,profile_id,status,customer_name,bank_name,program_name').eq('id',id).maybeSingle()
  if (leadError) throw leadError
  if (!lead) return NextResponse.json({ error: 'Ariza topilmadi.' }, { status: 404 })

  const nextStatus = status as MortgageStatus
  const {error}=await admin.from('mortgage_leads').update({status:nextStatus,updated_at:new Date().toISOString()}).eq('id',id)
  if(error) throw error

  if (lead.profile_id && lead.status !== nextStatus) {
    const body = `${lead.bank_name} · ${lead.program_name}: ${statusText[nextStatus]}.`
    const { error: notificationError } = await admin.from('notifications').insert({
      user_id: lead.profile_id,
      title: 'Ipoteka arizasi yangilandi',
      body,
      link: '/account/mortgage',
    })
    if (notificationError) console.error('[Mortgage notification] Web notification failed', notificationError)
    await queueTelegramNotification(admin, lead.profile_id, `mortgage_status_${nextStatus}`, `🏠 Royalhouse: ${body}`)
    await deliverPendingTelegramNotifications(admin, 10)
  }

  return NextResponse.json({ok:true})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Status yangilanmadi.'},{status:500})}
}
