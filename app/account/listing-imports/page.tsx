'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type ImportRow = {
  id: string
  listing_id: string | null
  ai_extracted: Record<string, any>
  status: string
  authorization_status: string
  authorization_method: string | null
  owner_full_name: string | null
  owner_phone: string | null
  created_at: string
  authorized_at: string | null
}
export default function ListingImportsPage() {
  const [rows,setRows]=useState<ImportRow[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState('')
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [ownerName,setOwnerName]=useState<Record<string,string>>({})
  const [ownerPhone,setOwnerPhone]=useState<Record<string,string>>({})
  const [consentUrl,setConsentUrl]=useState<Record<string,string>>({})
  const [confirmed,setConfirmed]=useState<Record<string,boolean>>({})
  const load=async()=>{
    setLoading(true);setError('')
    try{const r=await fetch('/api/account/listing-imports',{cache:'no-store'}),d=await r.json();if(r.status===401){window.location.href='/account/login?next=%2Faccount%2Flisting-imports';return}if(!r.ok)throw Error(d.error||'Importlar yuklanmadi');setRows(d.imports||[])}
    catch(e){setError(e instanceof Error?e.message:'Yuklashda xatolik')}finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])
  const requestConsent=async(id:string)=>{
    setBusy(id);setError('');setMessage('')
    try{const r=await fetch('/api/account/listing-imports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'owner_consent',importId:id,ownerName:ownerName[id],ownerPhone:ownerPhone[id]})}),d=await r.json();if(!r.ok)throw Error(d.message||d.error||'Rozilik havolasi yaratilmadi');setConsentUrl(v=>({...v,[id]:d.consentUrl}));setMessage('Havola yaratildi. Uni mulk egasiga yuboring; egasi SMS OTP bilan kirib rozilikni tasdiqlaydi.')}
    catch(e){setError(e instanceof Error?e.message:'Xatolik')}finally{setBusy('')}
  }
  const submitDeclaration=async(id:string)=>{
    if(!confirmed[id]){setError('Davom etish uchun javobgarlik deklaratsiyasini tasdiqlang.');return}
    setBusy(id);setError('');setMessage('')
    try{const r=await fetch('/api/account/listing-imports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'representative_declaration',importId:id,confirmed:true})}),d=await r.json();if(!r.ok)throw Error(d.message||d.error||'Tasdiqlash amalga oshmadi');setMessage(d.message||'Javobgarlik tasdiqlandi.');await load()}
    catch(e){setError(e instanceof Error?e.message:'Xatolik')}finally{setBusy('')}
  }
  const copy=async(value:string)=>{try{await navigator.clipboard.writeText(value);setMessage('Havola nusxalandi.')}catch{setMessage(value)}}
  const stateLabel=(row:ImportRow)=>row.status==='ready_for_moderation'?'Moderatsiyaga yuborilgan':row.authorization_status==='rejected'?'Vakolat rad etildi':row.authorization_status==='verified'?(row.authorization_method==='representative_declaration'?'Javobgarlik tasdiqlangan':'Mulk egasi roziligi tasdiqlangan'):'Rozilik kutilmoqda'
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white"><div className="mx-auto max-w-5xl px-4 py-5"><Link href="/account" className="text-sm font-bold text-emerald-700">← Shaxsiy kabinet</Link><h1 className="mt-3 text-2xl font-black sm:text-3xl">Telegram AI import qoralamalari</h1><p className="mt-2 text-sm text-slate-500">E’lon ma’lumotlarini tekshiring va javobgarlikni tasdiqlang. Mulk egasi nomidan joylashtirilsa, uning SMS OTP roziligi talab qilinadi.</p></div></header>
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-7">
      {error&&<div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}{message&&<div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      {loading?<div className="rounded-2xl bg-white p-8 text-center">Yuklanmoqda...</div>:!rows.length?<div className="rounded-2xl border bg-white p-8 text-center"><p className="font-bold">Hozircha Telegram import qoralamalari yo‘q.</p><p className="mt-2 text-sm text-slate-500">RoyalHouseUz_bot orqali kanal yoki guruhdagi e’lonni forward qiling.</p><a href="https://t.me/RoyalHouseUz_bot" className="mt-4 inline-flex rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">Telegram botni ochish</a></div>:rows.map(row=>{
        const x=row.ai_extracted||{}
        return <article key={row.id} className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">{stateLabel(row)}</span><span className="text-xs text-slate-400">{new Date(row.created_at).toLocaleString('uz-UZ')}</span></div>
          <h2 className="mt-3 text-lg font-black">{x.title||'Ko‘chmas mulk e’loni'}</h2>
          <p className="mt-1 text-sm text-slate-500">{[x.city,x.district].filter(Boolean).join(', ')} {x.price!=null?'· '+new Intl.NumberFormat('uz-UZ').format(x.price)+' '+(x.currency||''):''}</p>
          {Array.isArray(x.corrections)&&x.corrections.length>0&&<p className="mt-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-800">AI yozuvni normallashtirdi: {x.corrections.join('; ')}</p>}
          {x.location_confidence==='low'&&<p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Joylashuvni aniqlashtirish kerak — e’lon formasida to‘g‘ri hududni tanlang.</p>}
          {row.authorization_status!=='verified'&&<div className="mt-4 space-y-4">
            <section className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
              <h3 className="font-black">Vakil sifatida javobgarlikni tasdiqlash</h3>
              <p className="mt-2 text-sm text-slate-700">E’londagi ma’lumotlarni tekshirganingizni, ular to‘g‘riligini va ushbu e’lonni joylashtirish bilan bog‘liq javobgarlikni o‘z zimmangizga olishingizni tasdiqlaysizmi?</p>
              <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={!!confirmed[row.id]} onChange={e=>setConfirmed(v=>({...v,[row.id]:e.target.checked}))} className="mt-1"/><span>Ha, ma’lumotlar to‘g‘riligini tasdiqlayman va javobgarlikni o‘z zimmamga olaman.</span></label>
              <button disabled={busy===row.id||!confirmed[row.id]} onClick={()=>void submitDeclaration(row.id)} className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy===row.id?'Saqlanmoqda...':'Tasdiqlash va davom etish'}</button>
            </section>
            <details className="rounded-xl border bg-white p-4">
              <summary className="cursor-pointer text-sm font-bold">Men mulk egasiman — SMS OTP orqali rozilik berish</summary>
              <p className="mt-2 text-xs text-slate-600">Mulk egasining F.I.O. va telefon raqamini kiriting. Egasi SMS OTP orqali akkauntga kirib rozilikni shaxsan tasdiqlaydi.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">Mulk egasining F.I.O.<input value={ownerName[row.id]??row.owner_full_name??''} onChange={e=>setOwnerName(v=>({...v,[row.id]:e.target.value}))} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal" placeholder="F.I.O."/></label>
                <label className="text-sm font-bold">Mulk egasining telefoni<input value={ownerPhone[row.id]??row.owner_phone??''} onChange={e=>setOwnerPhone(v=>({...v,[row.id]:e.target.value}))} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal" placeholder="+998 90 123 45 67"/></label>
              </div>
              <button disabled={busy===row.id} onClick={()=>void requestConsent(row.id)} className="mt-3 w-full rounded-xl border bg-white px-4 py-3 text-sm font-bold disabled:opacity-50">Rozilik havolasini yaratish</button>
              {consentUrl[row.id]&&<div className="mt-3 break-all rounded-lg bg-slate-50 p-2 text-xs">{consentUrl[row.id]}<button onClick={()=>void copy(consentUrl[row.id])} className="mt-2 block font-bold text-emerald-700">Havolani nusxalash</button></div>}
            </details>
          </div>}
          {row.authorization_status==='verified'&&row.status==='authorized'&&!row.listing_id&&<div className="mt-4 rounded-xl bg-emerald-50 p-4"><p className="text-sm font-bold text-emerald-800">Vakolat tasdiqlandi. Endi e’lon ma’lumotlarini tekshirib, tahrirlashingiz va moderatsiyaga yuborishingiz mumkin.</p><Link href={`/listings/new?importId=${encodeURIComponent(row.id)}`} className="mt-3 inline-flex rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white">E’lonni tekshirish va davom ettirish →</Link></div>}
        </article>
      })}
    </div>
  </main>
}
