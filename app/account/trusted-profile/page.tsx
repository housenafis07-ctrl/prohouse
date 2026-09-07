'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const statusText: Record<string, { title: string; text: string }> = {
  not_joined: { title: 'Ulanilmagan', text: 'Ishonchli profil dasturiga qo‘shilish hali boshlanmagan.' },
  requested: { title: 'So‘rov yuborildi', text: 'Profilingiz tekshiruv navbatiga qo‘yildi.' },
  verification: { title: 'Tasdiqlash jarayonida', text: 'MyID va boshqa zarur tekshiruvlar yakunlanmoqda.' },
  verified: { title: 'Ishonchli profil', text: 'Profilingiz ishonchli sifatida tasdiqlangan.' },
  rejected: { title: 'Tasdiqlanmadi', text: 'Tekshiruv natijasida qo‘shimcha ma’lumot talab qilinishi mumkin.' },
}

function TrustedBadge({ small = false }: { small?: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 font-extrabold text-emerald-700 ring-1 ring-emerald-100 ${small ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}><span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white">✓</span>Ishonchli profil</span>
}

type Profile = {
  trusted_profile: boolean
  trusted_profile_opt_in: boolean
  trusted_profile_program_status: string | null
  myid_status: string | null
  myid_verified_at: string | null
  payment_verification_status: string | null
  trusted_profile_rejection_reason: string | null
}

export default function TrustedProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { router.replace('/register'); return }
    const { data, error: queryError } = await db.from('profiles').select('trusted_profile,trusted_profile_opt_in,trusted_profile_program_status,myid_status,myid_verified_at,payment_verification_status,trusted_profile_rejection_reason').eq('id', user.id).maybeSingle()
    if (queryError) setError(queryError.message)
    setProfile((data ?? { trusted_profile: false, trusted_profile_opt_in: false, trusted_profile_program_status: 'not_joined', myid_status: 'not_started', myid_verified_at: null, payment_verification_status: null, trusted_profile_rejection_reason: null }) as Profile)
    setLoading(false)
  }

  useEffect(() => { void load() }, [router])

  const request = async () => {
    setWorking(true); setError(''); setMessage('')
    try {
      const db = createClient()
      const { data, error: rpcError } = await db.rpc('request_trusted_profile')
      if (rpcError) throw rpcError
      setMessage(data?.status === 'verified' ? 'Ishonchli profil allaqachon tasdiqlangan.' : 'Ishonchli profil uchun so‘rovingiz qabul qilindi.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'So‘rov yuborishda xatolik')
    } finally { setWorking(false) }
  }

  const startMyId = async () => {
    setWorking(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/verification/myid/start', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'MyID tekshiruvini boshlashda xatolik')
      if (data.redirectUrl) window.location.assign(data.redirectUrl)
      else setMessage(data.message || 'MyID integratsiyasi konfiguratsiya qilinmagan.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'MyID tekshiruvini boshlashda xatolik')
    } finally { setWorking(false) }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-8 text-center text-slate-500">Yuklanmoqda...</main>
  if (!profile) return null

  const status = profile.trusted_profile ? 'verified' : (profile.trusted_profile_program_status || 'not_joined')
  const meta = statusText[status] || statusText.not_joined
  const myIdVerified = profile.myid_status === 'verified'
  const paymentVerified = profile.payment_verification_status === 'verified'

  return <main className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Link href="/account" className="text-sm font-extrabold text-emerald-700">← Shaxsiy kabinet</Link><Link href="/" className="text-sm font-bold text-slate-500">Prohouse</Link></div></header>
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12"><div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"><div className="bg-slate-900 px-6 py-8 text-white sm:px-8"><p className="text-sm font-semibold text-slate-300">Prohouse xavfsizlik tizimi</p><h1 className="mt-2 text-3xl font-black">Ishonchli profil</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Ixtiyoriy tasdiqlash orqali foydalanuvchining haqiqiyligini kuchaytirish va e’lonlarda ishonchli sotuvchini ajratib ko‘rsatish.</p><div className="mt-5">{profile.trusted_profile && <TrustedBadge/>}</div></div>
      <div className="p-6 sm:p-8"><div className="flex flex-col gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Holat</p><h2 className="mt-1 text-xl font-black text-emerald-900">{meta.title}</h2><p className="mt-1 text-sm leading-6 text-emerald-800">{meta.text}</p></div>{profile.trusted_profile && <TrustedBadge small/>}</div>
        {profile.trusted_profile_rejection_reason && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{profile.trusted_profile_rejection_reason}</div>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-100 bg-slate-50 p-5"><div className="flex items-center justify-between"><h3 className="font-black">MyID</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${myIdVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{myIdVerified ? 'Tasdiqlangan' : 'Tasdiqlanmagan'}</span></div><p className="mt-2 text-sm leading-6 text-slate-500">Shaxsni biometrik identifikatsiya qilish orqali profilni tasdiqlash.</p>{!myIdVerified && <button onClick={startMyId} disabled={working} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{working ? 'Yuklanmoqda...' : 'MyID orqali tasdiqlash'}</button>}</div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5"><div className="flex items-center justify-between"><h3 className="font-black">To‘lov hisobi</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${paymentVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{paymentVerified ? 'Tasdiqlangan' : 'Kutilmoqda'}</span></div><p className="mt-2 text-sm leading-6 text-slate-500">Ishonchli profilni kuchaytirish uchun bog‘langan to‘lov hisobining tasdiqlangan holati.</p></div></div>
        {!profile.trusted_profile && <div className="mt-6 rounded-2xl border border-slate-200 p-5"><h3 className="font-black">Ixtiyoriy dastur</h3><p className="mt-2 text-sm leading-6 text-slate-500">Qo‘shilish majburiy emas. So‘rov yuborilgach, MyID tasdig‘i va mavjud xavfsizlik tekshiruvlari asosida profilga yashil belgi beriladi.</p><button onClick={request} disabled={working || status === 'requested' || status === 'verification'} className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700 disabled:opacity-50">{status === 'requested' || status === 'verification' ? 'Tekshiruv kutilmoqda' : 'Ishonchli profilga qo‘shilish'}</button></div>}
        {message && <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}{error && <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-black">Belgi qayerda ko‘rinadi?</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600"><li>✓ Shaxsiy kabinetdagi profil holatida</li><li>✓ Hamkorning e’lonlarida “Ishonchli profil” belgisi sifatida</li><li>✓ E’lon tafsilotlarida sotuvchi/beruvchi ma’lumotlari yonida</li><li>✓ Keyingi bosqichda Rieltorlar profilida ham</li></ul></div>
        <p className="mt-6 text-xs leading-5 text-slate-400">MyID biometrik identifikatsiyasi faqat foydalanuvchining tasdiqlangan roziligi bilan amalga oshirilishi kerak. Real MyID ulanishi uchun Prohouse MyID bilan shartnoma va beriladigan test/tijoriy credentials asosida konfiguratsiya qilinadi.</p>
      </div></div></div></main>
}
