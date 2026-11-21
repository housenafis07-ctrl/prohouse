import { NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params
 const db=serviceClient()
 const {data:complex,error:complexError}=await db.from('residential_complexes').select('id').eq('slug',slug).eq('is_verified',true).maybeSingle()
 if(complexError||!complex)return NextResponse.json({error:'COMPLEX_NOT_FOUND'},{status:404})
 const {data,error}=await db.from('developer_construction_updates').select('id,media_type,storage_path,caption,construction_stage,captured_at,created_at').eq('complex_id',complex.id).eq('is_visible',true).order('captured_at',{ascending:false}).order('created_at',{ascending:false}).limit(100)
 if(error)return NextResponse.json({error:'CONSTRUCTION_UPDATES_LOAD_FAILED'},{status:500})
 const rows=data||[]
 const paths=rows.map(item=>item.storage_path).filter((path):path is string=>typeof path==='string'&&path.length>0)
 const {data:signed,error:signedError}=paths.length?await db.storage.from('developer-construction-media').createSignedUrls(paths,300):{data:[],error:null}
 if(signedError)return NextResponse.json({error:'CONSTRUCTION_MEDIA_SIGNING_FAILED'},{status:502})
 const signedByPath=new Map((signed||[]).map(item=>[item.path,item.signedUrl]))
 const updates=rows.map(({storage_path,...item})=>({...item,public_url:signedByPath.get(storage_path)||''})).filter(item=>item.public_url)
 return NextResponse.json({updates},{headers:{'Cache-Control':'public, s-maxage=60, stale-while-revalidate=300'}})
}