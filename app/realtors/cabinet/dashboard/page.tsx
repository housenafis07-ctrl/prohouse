'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/app/components/I18nProvider'
import RealtorCabinetNav from '@/app/realtors/cabinet/CabinetNav'

type Realtor = {
  id: string; display_name: string; phone: string | null; verification_status: string
  experience_years: number; rating: number; reviews_count: number; agency_name: string | null
  service_areas: string[]
  bio: string | null
  avatar_url: string | null
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
  const [editingProfile, setEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [draft, setDraft] = useState({ display_name: '', bio: '', agency_name: '', experience_years: '0', service_areas: '' })
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
      setDraft({ display_name: data.realtor.display_name || '', bio: data.realtor.bio || '', agency_name: data.realtor.agency_name || '', experience_years: String(data.realtor.experience_years ?? 0), service_areas: (data.realtor.service_areas || []).join(', ') })
      setActiveBenefit(data.activeBenefit || null)
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'REALTOR_PROFILE_LOAD_FAILED') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [router])

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingProfile(true); setProfileError(''); setProfileMessage('')
    try {
      const response = await fetch('/api/realtors/cabinet/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: draft.display_name,
          bio: draft.bio,
          agency_name: draft.agency_name,
          experience_years: Number(draft.experience_years),
          service_areas: draft.service_areas.split(',').map(x => x.trim()).filter(Boolean),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || tx('Profil saqlanmadi.','Не удалось сохранить профиль.'))
      setR(current => current ? { ...current, ...data.realtor } : current)
      setEditingProfile(false)
      setProfileMessage(tx('Rieltor profili saqlandi.','Профиль риелтора сохранён.'))
    } catch (e) { setProfileError(e instanceof Error ? e.message : tx('Xatolik yuz berdi.','Произошла ошибка.')) }
    finally { setSavingProfile(false) }
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true); setProfileError(''); setProfileMessage('')
    try {
      const form = new FormData()
      form.append('avatar', file)
      const response = await fetch('/api/realtors/cabinet/profile', { method: 'POST', body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || tx('Rasm yuklanmadi.','Не удалось загрузить фото.'))
      setR(current => current ? { ...current, avatar_url: data.avatar_url } : current)
      setProfileMessage(tx('Profil rasmi yangilandi.','Фото профиля обновлено.'))
    } catch (e) { setProfileError(e instanceof Error ? e.message : tx('Xatolik yuz berdi.','Произошла ошибка.')) }
    finally { setUploadingAvatar(false); event.target.value = '' }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-10"><div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 text-center">{tx('Yuklanmoqda...','Загрузка...')}</div></main>
  if (!r) return <main className="min-h-screen bg-slate-50 p-10"><div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 text-center text-red-600">{error || tx('Rieltor profili topilmadi.','Профиль риелтора не найден.')}</div></main>

  const verified = r.verification_status === 'verified'
  const benefit = benefitPeriod(activeBenefit, ru)
  const avg = leadStats.avgResponseMinutes
  return <main className="min-h-screen bg-slate-50 p-4 py-8 sm:p-10"><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-3"><RealtorCabinetNav /></header>
    <section className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="bg-slate-900 p-7 text-white"><p className="text-xs font-black tracking-[.18em] text-emerald-400">PROFESSIONAL CABINET</p><div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white/30 bg-white/10">{r.avatar_url ? <img src={r.avatar_url} alt={tx('Rieltor rasmi','Фото риелтора')} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl font-black">{r.display_name.slice(0,1).toUpperCase()}</div>}</div><div><h1 className="text-3xl font-black">{r.display_name}</h1><p className="mt-2 text-sm text-slate-300">{r.phone}</p></div></div><span className={`rounded-full px-4 py-2 text-sm font-bold ${verified ? 'bg-emerald-500' : 'bg-amber-400 text-slate-950'}`}>{verified ? tx('✓ Tasdiqlangan','✓ Проверен') : tx('⏳ Tekshiruvda','⏳ На проверке')}</span></div></div>
      <div className="border-b p-6"><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">{tx('Agentlik','Агентство')}</p><p className="mt-2 font-bold">{r.agency_name || tx('Mustaqil rieltor','Независимый риелтор')}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">{tx('Xizmat hududlari','Районы работы')}</p><p className="mt-2 font-bold">{r.service_areas?.length ? r.service_areas.join(', ') : '—'}</p></div></div></div>
      <section className="border-b p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-wider text-emerald-700">{tx('Rieltor profili','Профиль риелтора')}</p><h2 className="mt-1 text-xl font-black">{tx('Ochiq profil ma’lumotlari','Данные публичного профиля')}</h2><p className="mt-1 text-sm text-slate-500">{tx('Mijozlar siz haqingizda ko‘rishi mumkin bo‘lgan ma’lumotlar.','Информация, которую увидят ваши клиенты.')}</p></div>
          {!editingProfile && <button type="button" onClick={()=>{setDraft({display_name:r.display_name||'',bio:r.bio||'',agency_name:r.agency_name||'',experience_years:String(r.experience_years??0),service_areas:(r.service_areas||[]).join(', ')});setEditingProfile(true);setProfileError('');setProfileMessage('')}} className="rounded-xl border px-4 py-2 text-sm font-bold">{tx('Profilni tahrirlash','Редактировать профиль')}</button>}
        </div>
        {profileError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{profileError}</p>}
        {profileMessage && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{profileMessage}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl bg-slate-50 p-4">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-slate-200">{r.avatar_url ? <img src={r.avatar_url} alt={tx('Rieltor profili rasmi','Фото профиля риелтора')} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl font-black text-slate-500">{r.display_name.slice(0,1).toUpperCase()}</div>}</div>
          <div className="min-w-0 flex-1"><p className="font-bold">{tx('Profil rasmi','Фото профиля')}</p><p className="mt-1 text-xs text-slate-500">{tx('JPG, PNG yoki WEBP. Maksimal 5 MB.','JPG, PNG или WEBP. Максимум 5 МБ.')}</p></div>
          <label className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">{uploadingAvatar ? tx('Yuklanmoqda…','Загрузка…') : tx('Rasm yuklash','Загрузить фото')}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingAvatar} onChange={uploadAvatar} className="hidden" /></label>
        </div>
        {editingProfile && <form onSubmit={saveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">{tx('F.I.O.','Ф.И.О.')}<input required maxLength={160} value={draft.display_name} onChange={e=>setDraft(v=>({...v,display_name:e.target.value}))} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
          <label className="text-sm font-bold">{tx('Agentlik','Агентство')}<input maxLength={160} value={draft.agency_name} onChange={e=>setDraft(v=>({...v,agency_name:e.target.value}))} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
          <label className="text-sm font-bold">{tx('Tajriba (yil)','Опыт (лет)')}<input type="number" min="0" max="80" value={draft.experience_years} onChange={e=>setDraft(v=>({...v,experience_years:e.target.value}))} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
          <label className="text-sm font-bold">{tx('Xizmat hududlari (vergul bilan)','Районы работы (через запятую)')}<input value={draft.service_areas} onChange={e=>setDraft(v=>({...v,service_areas:e.target.value}))} placeholder="Toshkent, Chilonzor, Yunusobod" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /></label>
          <label className="text-sm font-bold sm:col-span-2">{tx('O‘zingiz haqingizda qisqacha','Кратко о себе')}<textarea rows={4} maxLength={1200} value={draft.bio} onChange={e=>setDraft(v=>({...v,bio:e.target.value}))} placeholder={tx('Tajriba, yo‘nalishlar, mijozlarga qanday yordam berishingiz haqida yozing…','Расскажите об опыте, специализации и помощи клиентам…')} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" /><span className="mt-1 block text-right text-xs font-normal text-slate-400">{draft.bio.length}/1200</span></label>
          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2"><button type="button" onClick={()=>setEditingProfile(false)} className="rounded-xl border px-4 py-2.5 text-sm font-bold">{tx('Bekor qilish','Отмена')}</button><button type="submit" disabled={savingProfile} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{savingProfile ? tx('Saqlanmoqda…','Сохранение…') : tx('Saqlash','Сохранить')}</button></div>
        </form>}
        {!editingProfile && <div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">{tx('O‘zim haqimda','О себе')}</p><p className="mt-2 whitespace-pre-wrap text-sm">{r.bio || tx('Hozircha ma’lumot kiritilmagan.','Информация пока не добавлена.')}</p></div>}
      </section>
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
