import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'

export async function GET() {
  try {
    const admin=serviceClient()
    const {data,error}=await admin.from('mortgage_leads').select('*,listing:listings(title,price)').order('created_at',{ascending:false}).limit(200)
    if(error) throw error
    return NextResponse.json({leads:data||[]})
  } catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Leadlar yuklanmadi.'},{status:500})}
}
export async function PATCH(request:NextRequest){
 try{
  const {id,status}=await request.json()
  if(!id||!['new','contacted','approved','rejected','closed'].includes(status)) return NextResponse.json({error:'Noto‘g‘ri status.'},{status:400})
  const admin=serviceClient();const {error}=await admin.from('mortgage_leads').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(error) throw error
  return NextResponse.json({ok:true})
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Status yangilanmadi.'},{status:500})}
}
