import { NextRequest,NextResponse } from 'next/server'
import { requireAdmin,serviceClient } from '@/utils/admin/auth'
export async function GET(){
 const {admin,error}=await requireAdmin('developer_construction_media.manage')
 if(error||!admin)return NextResponse.json({error:error||'Unauthorized'},{status:error==='Forbidden'?403:401})
 const db=serviceClient()
 const {data,error:queryError}=await db.from('developer_construction_updates').select('id,complex_id,developer_id,media_type,public_url,caption,construction_stage,captured_at,created_at,is_visible,moderation_note').order('created_at',{ascending:false}).limit(200)
 if(queryError)return NextResponse.json({error:'CONSTRUCTION_UPDATES_LOAD_FAILED'},{status:500})
 const ids=[...new Set((data||[]).map(x=>x.complex_id))]
 const {data:complexes}=ids.length?await db.from('residential_complexes').select('id,name,city').in('id',ids):{data:[]}
 const map=new Map((complexes||[]).map(x=>[x.id,x]))
 return NextResponse.json({updates:(data||[]).map(x=>({...x,complex:map.get(x.complex_id)||null}))},{headers:{'Cache-Control':'no-store'}})
}
export async function PATCH(request:NextRequest){
 const {admin,error}=await requireAdmin('developer_construction_media.manage')
 if(error||!admin)return NextResponse.json({error:error||'Unauthorized'},{status:error==='Forbidden'?403:401})
 const body=await request.json().catch(()=>null)
 const id=typeof body?.updateId==='string'?body.updateId:''
 const visible=body?.isVisible
 const note=typeof body?.note==='string'?body.note.trim():''
 if(!id||typeof visible!=='boolean')return NextResponse.json({error:'INVALID_UPDATE_REVIEW'},{status:400})
 if(!visible&&!note)return NextResponse.json({error:'HIDE_REASON_REQUIRED'},{status:400})
 const db=serviceClient(),now=new Date().toISOString()
 const {data,error:updateError}=await db.from('developer_construction_updates').update({is_visible:visible,hidden_at:visible?null:now,hidden_by:visible?null:admin.user.id,moderation_note:visible?null:note}).eq('id',id).select('id,is_visible,moderation_note,hidden_at').maybeSingle()
 if(updateError)return NextResponse.json({error:'CONSTRUCTION_UPDATE_REVIEW_FAILED'},{status:500})
 if(!data)return NextResponse.json({error:'UPDATE_NOT_FOUND'},{status:404})
 return NextResponse.json({update:data})
}