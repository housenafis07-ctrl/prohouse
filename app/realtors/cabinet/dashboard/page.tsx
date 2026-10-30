'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/app/components/I18nProvider'

type Realtor = {
  id: string; display_name: string; phone: string | null; verification_status: string
  experience_years: number; rating: number; reviews_count: number; agency_name: string | null
  service_areas: string[]
}
type AdminBenefit = {
  id: string; benefit_tier: 'FREE' | 'PRO' | 'BUSINESS' | 'CUSTOM'
  listing_limit: number; starts_at: string; ends_at: string; note: string | null
  features: Record<string, boolean> | null
}

function benefitPeriod(grant: AdminBenefit | null, ru: boolean) {
  if (!grant) return { title: ru ? 'Льготный период не назначен' : 'Imtiyozli davr belgilanmagan', detail: ru ? 'Действующая льгота от администратора отсутствует.' : 'Faol administrator imtiyozi mavjud emas.', note: null as string | null, style: 'border-slate-200 bg-slate-50' }
  const remaining = new Date(grant.ends_at).getTime() - Date.now()
  const days = Math.max(0, Math.ceil(remaining / 86400000))
  const tier = grant.benefit_tier
  return {
    title: ru ? `Тариф ${tier} · осталось дней: ${days}` : `${tier} tarif · ${days} kun qoldi`,
    detail: `${ru ? 'Лимит' : 'Limit'}: ${grant.listing_limit} · ${new Date(grant.starts_at).toLocaleDateString(ru ? 'ru-RU' : 'uz-UZ')} — ${new Date(grant.ends_at).toLocaleDateString(ru ? 'ru-RU' : 'uz-UZ')}`,
    note: grant.note,
    style: 'border-emerald-200 bg-emerald-50',
  }
}

