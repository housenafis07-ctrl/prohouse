'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Project = { name:string; city:string; district:string; address:string; description:string; completion_year:string; cover_image_url:string }
type Content = { description:string; logo_url:string; website:string; phone:string; email:string; projects:Project[] }
type Draft = { id:string; company_name:string; contact_email:string|null; contact_phone:string|null; page_content:Content; status:string; developer_profile_id:string|null; handed_off_at:string|null; updated_at:string }
const blankProject = ():Project => ({name:'',city:'Toshkent shahri',district:'',address:'',description:'',completion_year:'',cover_image_url:''})
const blankContent = ():Content => ({description:'',logo_url:'',website:'',phone:'',email:'',projects:[]})

export default function DeveloperPageBuilder() {
  const [drafts,setDrafts]=useState<Draft[]>([])
  const [selectedId,setSelectedId]=useState('')
  const [company,setCompany]=useState('')
  const [email,setEmail]=useState('')
  const [phone,setPhone]=useState('')
  const [content,setContent]=useState<Content>(blankContent())
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [handoff,setHandoff]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const r=await fetch('/api/admin/developer-pages',{cache:'no-store'})
      const d=await r.json()
      if(!r.ok) throw new Error(d.error||'Ro‘yxatni yuklab bo‘lmadi')
      setDrafts(d.drafts||[])
    } catch(e) { setError(e instanceof Error?e.message:'Yuklashda xatolik') }
    finally { setLoading(false) }
  }
  useEffect(()=>{void load()},[])

  function reset() { setSelectedId('');setCompany('');setEmail('');setPhone('');setContent(blankContent());setMessage('');setError('') }
  function choose(d:Draft) { setSelectedId(d.id);setCompany(d.company_name);setEmail(d.contact_email||'');setPhone(d.contact_phone||'');setContent({...blankContent(),...(d.page_content||{}),projects:(d.page_content?.projects||[]).map(p=>({...blankProject(),...p,completion_year:p.completion_year?String(p.completion_year):''}))});setMessage('');setError('') }
  function updateProject(index:number,key:keyof Project,value:string) { setContent(v=>({...v,projects:v.projects.map((p,i)=>i===index?{...p,[key]:value}:p)})) }

  async function save(status:'draft'|'ready'='draft') {
    setSaving(true);setMessage('');setError('')
    try {
      const payload={company_name:company,contact_email:email,contact_phone:phone,page_content:{...content,projects:content.projects.map(p=>({...p,completion_year:p.completion_year?Number(p.completion_year):null}))},status}
      const r=await fetch('/api/admin/developer-pages',{method:selectedId?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(selectedId?{...payload,id:selectedId}:{...payload})})
      const d=await r.json()
      if(!r.ok) throw new Error(d.error||'Saqlash amalga oshmadi')
      setSelectedId(d.draft.id);setMessage(status==='ready'?'Sahifa topshirishga tayyor deb belgilandi.':'Qoralama saqlandi.')
      await load()
    } catch(e) { setError(e instanceof Error?e.message:'Saqlashda xatolik') }
    finally { setSaving(false) }
  }

  async function sendHandoff() {
    if(!selectedId){setError('Avval sahifani saqlang.');return}
    if(!window.confirm('Tayyor sahifa ko‘rsatilgan mavjud developer akkauntiga biriktiriladi. Davom etasizmi?')) return
    setHandoff(true);setError('');setMessage('')
    try {
      const r=await fetch('/api/admin/developer-pages/'+selectedId+'/handoff',{method:'POST'})
      const d=await r.json()
      if(!r.ok) throw new Error(d.error||'Topshirish amalga oshmadi')
      setMessage('Sahifa developerga topshirildi. '+(d.recipient?.email||d.recipient?.phone||'')+' · '+d.projects_created+' ta loyiha yaratildi.')
      await load()
    } catch(e) { setError(e instanceof Error?e.message:'Topshirishda xatolik') }
    finally { setHandoff(false) }
  }

  const handedOff=drafts.find(d=>d.id===selectedId)?.status==='handed_off'
  const progress=useMemo(()=>{let n=0;if(company.trim().length>1)n++;if(content.description.trim())n++;if(content.logo_url.trim())n++;if(content.phone.trim()||phone.trim())n++;if(content.projects.length>0&&content.projects.every(p=>p.name.trim()&&p.city.trim()))n++;return Math.round(n/5*100)},[company,content,phone])

  return <main className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-7xl">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/admin" className="font-bold text-emerald-700">← Admin panel</Link><button onClick={()=>void load()} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Yangilash</button></div>
    <header className="mt-5 rounded-3xl bg-slate-950 p-7 text-white"><p className="text-xs font-black tracking-widest text-emerald-300">ROYALHOUSE · DEVELOPER STUDIO</p><h1 className="mt-2 text-3xl font-black">Developer sahifasini tayyorlash</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Kompaniya profilini, loyihalarini va aloqa ma’lumotlarini admin nomidan tayyorlang. Tayyor bo‘lgach mavjud developer akkauntiga topshiring.</p></header>
    <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-4"><section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"><div className="flex items-center justify-between"><h2 className="font-black">Sahifalar</h2><button onClick={reset} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">+ Yangi</button></div>
        {loading?<p className="mt-4 text-sm text-slate-500">Yuklanmoqda...</p>:drafts.length===0?<p className="mt-4 text-sm text-slate-500">Hozircha sahifalar yo‘q.</p>:<div className="mt-4 space-y-2">{drafts.map(d=><button key={d.id} onClick={()=>choose(d)} className={'w-full rounded-xl border p-3 text-left '+(selectedId===d.id?'border-emerald-500 bg-emerald-50':'border-slate-200 hover:bg-slate-50')}><span className="block font-bold">{d.company_name}</span><span className="mt-1 block text-xs text-slate-500">{d.status==='handed_off'?'Developerga topshirilgan':d.status==='ready'?'Topshirishga tayyor':'Qoralama'}</span></button>)}</div>}
      </section><section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"><div className="flex justify-between text-sm"><b>Tayyorlik</b><b>{progress}%</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:progress+'%'}}/></div><p className="mt-3 text-xs leading-5 text-slate-500">Topshirishdan oldin kompaniya nomi, tavsifi, aloqa ma’lumoti va loyihalarni tekshiring.</p></section></aside>
      <div className="space-y-5">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">1. Kompaniya sahifasi</h2><p className="mt-1 text-sm text-slate-500">Developer akkauntini topish uchun email yoki telefon kiriting.</p></div>{handedOff&&<span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">Topshirilgan</span>}</div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="mb-1 block text-sm font-bold">Kompaniya nomi *</span><input disabled={handedOff} value={company} onChange={e=>setCompany(e.target.value)} className="w-full rounded-xl border px-4 py-3"/></label>
          <label className="block"><span className="mb-1 block text-sm font-bold">Developer akkaunt emaili</span><input disabled={handedOff} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="developer@company.uz" className="w-full rounded-xl border px-4 py-3"/></label>
          <label className="block"><span className="mb-1 block text-sm font-bold">Developer akkaunt telefoni</span><input disabled={handedOff} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+998..." className="w-full rounded-xl border px-4 py-3"/></label>
          <label className="block"><span className="mb-1 block text-sm font-bold">Logotip URL</span><input disabled={handedOff} value={content.logo_url} onChange={e=>setContent(v=>({...v,logo_url:e.target.value}))} placeholder="https://..." className="w-full rounded-xl border px-4 py-3"/></label>
          <label className="block"><span className="mb-1 block text-sm font-bold">Veb-sayt</span><input disabled={handedOff} value={content.website} onChange={e=>setContent(v=>({...v,website:e.target.value}))} placeholder="https://..." className="w-full rounded-xl border px-4 py-3"/></label>
          <label className="block"><span className="mb-1 block text-sm font-bold">Aloqa telefoni</span><input disabled={handedOff} value={content.phone} onChange={e=>setContent(v=>({...v,phone:e.target.value}))} className="w-full rounded-xl border px-4 py-3"/></label>
          <label className="block"><span className="mb-1 block text-sm font-bold">Ommaviy email</span><input disabled={handedOff} type="email" value={content.email} onChange={e=>setContent(v=>({...v,email:e.target.value}))} className="w-full rounded-xl border px-4 py-3"/></label>
          <label className="block sm:col-span-2"><span className="mb-1 block text-sm font-bold">Kompaniya haqida</span><textarea disabled={handedOff} rows={4} value={content.description} onChange={e=>setContent(v=>({...v,description:e.target.value}))} className="w-full rounded-xl border p-4"/></label></div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">2. Turar-joy loyihalari</h2><p className="mt-1 text-sm text-slate-500">Topshirish vaqtida loyihalar developer kabinetiga qoralama sifatida yaratiladi.</p></div><button disabled={handedOff} onClick={()=>setContent(v=>({...v,projects:[...v.projects,blankProject()]}))} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">+ Loyiha qo‘shish</button></div>
          <div className="mt-5 space-y-4">{content.projects.length===0?<p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Hali loyiha qo‘shilmagan.</p>:content.projects.map((p,i)=><article key={i} className="rounded-2xl border border-slate-200 p-4"><div className="mb-3 flex items-center justify-between"><b>Loyiha {i+1}</b><button disabled={handedOff} onClick={()=>setContent(v=>({...v,projects:v.projects.filter((_,n)=>n!==i)}))} className="text-xs font-bold text-red-600 disabled:opacity-50">O‘chirish</button></div><div className="grid gap-3 sm:grid-cols-2">{([['name','Loyiha nomi *'],['city','Shahar *'],['district','Tuman'],['address','Manzil'],['completion_year','Topshirish yili'],['cover_image_url','Muqova rasmi URL']] as [keyof Project,string][]).map(([key,label])=><label key={key}><span className="mb-1 block text-xs font-bold text-slate-600">{label}</span><input disabled={handedOff} type={key==='completion_year'?'number':'text'} value={p[key]} onChange={e=>updateProject(i,key,e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm"/></label>)}<label className="sm:col-span-2"><span className="mb-1 block text-xs font-bold text-slate-600">Loyiha tavsifi</span><textarea disabled={handedOff} rows={3} value={p.description} onChange={e=>updateProject(i,'description',e.target.value)} className="w-full rounded-lg border p-3 text-sm"/></label></div></article>)}</div>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h2 className="text-xl font-black">3. Sahifa ko‘rinishi</h2><div className="mt-4 overflow-hidden rounded-2xl border bg-slate-50"><div className="bg-slate-950 p-6 text-white"><div className="flex items-center gap-4">{content.logo_url?<img src={content.logo_url} alt="" className="h-16 w-16 rounded-xl bg-white object-contain"/>:<div className="flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-600 text-2xl font-black">{company.slice(0,1)||'D'}</div>}<div><h3 className="text-2xl font-black">{company||'Kompaniya nomi'}</h3><p className="mt-1 text-sm text-emerald-300">RoyalHouse developer hamkori</p></div></div></div><div className="p-5"><p className="text-sm leading-6 text-slate-600">{content.description||'Kompaniya haqida ma’lumot shu yerda ko‘rinadi.'}</p><h4 className="mt-5 font-black">Turar-joy loyihalari</h4><div className="mt-3 grid gap-3 sm:grid-cols-2">{content.projects.map((p,i)=><div key={i} className="overflow-hidden rounded-xl border bg-white">{p.cover_image_url&&<img src={p.cover_image_url} alt="" className="h-32 w-full object-cover"/>}<div className="p-3"><b>{p.name||'Loyiha nomi'}</b><p className="mt-1 text-xs text-slate-500">{p.city}{p.district?', '+p.district:''}</p></div></div>)}</div></div></div></section>
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{message&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}
        {!handedOff&&<div className="flex flex-wrap gap-3"><button disabled={saving} onClick={()=>void save('draft')} className="rounded-xl border bg-white px-5 py-3 font-bold disabled:opacity-50">{saving?'Saqlanmoqda...':'Qoralama saqlash'}</button><button disabled={saving} onClick={()=>void save('ready')} className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50">Topshirishga tayyor</button><button disabled={!selectedId||handoff||saving} onClick={()=>void sendHandoff()} className="rounded-xl bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-40">{handoff?'Topshirilmoqda...':'Developerga topshirish →'}</button></div>}
        {handedOff&&<a href={'/developers/'+drafts.find(d=>d.id===selectedId)?.developer_profile_id} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-emerald-600 px-5 py-3 font-black text-white">Ommaviy sahifani ko‘rish →</a>}
      </div>
    </div>
  </div></main>
}
