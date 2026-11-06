import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'

export default async function DeveloperPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params
 const db=await createClient()
 const {data:developer}=await db.from('developer_profiles').select('*').eq('id',slug).maybeSingle()
 if(!developer)return <main className="p-10">Developer topilmadi.</main>
 const metadata=developer.metadata&&typeof developer.metadata==='object'?developer.metadata as Record<string,any>:{}
 const prepared=metadata.admin_page_content&&typeof metadata.admin_page_content==='object'?metadata.admin_page_content:{}
 const {data:complexes}=await db.from('residential_complexes').select('*').eq('developer_id',developer.id).eq('is_verified',true).order('is_featured',{ascending:false})
 const publishedComplexes=complexes||[]
 const logo=prepared.logo_url||developer.logo_url
 const description=prepared.description||developer.description
 const phone=prepared.phone||developer.phone
 const website=prepared.website||developer.website
 const email=prepared.email||''
 return <main className="min-h-screen bg-[#f5f7f8] text-slate-900">
  <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5"><Link href="/developers" className="text-sm font-bold text-emerald-700">← Developerlar</Link><span className="text-xs font-bold tracking-widest text-slate-400">ROYALHOUSE</span></div></header>
  <section className="mx-auto max-w-7xl px-4 py-9">
   <div className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl"><div className="grid gap-8 p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10"><div className="flex items-center gap-5">{logo?<img src={logo} alt="" className="h-20 w-20 rounded-2xl bg-white object-contain p-2"/>:<div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500 text-3xl font-black">{developer.developer_name.slice(0,1)}</div>}<div><p className="text-xs font-black tracking-widest text-emerald-300">TASDIQLANGAN HAMKOR</p><h1 className="mt-2 text-3xl font-black md:text-4xl">{developer.developer_name}</h1></div></div><div className="flex flex-wrap gap-2">{phone&&<a href={'tel:'+phone} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-white">Bog‘lanish</a>}{website&&<a href={website} target="_blank" rel="noreferrer" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-bold text-white">Veb-sayt ↗</a>}</div></div><div className="border-t border-white/10 px-7 py-6 text-sm leading-7 text-slate-300 md:px-10">{description||'Developer kompaniyasi haqida ma’lumot.'}</div></div>
   <div className="mt-8 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-400">LOYIHALAR</p><p className="mt-1 text-3xl font-black">{publishedComplexes.length}</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-400">ALOQA</p><p className="mt-2 font-bold">{phone||'Telefon kiritilmagan'}</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-400">ROYALHOUSE</p><p className="mt-2 font-bold text-emerald-700">Tasdiqlangan developer</p></div></div>
   <div className="mt-10 flex items-end justify-between gap-4"><div><p className="text-xs font-black tracking-widest text-emerald-600">PORTFOLIO</p><h2 className="mt-2 text-3xl font-black">Turar-joy loyihalari</h2></div><span className="text-sm text-slate-500">{projects.length+publishedComplexes.length} ta loyiha</span></div>
   <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
    {publishedComplexes.map((c:any)=><Link key={c.id} href={'/new-buildings/'+c.slug} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">{Array.isArray(c.images)&&c.images[0]?.url?<img src={c.images[0].url} alt={c.name} className="h-52 w-full object-cover"/>:<div className="flex h-52 items-center justify-center bg-slate-100 text-5xl">⌂</div>}<div className="p-5"><h3 className="text-xl font-black">{c.name}</h3><p className="mt-1 text-sm text-slate-500">{c.city}{c.district?', '+c.district:''}</p><p className="mt-4 text-xs font-bold text-emerald-700">Batafsil ko‘rish →</p></div></Link>)}
   </div>
   {(phone||email||website)&&<section className="mt-10 rounded-3xl bg-white p-7 shadow-sm"><h2 className="text-2xl font-black">Kompaniya bilan bog‘lanish</h2><div className="mt-4 flex flex-wrap gap-5 text-sm">{phone&&<a href={'tel:'+phone} className="font-bold text-emerald-700">{phone}</a>}{email&&<a href={'mailto:'+email} className="font-bold text-emerald-700">{email}</a>}{website&&<a href={website} target="_blank" rel="noreferrer" className="font-bold text-emerald-700">{website}</a>}</div></section>}
  </section>
 </main>
}
