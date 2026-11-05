import { NextResponse } from 'next/server'
import { requireAdmin, serviceClient } from '@/utils/admin/auth'
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const {admin,error}=await requireAdmin()
 if(error||!admin)return NextResponse.json({error:error||'Unauthorized'},{status:error==='Forbidden'?403:401})
 const {id}=await params
 const db=serviceClient()
 const {data:doc,error:queryError}=await db.from('developer_complex_documents').select('storage_path,mime_type,title').eq('id',id).maybeSingle()
 if(queryError||!doc)return NextResponse.json({error:'DOCUMENT_NOT_FOUND'},{status:404})
 const {data,error:signError}=await db.storage.from('developer-complex-documents').createSignedUrl(doc.storage_path,300,{download:false})
 if(signError||!data?.signedUrl)return NextResponse.json({error:'DOCUMENT_PREVIEW_FAILED'},{status:502})
 return NextResponse.json({url:data.signedUrl,mime_type:doc.mime_type,title:doc.title},{headers:{'Cache-Control':'no-store'}})
}