export default function RealtorDashboard() {
  const router = useRouter()
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const tx = (uz: string, rr: string) => ru ? rr : uz
  const [loading, setLoading] = useState(true)
  const [r, setR] = useState<Realtor | null>(null)
  const [activeBenefit, setActiveBenefit] = useState<AdminBenefit | null>(null)
  const [error, setError] = useState('')
  const [activeListings, setActiveListings] = useState(0)
  const [leadStats, setLeadStats] = useState<{leads:number;newLeads:number;avgResponseMinutes:number|null}>({leads:0,newLeads:0,avgResponseMinutes:null})

  useEffect(() => {
    let active = true
    fetch('/api/account/stats', { cache: 'no-store' }).then(x => x.ok ? x.json() : null).then(data => {
      if (active && data) {
        setActiveListings(Number(data.active || 0))
        setLeadStats({ leads: Number(data.leads || 0), newLeads: Number(data.newLeads || 0), avgResponseMinutes: data.avgResponseMinutes == null ? null : Number(data.avgResponseMinutes) })
      }
    }).catch(() => {})
    fetch('/api/realtors/cabinet', { cache: 'no-store', credentials: 'same-origin' }).then(async response => {
      const data = await response.json().catch(() => ({}))
      if (!active) return
      if (response.status === 401) { router.replace('/account/login?next=%2Frealtors%2Fcabinet%2Fdashboard'); return }
      if (!response.ok) throw new Error(data.message || data.error || 'REALTOR_PROFILE_LOAD_FAILED')
      if (!data.realtor) { router.replace('/realtors/cabinet?mode=register'); return }
      setR(data.realtor)
      setActiveBenefit(data.activeBenefit || null)
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'REALTOR_PROFILE_LOAD_FAILED') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [router])

  if (loading) return <main className="min-h-screen bg-slate-50 p-10"><div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 text-center">{tx('Yuklanmoqda...','Загрузка...')}</div></main>
  if (!r) return <main className="min-h-screen bg-slate-50 p-10"><div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 text-center text-red-600">{error || tx('Rieltor profili topilmadi.','Профиль риелтора не найден.')}</div></main>

  const verified = r.verification_status === 'verified'
  const benefit = benefitPeriod(activeBenefit, ru)
  const avg = leadStats.avgResponseMinutes
  return <main className="min-h-screen bg-slate-50 p-4 py-8 sm:p-10"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-4"><Link href="/realtors" className="font-bold text-emerald-700">← {tx('Rieltorlar','Риелторы')}</Link><Link href="/account" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">{tx('Asosiy shaxsiy kabinet','Основной личный кабинет')}</Link><Link href="/account/referrals" className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">{tx('Do‘stni taklif qilish','Пригласить друга')}</Link><Link href="/realtors/tariffs" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">{tx('Tariflar','Тарифы')}</Link></div></header>
    <section className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="bg-slate-900 p-7 text-white"><p className="text-xs font-black tracking-[.18em] text-emerald-400">PROFESSIONAL CABINET</p><div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-black">{r.display_name}</h1><p className="mt-2 text-sm text-slate-300">{r.phone}</p></div><span className={`rounded-full px-4 py-2 text-sm font-bold ${verified ? 'bg-emerald-500' : 'bg-amber-400 text-slate-950'}`}>{verified ? tx('✓ Tasdiqlangan','✓ Проверен') : tx('⏳ Tekshiruvda','⏳ На проверке')}</span></div></div>
      <div className="border-b p-6"><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">{tx('Agentlik','Агентство')}</p><p className="mt-2 font-bold">{r.agency_name || tx('Mustaqil rieltor','Независимый риелтор')}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">{tx('Xizmat hududlari','Районы работы')}</p><p className="mt-2 font-bold">{r.service_areas?.length ? r.service_areas.join(', ') : '—'}</p></div></div></div>
      <div className={`mx-6 mt-6 rounded-2xl border p-5 ${benefit.style}`}><p className="text-xs font-black uppercase tracking-wider text-slate-500">{tx('Rieltor imtiyozli davri','Льготный период риелтора')}</p><p className="mt-2 text-xl font-black">{benefit.title}</p><p className="mt-1 text-sm text-slate-600">{benefit.detail}</p>{benefit.note && <p className="mt-2 text-sm text-slate-700">{benefit.note}</p>}</div>
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-bold text-slate-400">{tx('Faol e’lonlar','Активные объявления')}</p><p className="mt-2 text-2xl font-black">{activeListings}</p></div>
        <div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-bold text-slate-400">{tx('Tajriba','Опыт')}</p><p className="mt-2 text-2xl font-black">{r.experience_years} {tx('yil','лет')}</p></div>
        <div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-bold text-slate-400">{tx('Reyting','Рейтинг')}</p><p className="mt-2 text-2xl font-black">★ {Number(r.rating).toFixed(1)}</p></div>
        <div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-bold text-slate-400">{tx('Sharhlar','Отзывы')}</p><p className="mt-2 text-2xl font-black">{r.reviews_count}</p></div>
        <div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-bold text-slate-400">{tx('Murojaatlar','Обращения')}</p><p className="mt-2 text-2xl font-black">{leadStats.leads}</p><p className="mt-1 text-xs text-slate-500">{tx('Yangi: ','Новые: ')}{leadStats.newLeads}</p></div>
        <div className="rounded-2xl bg-slate-50 p-5"><p className="text-xs font-bold text-slate-400">{tx('O‘rtacha javob vaqti','Среднее время ответа')}</p><p className="mt-2 text-2xl font-black">{avg == null ? '—' : avg < 60 ? String(avg)+' '+tx('daq.','мин.') : String(Math.round(avg/60*10)/10)+' '+tx('soat','ч.')}</p><p className="mt-1 text-xs text-slate-500">{tx('Birinchi “bog‘lanildi” holatiga qadar','До первого статуса «связались»')}</p></div>
      </div>
      <div className="grid gap-4 border-t p-6 sm:grid-cols-2 lg:grid-cols-4"><Link href="/account/listings" className="rounded-2xl border p-5 font-black">{tx('E’lonlarim','Мои объявления')}</Link><div className="rounded-2xl border p-5 font-black">{tx('Mijozlarim','Мои клиенты')}</div><div className="rounded-2xl border p-5 font-black">{tx('Bitimlar','Сделки')}</div><Link href="/realtors" className="rounded-2xl border p-5 font-black">{tx('Public profil','Публичный профиль')}</Link></div>
      {!verified && <div className="mx-6 mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{tx('Arizangiz qabul qilindi. Administrator tekshirganidan keyin profilingiz tasdiqlanadi.','Ваша заявка принята. Профиль будет подтверждён после проверки администратором.')}</div>}
    </section></div></main>
}
