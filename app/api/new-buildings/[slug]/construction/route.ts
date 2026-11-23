import { NextResponse } from 'next/server'
import { serviceClient } from '@/utils/admin/auth'
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params
 const db=serviceClient()
 const {data:complex,error:complexError}=await db.from('residential_complexes').select('id').eq('slug',slug).eq('is_verified',true).maybeSingle()
 if(complexError||!complex)return NextResponse.json({error:'COMPLEX_NOT_FOUND'},{status:404})
 const {data,error}=await db.from('developer_construction_updates').select('id,media_type,public_url,caption,construction_stage,captured_at,created_at').eq('complex_id',complex.id).eq('is_visible',true).order('captured_at',{ascending:false}).order('created_at',{ascending:false}).limit(100)
 if(error)return NextResponse.json({error:'CONSTRUCTION_UPDATES_LOAD_FAILED'},{status:500})
 return NextResponse.json({updates:data||[]},{headers:{'Cache-Control':'public, s-maxage=60, stale-while-revalidate=300'}})
}