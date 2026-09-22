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
  const [lang,setLang] = useState<'uz'|'ru'>('uz')
  const ru = lang === 'ru'
  const t = (uz:string, russian:string) => ru ? russian : uz

  const update=(key:keyof typeof form,value:string)=>setForm(v=>({...v,[key]:value}))

  useEffect(()=>{
    if(localStorage.getItem('prohouse-lang') === 'ru') setLang('ru')
  },[])

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
    if(phone.replace(/\D/g,'').length<12) return setMessage(t('Telefon raqamini to‘liq kiriting.','Введите полный номер телефона.'))
    setLoading(true);setMessage('')
    try{
      const response=await fetch('/api/auth/send-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})})
      const data=await response.json()
      if(!response.ok) throw new Error(data.error||t('SMS yuborilmadi','SMS не отправлено'))
      setSent(true);setMessage(data.testMode?t('Test rejimi: 321321 kodidan foydalaning.','Тестовый режим: используйте код 321321.') : t('SMS kodi yuborildi.','SMS-код отправлен.'))
    }catch(e){setMessage(e instanceof Error?e.message:t('SMS yuborishda xatolik','Ошибка при отправке SMS'))}
    finally{setLoading(false)}
  }

  async function verifyCode(){
    if(!sent||code.length<4) return setMessage(t('SMS kodini kiriting.','Введите SMS-код.'))
    setLoading(true);setMessage('')
    try{
      const response=await fetch('/api/auth/verify-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,code})})
      const data=await response.json()
      if(!response.ok) throw new Error(data.error||t('Kod noto‘g‘ri','Неверный код'))
      const supabase=createClient()
      if(!data.session?.access_token||!data.session?.refresh_token) throw new Error(t('Sessiya ma’lumotlari qaytmadi.','Данные сессии не получены.'))
      const {error:sessionError}=await supabase.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token})
      if(sessionError) throw sessionError
      const {data:sessionData}=await supabase.auth.getSession()
      const userId=sessionData.session?.user?.id
      if(!userId) throw new Error(t('Foydalanuvchi sessiyasi topilmadi.','Сессия пользователя не найдена.'))
      const {data:profile,error:profileError}=await supabase.from('profiles').select('*').eq('id',userId).maybeSingle()
      if(profileError) throw profileError
      if(profile){ router.replace('/account'); return }
      setVerified(true)
      setMessage(t('Telefon raqami tasdiqlandi. Endi profil ma’lumotlarini kiriting.','Номер телефона подтверждён. Теперь заполните данные профиля.'))
    }catch(e){setMessage(e instanceof Error?e.message:t('Tasdiqlashda xatolik','Ошибка подтверждения'))}
    finally{setLoading(false)}
  }

  async function finishRegistration(e:FormEvent){
    e.preventDefault()
    if(!verified) return setMessage(t('Avval telefon raqamini tasdiqlang.','Сначала подтвердите номер телефона.'))
    if(!offer?.version) return setMessage(t('Ommaviy oferta yuklanmadi. Sahifani yangilang va qayta urinib ko‘ring.','Публичная оферта не загружена. Обновите страницу и попробуйте снова.'))
    setLoading(true);setMessage('')
    try{
      const supabase=createClient()
      const {data:{user}}=await supabase.auth.getUser()
      if(!user) throw new Error(t('Sessiya topilmadi. Qayta kirib ko‘ring.','Сессия не найдена. Войдите снова.'))
      const {error:profileError}=await supabase.from('profiles').upsert({id:user.id,phone,account_type:accountType,partner_type:accountType==='partner'?partnerType:null,full_name:form.fullName,company_name:form.companyName||null,inn:form.inn||null,bank_name:form.bankName||null,bank_account:form.bankAccount||null,mfo:form.mfo||null,director_full_name:form.directorFullName||null})
      if(profileError) throw profileError
      const {error:consentError}=await supabase.from('offer_consents').insert({user_id:user.id,phone,offer_version:offer.version})
      if(consentError) throw consentError
      router.replace('/account')
    }catch(e){setMessage(e instanceof Error?e.message:t('Ro‘yxatdan o‘tishda xatolik','Ошибка регистрации'))}
    finally{setLoading(false)}
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl"><Link href="/" className="text-sm font-semibold text-emerald-700">← Royalhouse</Link><div className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h1 className="text-3xl font-extrabold text-slate-900">{verified?t('Profilni to‘ldirish','Заполнить профиль'):t('Royalhouse’ga kirish','Вход в Royalhouse')}</h1><p className="mt-2 text-slate-500">{verified?t('Telefon raqamingiz tasdiqlandi.','Номер телефона подтверждён.'):t('Telefon raqamingiz orqali davom eting.','Продолжите с помощью номера телефона.')}</p>

    {!verified && <form onSubmit={e=>{e.preventDefault();void (sent ? verifyCode() : sendCode())}} className="mt-6 space-y-5"><div><label className="mb-2 block text-sm font-semibold">{t('Telefon raqami','Номер телефона')}</label><div className="flex gap-2"><input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3"/><button type="button" disabled={loading} onClick={sendCode} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{sent?t('Qayta yuborish','Отправить повторно'):t('SMS yuborish','Отправить SMS')}</button></div><div className="mt-3 rounded-lg border border-slate-800 bg-white px-3 py-2 text-center text-xs leading-4 text-slate-700 sm:text-sm"><span>{t('Davom etish orqali siz ','Продолжая, вы принимаете ')}</span><button type="button" onClick={()=>setOfferOpen(true)} className="font-semibold underline underline-offset-2 hover:text-emerald-700">{t('Ommaviy Oferta Shartlariga','условия Публичной оферты')}</button><span>{t(' rozilik bildirasiz.','.')}</span></div></div>{sent&&<div><label className="mb-2 block text-sm font-semibold">{t('SMS kodi','SMS-код')}</label><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoFocus className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-xl tracking-[.35em]"/></div>}{message&&<div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div>}{sent&&<button disabled={loading} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{loading?t('Tekshirilmoqda...','Проверка...'):t('Kirish','Войти')}</button>}</form>}

    {verified && <><div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={()=>setAccountType('individual')} className={`rounded-lg px-4 py-3 text-sm font-bold ${accountType==='individual'?'bg-white text-slate-900 shadow-sm':'text-slate-500'}`}>{t('Jismoniy shaxs','Физическое лицо')}</button><button type="button" onClick={()=>setAccountType('partner')} className={`rounded-lg px-4 py-3 text-sm font-bold ${accountType==='partner'?'bg-white text-emerald-700 shadow-sm':'text-slate-500'}`}>{t('Hamkor','Партнёр')}</button></div><form onSubmit={finishRegistration} className="mt-6 space-y-5">{accountType==='individual'?<div><label className="mb-2 block text-sm font-semibold">F.I.O.</label><input value={form.fullName} onChange={e=>update('fullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3" placeholder={t('Ism Familiya Otasining ismi','Имя Фамилия Отчество')}/></div>:<><div><label className="mb-2 block text-sm font-semibold">{t('Hamkor turi','Тип партнёра')}</label><select value={partnerType} onChange={e=>setPartnerType(e.target.value as PartnerType)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3"><option value="self_employed">{t('O‘zini o‘zi band qilgan — O‘BQ','Самозанятый')}</option><option value="sole_proprietor">{t('Yakka tartibdagi tadbirkor — YaTT','Индивидуальный предприниматель — ИП')}</option><option value="llc">{t('Mas’uliyati cheklangan jamiyat — MChJ','Общество с ограниченной ответственностью — ООО')}</option></select></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-2 block text-sm font-semibold">F.I.O.</label><input value={form.fullName} onChange={e=>update('fullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div><label className="mb-2 block text-sm font-semibold">INN</label><input value={form.inn} onChange={e=>update('inn',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div></div>{partnerType==='llc'&&<div><label className="mb-2 block text-sm font-semibold">{t('Tashkilot nomi','Название организации')}</label><input value={form.companyName} onChange={e=>update('companyName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div>}<div><label className="mb-2 block text-sm font-semibold">{t('Rahbar F.I.O.','Ф.И.О. руководителя')}</label><input value={form.directorFullName} onChange={e=>update('directorFullName',e.target.value)} required className="w-full rounded-xl border border-slate-200 px-4 py-3"/></div><div className="rounded-2xl border border-slate-200 p-4"><h2 className="font-bold">{t('Bank rekvizitlari','Банковские реквизиты')}</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><input value={form.bankName} onChange={e=>update('bankName',e.target.value)} required placeholder={t('Bank nomi','Название банка')} className="rounded-xl border border-slate-200 px-4 py-3"/><input value={form.mfo} onChange={e=>update('mfo',e.target.value)} required placeholder="MFO" className="rounded-xl border border-slate-200 px-4 py-3"/><input value={form.bankAccount} onChange={e=>update('bankAccount',e.target.value)} required placeholder={t('Hisob raqami','Расчётный счёт')} className="rounded-xl border border-slate-200 px-4 py-3"/></div></div></>}{message&&<div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</div>}<button disabled={loading} className="w-full rounded-xl bg-slate-900 px-5 py-3.5 font-bold text-white disabled:opacity-50">{loading?t('Saqlanmoqda...','Сохранение...'):t('Ro‘yxatdan o‘tish','Зарегистрироваться')}</button></form></>}
  </div></div>
  {offerOpen&&offer&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true"><div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-lg font-extrabold text-slate-900">{offer.title}</h2><p className="text-xs text-slate-400">Versiya {offer.version}</p></div><button type="button" onClick={()=>setOfferOpen(false)} className="rounded-full px-3 py-2 text-xl text-slate-500">×</button></div><div className="overflow-y-auto px-5 py-5 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{offer.content}</div><div className="border-t border-slate-100 px-5 py-4 text-right"><button type="button" onClick={()=>setOfferOpen(false)} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">{t('Yopish','Закрыть')}</button></div></div></div>}
  </main>
}
