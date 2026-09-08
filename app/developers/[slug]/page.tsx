import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

export default async function DeveloperPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params
 const db=createClient()
 const {data:developer}=await db.from('developer_profiles').select('*').eq('id',slug).maybeSingle()
 if(!developer)return <main className="p-10">Developer topilmadi.</main>
 const {data:complexes}=await db.from('residential_complexes').select('*').eq('developer_id',developer.id).order('is_featured',{ascending:false})
 return <main className="min-h-screen bg-[#f6f7f8] text-slate-900"><header className="border-b bg-white"><div className="mx-auto max-w-7xl px-4 py-5"><Link href="/developers" className="text-sm font-bold text-emerald-700">← Developerlar</Link></div></header><section className="mx-auto max-w-7xl px-4 py-10"><div className="rounded-3xl border bg-white p-7"><div className="flex items-center gap-5"><div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-2xl font-black">{developer.logo_url?<img src={developer.logo_url} alt="" className="h-full w-full object-cover"/>:'D'}</div><div><h1 className="text-3xl font-black">{developer.developer_name}</h1><p className="mt-1 text-sm font-bold text-emerald-600">✓ Tasdiqlangan developer</p></div></div><p className="mt-6 max-w-3xl text-slate-600">{developer.description||'Developer profili'}</p></div><h2 className="mt-10 text-2xl font-black">Turar-joy loyihalari</h2><div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{(complexes||[]).map(c=><Link key={c.id} href={`/new-buildings/${c.slug}`} className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-black">{c.name}</h3><p className="mt-2 text-sm text-slate-500">{c.city}{c.district?`, ${c.district}`:''}</p><p className="mt-4 text-xs font-bold text-slate-500">{c.status} · {c.completion_year||'muddat ko‘rsatilmagan'}</p></Link>)}</div></section></main>
}
