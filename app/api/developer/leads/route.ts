import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request){
 const body=await request.json().catch(()=>null)
 if(!body?.developer_id || !body?.name || !body?.phone) return NextResponse.json({error:'developer_id, name va phone majburiy'},{status:400})
 const db=await createClient(); const {data:{user}}=await db.auth.getUser()
 const {data,error}=await db.from('developer_lead_requests').insert({developer_id:body.developer_id,complex_id:body.complex_id||null,unit_id:body.unit_id||null,user_id:user?.id||null,name:String(body.name).trim(),phone:String(body.phone).trim(),message:body.message?String(body.message).trim():null,source:body.source||'prohouse'}).select('id,status,created_at').single()
 if(error) return NextResponse.json({error:error.message},{status:400})
 return NextResponse.json({lead:data},{status:201})
}
