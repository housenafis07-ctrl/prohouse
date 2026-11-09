import { NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params
 const db=serviceClient()
 const {data:complex}=await db.from('residential_complexes').select('id').eq('slug',slug).eq('is_verified',true).maybeSingle()
 if(!complex)return NextResponse.json({error:'COMPLEX_NOT_FOUND'},{status:404})
 const {data,error}=await db.from('developer_complex_documents').select('id,title,document_type,document_number,issued_at,expires_at,storage_path,mime_type').eq('complex_id',complex.id).eq('moderation_status','approved').eq('visibility_scope','public').order('created_at',{ascending:false})
 if(error)return NextResponse.json({error:'DOCUMENTS_LOAD_FAILED'},{status:500})
 const documents=await Promise.all((data||[]).map(async doc=>{
  const {data:signed}=await db.storage.from('developer-complex-documents').createSignedUrl(doc.storage_path,300,{download:false})
  return {id:doc.id,title:doc.title,document_type:doc.document_type,document_number:doc.document_number,issued_at:doc.issued_at,expires_at:doc.expires_at,mime_type:doc.mime_type,url:signed?.signedUrl||null}
 }))
 return NextResponse.json({documents:documents.filter(x=>x.url)},{headers:{'Cache-Control':'no-store'}})
}