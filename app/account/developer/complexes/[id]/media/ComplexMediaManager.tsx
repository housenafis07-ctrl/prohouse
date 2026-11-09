'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Doc={id:string;document_type:string;title:string;document_number:string|null;issued_at:string|null;expires_at:string|null;mime_type:string;file_size_bytes:number;moderation_status:string;moderation_note:string|null;requested_visibility_scope:'public'|'admin_only';visibility_scope:'public'|'admin_only';created_at:string}
type Update={id:string;building_id:string|null;media_type:'image'|'video';public_url:string;caption:string|null;construction_stage:string;captured_at:string;created_at:string;is_visible:boolean;moderation_note:string|null}
const docTypes=[['land_rights','Yer uchastkasi hujjati'],['construction_permit','Qurilishga ruxsatnoma'],['project_approval','Tasdiqlangan loyiha hujjati'],['expertise_conclusion','Ekspertiza xulosasi'],['builder_license','Quruvchi tashkilot hujjati'],['commissioning_certificate','Foydalanishga topshirish hujjati'],['other','Boshqa hujjat']]
const stages=[['foundation','Poydevor'],['structure','Karkas'],['facade','Fasad'],['interior','Ichki pardoz'],['landscaping','Obodonlashtirish'],['completed','Tugallangan'],['other','Boshqa']]
const statusLabel:Record<string,string>={pending:'Admin tekshiruvida',approved:'Tasdiqlangan',rejected:'Rad etilgan',expired:'Muddati tugagan'}
export default function ComplexMediaManager({complexId}:{complexId:string}){
 const [docs,setDocs]=useState<Doc[]>([]),[updates,setUpdates]=useState<Update[]>([])
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('')
 const [docType,setDocType]=useState('construction_permit'),[title,setTitle]=useState(''),[docNo,setDocNo]=useState(''),[requestedVisibility,setRequestedVisibility]=useState<'public'|'admin_only'>('admin_only')
 const [stage,setStage]=useState('structure'),[caption,setCaption]=useState(''),[capturedAt,setCapturedAt]=useState(new Date().toISOString().slice(0,10))
 async function load(){setLoading(true);setError('');try{const r=await fetch('/api/developer/complex-media?complex_id='+encodeURIComponent(complexId),{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'LOAD_FAILED');setDocs(d.documents||[]);setUpdates(d.updates||[])}catch(e){setError(e instanceof Error?e.message:'Yuklashda xatolik')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[complexId])
 async function upload(kind:'document'|'construction',file:File,meta:Record<string,unknown>){
  setBusy(true);setError('');setSuccess('')
  try{
   const init=await fetch('/api/developer/complex-media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'init',kind,complex_id:complexId,file_name:file.name,mime_type:file.type,file_size_bytes:file.size})})
   const signed=await init.json();if(!init.ok)throw new Error(signed.error||'UPLOAD_INIT_FAILED')
   const db=createClient()
   const {error:storageError}=await db.storage.from(signed.bucket).uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type, upsert:false})
   if(storageError)throw new Error(storageError.message)
   const complete=await fetch('/api/developer/complex-media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'complete',kind,complex_id:complexId,path:signed.path,mime_type:file.type,file_size_bytes:file.size,...meta})})
   const result=await complete.json();if(!complete.ok)throw new Error(result.error||'UPLOAD_REGISTER_FAILED')
   setSuccess(kind==='document'?'Hujjat admin tekshiruviga yuborildi.':'Foto/video qurilish lentasiga joylandi.')
   await load()
  }catch(e){setError(e instanceof Error?e.message:'Yuklashda xatolik')}finally{setBusy(false)}
 }
 const formatSize=(n:number)=>n<1024*1024?Math.round(n/1024)+' KB':(n/1024/1024).toFixed(1)+' MB'
 return <main className="min-h-screen bg-slate-50 px-4 py-7"><div className="mx-auto max-w-5xl">
  <a href="/account/developer" className="font-bold text-emerald-700">← Developer kabineti</a>
  <header className="mt-5 rounded-3xl bg-slate-900 p-7 text-white"><p className="text-sm text-slate-300">ROYALHOUSE · PROJECT MEDIA</p><h1 className="mt-1 text-3xl font-black">Hujjatlar va qurilish jarayoni</h1><p className="mt-2 text-sm text-slate-300">Birlamchi hujjatlar admin tekshiruvidan o‘tadi. Qurilish foto va videolari avtomatik e’lon qilinadi.</p></header>
  {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
  <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Birlamchi hujjatlar</h2><p className="mt-1 text-sm text-slate-500">PDF yoki skan nusxa. Fayl admin tasdiqlamaguncha ommaga ko‘rinmaydi.</p>
   <form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={e=>{e.preventDefault();const input=e.currentTarget.elements.namedItem('document') as HTMLInputElement;const file=input.files?.[0];if(file&&title.trim())void upload('document',file,{document_type:docType,title:title.trim(),document_number:docNo.trim()||null,requested_visibility_scope:requestedVisibility})}}>
    <label className="text-sm font-bold">Hujjat turi<select value={docType} onChange={e=>setDocType(e.target.value)} className="mt-1 w-full rounded-xl border p-3">{docTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label className="text-sm font-bold">Hujjat nomi<input required value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} className="mt-1 w-full rounded-xl border p-3" placeholder="Masalan, Qurilishga ruxsatnoma"/></label>
    <label className="text-sm font-bold">Hujjat raqami<input value={docNo} onChange={e=>setDocNo(e.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border p-3"/></label>
    <label className="text-sm font-bold">Ommaga ko‘rsatish so‘rovi<select value={requestedVisibility} onChange={e=>setRequestedVisibility(e.target.value as 'public'|'admin_only')} className="mt-1 w-full rounded-xl border p-3"><option value="admin_only">Faqat admin va developer ko‘rsin</option><option value="public">Ommaviy sahifada ko‘rsatishni so‘rash</option></select><span className="mt-1 block text-xs font-normal text-slate-500">Ommaga chiqishi uchun admin alohida tasdiqlashi shart.</span></label>
    <label className="text-sm font-bold">Fayl (PDF/JPG/PNG/WebP, 20 MB gacha)<input required name="document" type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="mt-1 block w-full rounded-xl border p-2 text-sm"/></label>
    <button disabled={busy} className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50 md:col-span-2">{busy?'Yuklanmoqda...':'Hujjatni admin tekshiruviga yuborish'}</button>
   </form>
   <div className="mt-6 space-y-2">{docs.map(d=><article key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><p className="font-bold">{d.title}</p><p className="mt-1 text-xs text-slate-500">{docTypes.find(x=>x[0]===d.document_type)?.[1]||d.document_type} · {formatSize(d.file_size_bytes)} · {new Date(d.created_at).toLocaleDateString('uz-UZ')}</p>{d.moderation_note&&<p className="mt-1 text-xs text-red-700">Admin izohi: {d.moderation_note}</p>}<p className="mt-1 text-xs text-slate-500">Ko‘rinish: {d.visibility_scope==='public'?'Ommaviy':'Maxfiy'} · So‘rov: {d.requested_visibility_scope==='public'?'Ommaviy':'Maxfiy'}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${d.moderation_status==='approved'?'bg-emerald-50 text-emerald-700':d.moderation_status==='rejected'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-800'}`}>{statusLabel[d.moderation_status]||d.moderation_status}</span></article>)}{!loading&&!docs.length&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Hujjatlar hali yuklanmagan.</p>}</div>
  </section>
  <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Qurilish jarayoni</h2><p className="mt-1 text-sm text-slate-500">Yuklangan foto/video moderatsiyasiz ommaviy sahifada ko‘rinadi. Faqat loyiha bilan bog‘liq materiallarni joylang.</p>
   <form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={e=>{e.preventDefault();const input=e.currentTarget.elements.namedItem('media') as HTMLInputElement;const file=input.files?.[0];if(file)void upload('construction',file,{construction_stage:stage,caption:caption.trim()||null,captured_at:capturedAt})}}>
    <label className="text-sm font-bold">Qurilish bosqichi<select value={stage} onChange={e=>setStage(e.target.value)} className="mt-1 w-full rounded-xl border p-3">{stages.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label className="text-sm font-bold">Tasvirga olingan sana<input type="date" value={capturedAt} onChange={e=>setCapturedAt(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
    <label className="text-sm font-bold md:col-span-2">Izoh<input value={caption} onChange={e=>setCaption(e.target.value)} maxLength={1200} className="mt-1 w-full rounded-xl border p-3" placeholder="Masalan, 1-korpus 10-qavat karkasi yakunlandi"/></label>
    <label className="text-sm font-bold md:col-span-2">Foto yoki video (500 MB gacha)<input required name="media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="mt-1 block w-full rounded-xl border p-2 text-sm"/></label>
    <button disabled={busy} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-50 md:col-span-2">{busy?'Yuklanmoqda...':'Qurilish lentasiga joylash'}</button>
   </form>
   <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{updates.map(u=><article key={u.id} className="overflow-hidden rounded-xl border">{u.media_type==='video'?<video src={u.public_url} controls className="aspect-video w-full bg-black"/>:<img src={u.public_url} alt={u.caption||'Qurilish jarayoni'} className="aspect-video w-full object-cover"/>}<div className="p-3"><p className="font-bold">{stages.find(x=>x[0]===u.construction_stage)?.[1]||u.construction_stage}</p><p className="mt-1 text-xs text-slate-500">{u.captured_at}</p>{u.caption&&<p className="mt-2 text-sm">{u.caption}</p>}{!u.is_visible&&<p className="mt-2 text-xs font-bold text-red-700">Admin yashirgan</p>}</div></article>)}</div>
  </section>
 </div></main>
}
