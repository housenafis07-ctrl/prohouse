'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type AccountType = 'individual' | 'partner'
type PartnerType = 'self_employed' | 'sole_proprietor' | 'llc'
type Offer = { version:number; title:string; content:string }
const emptyForm = { fullName:'', companyName:'', inn:'', bankName:'', bankAccount:'', mfo:'', directorFullName:'' }

export default function RegisterPage() {
  const router = useRouter()
  const [accountType,setAccountType] = useState<AccountType>('individual')
  const [partnerType,setPartnerType] = useState<PartnerType>('self_employed')
  const [phone,setPhone] = useState('+998 ')
  const [code,setCode] = useState('')
  const [sent,setSent] = useState(false)
  const [verified,setVerified] = useState(false)
  const [loading,setLoading] = useState(false)
  const [message,setMessage] = useState('')
  const [form,setForm] = useState(emptyForm)
  const [offer,setOffer] = useState<Offer|null>(null)
  const [offerOpen,setOfferOpen] = useState(false)

  const update=(key:keyof typeof form,value:string)=>setForm(v=>({...v,[key]:value}))

  useEffect(()=>{
    let mounted=true
    const load=async()=>{
      const supabase=createClient()
      const [{data:{user}},{data:activeOffer}]=await Promise.all([
        supabase.auth.getUser(),
        supabase.from('offer_versions').select('version,title,content').eq('is_active',true).maybeSingle()
      ])
      if(!mounted) return
      if(activeOffer) setOffer(activeOffer)
      if(user){
        const {data}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle()
        if(data){ router.replace('/account'); return }
      }
    }
    load()
    return()=>{mounted=false}
  },[router])

  async function sendCode(){
    if(phone.replace(/\D/g,'').length<12) return setMessage('Telefon raqamini to‘liq kiriting.')
    setLoading(true);setMessage('')
    try{
      const response=await fetch('/api/auth/send-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})})
      const data=await response.json()
      if(!response.ok) throw new Error(data.error||'SMS yuborilmadi')
      setSent(true);setMessage(data.testMode?'Test rejimi: 321321 kodidan foydalaning.':'SMS kodi yuborildi.')
    }catch(e){setMessage(e instanceof Error?e.message:'SMS yuborishda xatolik')}
    finally{setLoading(false)}
  }

  async function verifyCode(){
    if(!sent||code.length<4) return setMessage('SMS kodini kiriting.')
    setLoading(true);setMessage('')
    try{
      const response=await fetch('/api/auth/verify-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,code})})
      const data=await response.json()
      if(!response.ok) throw new Error(data.error||'Kod noto‘g‘ri')
      const supabase=createClient()
      if(!data.session?.access_token||!data.session?.refresh_token) throw new Error('Sessiya ma’lumotlari qaytmadi.')
      const {error:sessionError}=await supabase.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token})
      if(sessionError) throw sessionError
      const {data:sessionData}=await supabase.auth.getSession()
      const userId=sessionData.session?.user?.id
      if(!userId) throw new Error('Foydalanuvchi sessiyasi topilmadi.')
      const {data:profile,error:profileError}=await supabase.from('profiles').select('*').eq('id',userId).maybeSingle()
      if(profileError) throw profileError
      if(profile){ router.replace('/account'); return }
      setVerified(true)
      setMessage('Telefon raqami tasdiqlandi. Endi profil ma’lumotlarini kiriting.')
    }catch(e){setMessage(e instanceof Error?e.message:'Tasdiqlashda xatolik')}
    finally{setLoading(false)}
  }

  async function finishRegistration(e:FormEvent){
    e.preventDefault()
    if(!verified) return setMessage('Avval telefon raqamini tasdiqlang.')
    if(!offer?.version) return setMessage('Ommaviy oferta yuklanmadi. Sahifani yangilang va qayta urinib ko‘ring.')
    setLoading(true);setMessage('')
    try{
      const supabase=createClient()
      const {data:{user}}=await supabase.auth.getUser()
      if(!user) throw new Error('Sessiya topilmadi. Qayta kirib ko‘ring.')
      const {error:profileError}=await supabase.from('profiles').upsert({id:user.id,phone,account_type:accountType,partner_type:accountType==='partner'?partnerType:null,full_name:form.fullName,company_name:form.companyName||null,inn:form.inn||null,bank_name:form.bankName||null,bank_account:form.bankAccount||null,mfo:form.mfo||null,director_full_name:form.directorFullName||null})
      if(profileError) throw profileError
      const {error:consentError}=await supabase.from('offer_consents').insert({user_id:user.id,phone,offer_version:offer.version})
      if(consentError) throw consentError
      router.replace('/account')
    }catch(e){setMessage(e instanceof Error?e.message:'Ro‘yxatdan o‘tishda xatolik')}
    finally{setLoading(false)}
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl"><Link href="/" className="text-sm font-semibold text-emerald-700">← Prohouse</Link><div className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h1 className="text-3xl font-extrabold text-slate-900">{verified?'Profilni to‘ldirish':'Prohouse’ga kirish'}</h1><p className="mt-2 text-slate-500">{verified?'Telefon raqamingiz tasdiqlandi.':'Telefon raqamingiz orqali davom eting.'}</p>

    {!verified && <form onSubmit={e=>{e.preventDefault();void verifyCode()}} className="mt-6 space-y-5"><div><label className="mb-2 block text-sm font-semibold">Telefon raqami</label><div className="flex gap-2"><input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3"/><button type="button" disabled={loading} onClick={sendCode} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{sent?'Qayta yuborish':'SMS yuborish'}</button></div><div className="mt-3 rounded-lg border border-slate-800 bg-white px-3 py-2 text-center text-xs leading-4 text-slate-700 sm:text-sm"><span>Davom etish orqali siz </span><button type="button" onClick={()=>setOfferOpen(true)} className="font-semibold underline underline-offset-2 hover:text-emerald-700">Ommaviy Oferta Shartlariga</button><span> rozilik bildirasiz.</span></div></div>{sent&&<div><label className="mb-2 block text-sm font-semibold">SMS kodi</label><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoFocus className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-xl tracking-[.35em]"/></div>}{message&&<div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div>}{sent&&<button disabled={loading} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{loading?'Tekshirilmoqda...':'Kirish'}</button>}</form>}

    {verified && <><div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={()=>setAccountType('individual')} className={`rounded-lg px-4 py-3 text-sm font-bold ${accountType==='individual'?'bg-white text-slate-900 shadow-sm':'text-slate-500'}`}>Jismoniy shaxs</button><button type="button" onClick={()=>setAccountType('partner')} className={`rounded-lg px-4 py-3 text-sm font-bold ${accountType==='partner'?'bg-white text-emerald-700 shadow-sm':'text-slate-500'}`}>Hamkor</button></div><form onSubmit={finishRegistration} className="mt-6 space-y-5">{accountType==='individual'?<div><label className="mb-2 block text-sm font-semibold">F.I.O.</label><input value={form.fullName} onChange={e=>update('fullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="Ism Familiya Otasining ismi"/></div>:<><div><label className="mb-2 block text-sm font-semibold">Hamkor turi</label><select value={partnerType} onChange={e=>setPartnerType(e.target.value as PartnerType)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="self_employed">O‘zini o‘zi band qilgan — O‘BQ</option><option value="sole_proprietor">Yakka tartibdagi tadbirkor — YaTT</option><option value="llc">Mas’uliyati cheklangan jamiyat — MChJ</option></select></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-semibold">F.I.O.</label><input value={form.fullName} onChange={e=>update('fullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div><label className="mb-2 block text-sm font-semibold">INN</label><input value={form.inn} onChange={e=>update('inn',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div></div>{partnerType==='llc'&&<div><label className="mb-2 block text-sm font-semibold">Tashkilot nomi</label><input value={form.companyName} onChange={e=>update('companyName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div>}<div><label className="mb-2 block text-sm font-semibold">Rahbar F.I.O.</label><input value={form.directorFullName} onChange={e=>update('directorFullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div className="rounded-2xl border border-slate-200 p-4"><h2 className="font-bold">Bank rekvizitlari</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><input value={form.bankName} onChange={e=>update('bankName',e.target.value)} required placeholder="Bank nomi" className="rounded-xl border border-slate-200 px-4 py-3"/><input value={form.mfo} onChange={e=>update('mfo',e.target.value)} required placeholder="MFO" className="rounded-xl border border-slate-200 px-4 py-3"/><input value={form.bankAccount} onChange={e=>update('bankAccount',e.target.value)} required placeholder="Hisob raqami" className="rounded-xl border border-slate-200 px-4 py-3"/></div></div></>}{message&&<div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div>}<button disabled={loading} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{loading?'Saqlanmoqda...':'Ro‘yxatdan o‘tish'}</button></form></>}
  </div></div>
  {offerOpen&&offer&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true"><div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-lg font-extrabold text-slate-900">{offer.title}</h2><p className="text-xs text-slate-400">Versiya {offer.version}</p></div><button type="button" onClick={()=>setOfferOpen(false)} className="rounded-full px-3 py-2 text-xl text-slate-500">×</button></div><div className="overflow-y-auto px-5 py-5 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{offer.content}</div><div className="border-t border-slate-100 px-5 py-4 text-right"><button type="button" onClick={()=>setOfferOpen(false)} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Yopish</button></div></div></div>}
  </main>
}
