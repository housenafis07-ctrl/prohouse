import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return NextResponse.json({ error }, { status: error === 'Forbidden' ? 403 : 401 })
  const status = request.nextUrl.searchParams.get('status') || 'all'
  const q = request.nextUrl.searchParams.get('q')?.trim() || ''
  const db = serviceClient()
  let query = db.from('realtor_profiles').select('id,user_id,display_name,phone,certificate_number,experience_years,agency_name,service_areas,verification_status,created_at,bio').order('created_at',{ascending:false}).limit(200)
  if (q.length >= 2) { const p='%'+q.replace(/[%_]/g,'\\$&')+'%'; query=query.or('display_name.ilike.'+p+',phone.ilike.'+p+',agency_name.ilike.'+p+',certificate_number.ilike.'+p) }
  const {data,error:queryError}=await query
  if(queryError)return NextResponse.json({error:queryError.message},{status:500})
  const ids=[...new Set((data||[]).map(x=>x.user_id))]
  const [{data:profiles,error:profileError},{data:grants,error:grantError}]=await Promise.all([
    ids.length?db.from('profiles').select('id,full_name,phone,account_type').in('id',ids):Promise.resolve({data:[],error:null}),
    ids.length?db.from('realtor_admin_benefit_grants').select('id,user_id,benefit_tier,listing_limit,starts_at,ends_at,note,revoked_at').in('user_id',ids).is('revoked_at',null).gt('ends_at',new Date().toISOString()).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null})
  ])
  if(profileError)return NextResponse.json({error:profileError.message},{status:500})
  if(grantError)return NextResponse.json({error:grantError.message},{status:500})
  const pm=new Map((profiles||[]).map(x=>[x.id,x])),gm=new Map<string,any>()
  for(const grant of grants||[])if(!gm.has(grant.user_id))gm.set(grant.user_id,grant)
  const allRealtors=(data||[]).map(x=>({...x,profile:pm.get(x.user_id)||null,activeGrant:gm.get(x.user_id)||null}))
  const counts={all:allRealtors.length,pending:allRealtors.filter(x=>x.verification_status==='pending').length,verified:allRealtors.filter(x=>x.verification_status==='verified').length,rejected:allRealtors.filter(x=>x.verification_status==='rejected').length}
  const realtors=status==='all'?allRealtors:allRealtors.filter(x=>x.verification_status===status)
  return NextResponse.json({realtors,counts},{headers:{'Cache-Control':'no-store'}})
}
export async function PATCH(request:NextRequest){
 const {admin,error}=await requireAdmin()
 if(error||!admin)return NextResponse.json({error:error||'Unauthorized'},{status:error==='Forbidden'?403:401})
 const body=await request.json().catch(()=>null),id=typeof body?.id==='string'?body.id:'',status=typeof body?.status==='string'?body.status:''
 if(!id||!['pending','verified','rejected'].includes(status))return NextResponse.json({error:'Rieltor ID va moderatsiya holatini tekshiring.'},{status:400})
 const {data,error:updateError}=await serviceClient().from('realtor_profiles').update({verification_status:status}).eq('id',id).select('id,user_id,verification_status').single()
 if(updateError)return NextResponse.json({error:updateError.message},{status:500})
 return NextResponse.json({ok:true,realtor:data,message:status==='verified'?'Rieltor tasdiqlandi.':status==='rejected'?'Ariza rad etildi.':'Ariza qayta ko‘rib chiqishga qaytarildi.'})
}