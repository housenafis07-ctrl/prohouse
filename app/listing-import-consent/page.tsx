'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type ConsentInfo={ownerName:string|null;phoneHint:string;listing:{title:string;city:string;district:string;price:number|null;currency:string}}
export default function ListingImportConsentPage(){
 const params=useSearchParams(),token=params.get('token')||''
 const [info,setInfo]=useState<ConsentInfo|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('')
 useEffect(()=>{let active=true;(async()=>{try{const r=await fetch('/api/listing-import-consent?token='+encodeURIComponent(token),{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Rozilik havolasi yaroqsiz');if(active)setInfo(d)}catch(e){if(active)setError(e instanceof Error?e.message:'Havola tekshirilmadi')}finally{if(active)setLoading(false)}})();return()=>{active=false}},[token])
 const loginHref='/account/login?next='+encodeURIComponent('/listing-import-consent?token='+token)
 const approve=async()=>{setBusy(true);setError('');try{const r=await fetch('/api/listing-import-consent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}),d=await r.json();if(r.status===401){window.location.href=loginHref;return}if(!r.ok)throw Error(d.message||d.error||'Rozilik tasdiqlanmadi');setSuccess(d.message||'Rozilik tasdiqlandi.')}catch(e){setError(e instanceof Error?e.message:'Xatolik')}finally{setBusy(false)}}
 return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900"><section className="w-full max-w-xl rounded-3xl border bg-white p-6 shadow-xl sm:p-8">
 <Link href="/" className="text-sm font-bold text-emerald-700">RoyalHouse</Link><p className="mt-6 text-xs font-black tracking-widest text-emerald-700">MULK EGASI ROZILIGI</p><h1 className="mt-2 text-2xl font-black">E’lon joylashtirishga rozilik</h1>
 {loading?<p className="mt-6 text-sm text-slate-500">Havola tekshirilmoqda...</p>:info?<><div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">E’lon</p><h2 className="mt-1 text-lg font-black">{info.listing.title}</h2><p className="mt-1 text-sm text-slate-600">{[info.listing.city,info.listing.district].filter(Boolean).join(', ')}{info.listing.price!=null?' · '+new Intl.NumberFormat('uz-UZ').format(info.listing.price)+' '+info.listing.currency:''}</p><p className="mt-3 text-sm">Rozilik berilishi kutilayotgan shaxs: <b>{info.ownerName||'Mulk egasi'}</b></p><p className="mt-1 text-xs text-slate-500">Tasdiqlanishi kerak bo‘lgan telefon: {info.phoneHint}</p></div><div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Davom etish uchun yuqorida ko‘rsatilgan telefon raqami sizga tegishli bo‘lishi kerak. SMS OTP orqali shaxsiy kabinetingizga kiring va faqat haqiqatan rozilik bergan bo‘lsangiz tasdiqlang. Bu amal e’lonni darhol nashr qilmaydi — u keyingi tekshiruv va moderatsiyaga yuboriladi.</div><button disabled={busy||Boolean(success)} onClick={()=>void approve()} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50">{busy?'Tekshirilmoqda...':success?'Rozilik tasdiqlandi':'SMS OTP bilan kirib, rozilikni tasdiqlash'}</button></>:null}
 {error&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success&&<p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
 <p className="mt-5 text-xs text-slate-400">Rozilik tokeni bir martalik va 72 soat amal qiladi.</p>
 </section></main>
}
