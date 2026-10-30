'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

type Realtor = {
  id: string
  user_id: string
  display_name: string
  phone: string | null
  bio: string | null
  avatar_url: string | null
  experience_years: number
  verification_status: string
  rating: number
  reviews_count: number
  agency_id: string | null
  agency_name: string | null
  service_areas: string[] | null
  listingCount: number
  dealTypes: string[]
  specialties: string[]
  districts: string[]
}
type Agency = { id: string; name: string; slug: string; agentCount: number }
type ListingMeta = { owner_id: string; listing_type: string | null; property_type: string | null; district: string | null }

const text = {
  uz: {
    title: 'Ishonchli rieltorni toping', subtitle: 'Ko‘chmas mulk bo‘yicha tasdiqlangan mutaxassislarni solishtiring va bevosita bog‘laning.',
    realtors: 'Rieltorlar', agencies: 'Ko‘chmas mulk agentliklari', cabinet: 'Rieltor kabineti', join: 'Rieltor bo‘lib qo‘shilish',
    deal: 'Barcha bitim turlari', specialty: 'Barcha ixtisosliklar', district: 'Barcha hududlar', name: 'Rieltor F.I.O.',
    sort: 'Saralash', rating: 'Reyting bo‘yicha', experience: 'Tajriba bo‘yicha', listings: 'E’lonlar soni bo‘yicha',
    found: 'Topildi', realtor: 'rieltor', verified: 'Tasdiqlangan rieltor', years: 'yil tajriba', ads: 'E’lonlari',
    deals: 'Bitim yo‘nalishlari', showPhone: 'Telefon qilish', profile: 'Profilni ko‘rish', noPhone: 'Telefon ko‘rsatilmagan',
    empty: 'Tanlangan shartlarga mos rieltor topilmadi.', loading: 'Rieltorlar yuklanmoqda…', agencyEmpty: 'Hozircha agentliklar mavjud emas.',
    faqTitle: 'Rieltorlar haqida tez-tez so‘raladigan savollar',
    faqs: [
      ['RoyalHouse’da rieltorlar qanday tekshiriladi?', 'Rieltor profili yuborilgan ma’lumotlar asosida administrator tomonidan ko‘rib chiqiladi. Tasdiqlangan mutaxassis profilida “Tasdiqlangan rieltor” belgisi ko‘rinadi.'],
      ['Rieltorning reytingi qanday shakllanadi?', 'Reyting mijozlar qoldirgan baholar va tasdiqlangan fikrlar asosida shakllanadi. Sharhlar soni reyting yonida ko‘rsatiladi.'],
      ['Rieltorning e’lonlarini qayerdan ko‘raman?', 'Rieltor kartasidagi “Profilni ko‘rish” tugmasini bosing. Uning ochiq e’lonlari alohida ro‘yxatda ko‘rsatiladi.'],
      ['Rieltor bilan qanday bog‘lanaman?', 'Rieltor profiliga o‘ting va mavjud aloqa usulidan foydalaning. Telefon raqami faqat rieltor uni ochiq ko‘rsatgan yoki platforma orqali ko‘rsatishga ruxsat bergan holatda beriladi.'],
      ['Hudud va ixtisoslik bo‘yicha qidirish mumkinmi?', 'Ha. Hudud, bitim turi, mulk turi va ism bo‘yicha filtrlar yordamida ro‘yxatni toraytirishingiz mumkin.'],
      ['Agentlik va mustaqil rieltorning farqi nimada?', 'Mustaqil rieltor alohida faoliyat yuritadi. Agentlik profili esa uning jamoasi va agentlarini bir joyda ko‘rsatadi.'],
      ['Rieltor bo‘lib RoyalHouse’ga qanday qo‘shilaman?', '“Rieltor bo‘lib qo‘shilish” tugmasi orqali ariza yuboring. Ma’lumotlar tekshirilgach, profilingiz tasdiqlanadi.'],
    ],
    ru: {
      title: 'Найдите надёжного риелтора', subtitle: 'Сравнивайте проверенных специалистов по недвижимости и связывайтесь напрямую.',
      realtors: 'Риелторы', agencies: 'Агентства недвижимости', cabinet: 'Кабинет риелтора', join: 'Стать риелтором',
      deal: 'Все типы сделок', specialty: 'Все специализации', district: 'Все районы', name: 'ФИО риелтора',
      sort: 'Сортировка', rating: 'По рейтингу', experience: 'По опыту', listings: 'По объявлениям',
      found: 'Найдено', realtor: 'риелторов', verified: 'Проверенный риелтор', years: 'лет опыта', ads: 'Объявления',
      deals: 'Направления сделок', showPhone: 'Позвонить', profile: 'Открыть профиль', noPhone: 'Телефон не указан',
      empty: 'По выбранным условиям риелторы не найдены.', loading: 'Загрузка риелторов…', agencyEmpty: 'Пока нет агентств.',
      faqTitle: 'Часто задаваемые вопросы о риелторах',
      faqs: [
        ['Как RoyalHouse проверяет риелторов?', 'Заявка проверяется администратором. В профиле подтверждённого специалиста отображается отметка «Проверенный риелтор».'],
        ['Как формируется рейтинг риелтора?', 'Рейтинг формируется на основе оценок и отзывов клиентов. Количество отзывов отображается рядом с рейтингом.'],
        ['Где посмотреть объявления риелтора?', 'Откройте профиль риелтора — его публичные объявления будут показаны отдельным списком.'],
        ['Как связаться с риелтором?', 'Перейдите в профиль и воспользуйтесь доступным способом связи. Телефон показывается, если он открыт специалистом или разрешён платформой.'],
        ['Можно ли искать по району и специализации?', 'Да, используйте фильтры по району, типу сделки, типу недвижимости и имени.'],
        ['Чем агентство отличается от частного риелтора?', 'Частный риелтор работает самостоятельно, а профиль агентства объединяет команду и её специалистов.'],
        ['Как стать риелтором RoyalHouse?', 'Отправьте заявку кнопкой «Стать риелтором». После проверки данных профиль будет подтверждён.'],
      ],
    },
  },
  ru: null as any,
} as const

const ruCopy = text.uz.ru

function unique(values: string[]) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function displayDeal(value: string, ru: boolean) {
  const map: Record<string, [string, string]> = {
    sale: ['Sotuv', 'Продажа'], rent: ['Ijara', 'Аренда'], daily_rent: ['Kunlik ijara', 'Посуточная аренда'],
    new_building: ['Yangi qurilish', 'Новостройки'], commercial: ['Tijorat', 'Коммерция'],
  }
  return map[value]?.[ru ? 1 : 0] || value.replaceAll('_', ' ')
}

export default function RealtorsPage() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const t = ru ? ruCopy : text.uz
  const [items, setItems] = useState<Realtor[]>([])
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [tab, setTab] = useState<'realtors' | 'agencies'>('realtors')
  const [deal, setDeal] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [district, setDistrict] = useState('')
  const [name, setName] = useState('')
  const [sort, setSort] = useState('rating')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      setError('')
      const db = createClient()
      const { data, error: realtorError } = await db
        .from('realtor_profiles')
        .select('id,user_id,display_name,phone,bio,avatar_url,experience_years,verification_status,rating,reviews_count,agency_id,agency_name,service_areas')
        .eq('verification_status', 'verified')
        .order('rating', { ascending: false })
      if (realtorError) {
        if (alive) setError(realtorError.message)
        if (alive) setLoading(false)
        return
      }
      const rows = (data || []) as Omit<Realtor, 'listingCount' | 'dealTypes' | 'specialties' | 'districts'>[]
      const ownerIds = rows.map((row) => row.user_id).filter(Boolean)
      let listingRows: ListingMeta[] = []
      if (ownerIds.length) {
        const { data: meta } = await db.from('listing_search')
          .select('owner_id,listing_type,property_type,district')
          .in('owner_id', ownerIds)
        listingRows = (meta || []) as ListingMeta[]
      }
      const byOwner = new Map<string, ListingMeta[]>()
      listingRows.forEach((row) => byOwner.set(row.owner_id, [...(byOwner.get(row.owner_id) || []), row]))
      const enriched: Realtor[] = rows.map((row) => {
        const own = byOwner.get(row.user_id) || []
        return {
          ...row,
          listingCount: own.length,
          dealTypes: unique(own.map((item) => item.listing_type || '')),
          specialties: unique(own.map((item) => item.property_type || '')),
          districts: unique([...((row.service_areas || []) as string[]), ...own.map((item) => item.district || '')]),
        }
      })
      const { data: agencyRows } = await db.from('agency_profiles').select('id,name,slug')
      const agencyList: Agency[] = (agencyRows || []).map((agency: any) => ({
        id: agency.id, name: agency.name, slug: agency.slug,
        agentCount: enriched.filter((realtor) => realtor.agency_id === agency.id).length,
      }))
      if (alive) {
        setItems(enriched)
        setAgencies(agencyList)
        setLoading(false)
      }
    }
    void load().catch((e) => {
      if (alive) { setError(e instanceof Error ? e.message : 'LOAD_FAILED'); setLoading(false) }
    })
    return () => { alive = false }
  }, [])

  const districts = useMemo(() => unique(items.flatMap((r) => r.districts)), [items])
  const specialties = useMemo(() => unique(items.flatMap((r) => r.specialties)), [items])
  const deals = useMemo(() => unique(items.flatMap((r) => r.dealTypes)), [items])
  const filtered = useMemo(() => {
    const q = name.trim().toLocaleLowerCase()
    return items.filter((r) =>
      (!q || [r.display_name, r.agency_name || '', r.bio || ''].join(' ').toLocaleLowerCase().includes(q)) &&
      (!deal || r.dealTypes.includes(deal)) &&
      (!specialty || r.specialties.includes(specialty)) &&
      (!district || r.districts.includes(district))
    ).sort((a, b) => sort === 'experience' ? b.experience_years - a.experience_years : sort === 'listings' ? b.listingCount - a.listingCount : Number(b.rating || 0) - Number(a.rating || 0))
  }, [items, name, deal, specialty, district, sort])

  return <main className="min-h-screen bg-[#f1f3f5] text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-2xl font-black tracking-tight">Royal<span className="text-emerald-600">House</span>.uz</Link>
        <div className="flex flex-wrap gap-2">
          <Link href="/realtors/cabinet" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">{t.cabinet}</Link>
          <Link href="/realtors/cabinet?mode=register" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white">{t.join}</Link>
        </div>
      </div>
    </header>

    <section className="mx-auto max-w-[1440px] px-4 py-7">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab('realtors')} className={`rounded-xl px-5 py-3 text-sm font-bold ${tab === 'realtors' ? 'bg-white text-emerald-700 shadow-sm' : 'bg-slate-200 text-slate-600'}`}>{t.realtors}</button>
        <button onClick={() => setTab('agencies')} className={`rounded-xl px-5 py-3 text-sm font-bold ${tab === 'agencies' ? 'bg-white text-emerald-700 shadow-sm' : 'bg-slate-200 text-slate-600'}`}>{t.agencies}</button>
      </div>

      {tab === 'realtors' && <div className="mt-5 grid gap-2 rounded-2xl bg-white p-3 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <select value={deal} onChange={(e) => setDeal(e.target.value)} className="min-w-0 rounded-xl bg-slate-100 px-4 py-3 text-sm outline-none"><option value="">{t.deal}</option>{deals.map((value) => <option key={value} value={value}>{displayDeal(value, ru)}</option>)}</select>
        <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="min-w-0 rounded-xl bg-slate-100 px-4 py-3 text-sm outline-none"><option value="">{t.specialty}</option>{specialties.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select value={district} onChange={(e) => setDistrict(e.target.value)} className="min-w-0 rounded-xl bg-slate-100 px-4 py-3 text-sm outline-none"><option value="">{t.district}</option>{districts.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} className="min-w-0 rounded-xl bg-slate-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"/>
      </div>}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><h1 className="text-2xl font-black sm:text-3xl">{t.title}</h1><p className="mt-2 text-sm text-slate-500">{t.subtitle}</p></div>
            {tab === 'realtors' && <label className="flex items-center gap-2 text-sm text-slate-600">{t.sort}<select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border-0 bg-transparent font-bold outline-none"><option value="rating">{t.rating}</option><option value="experience">{t.experience}</option><option value="listings">{t.listings}</option></select></label>}
          </div>

          {tab === 'realtors' ? <>
            <div className="mb-3 rounded-2xl bg-white px-5 py-4 text-sm font-semibold">{t.found} <span className="text-emerald-700">{filtered.length}</span> {t.realtor}</div>
            {loading && <div className="rounded-2xl bg-white p-10 text-center text-slate-500">{t.loading}</div>}
            {error && <div className="rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-700">{error}</div>}
            {!loading && !error && filtered.length === 0 && <div className="rounded-2xl bg-white p-10 text-center text-slate-500">{t.empty}</div>}
            <div className="space-y-3">{filtered.map((r) => <article key={r.id} className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-[minmax(230px,1.1fr)_minmax(180px,1fr)_100px_120px] md:items-center">
              <div className="flex min-w-0 items-center gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100">{r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-2xl font-black text-slate-400">{r.display_name?.slice(0,1) || 'R'}</div>}</div>
                <div className="min-w-0"><Link href={`/realtors/${r.id}`} className="font-bold hover:text-emerald-700">{r.display_name}</Link><p className="mt-1 text-xs font-semibold text-emerald-700">✓ {t.verified}</p><p className="mt-1 truncate text-xs text-slate-500">{r.agency_name || (ru ? 'Частный риелтор' : 'Mustaqil rieltor')}</p><p className="mt-1 text-xs text-slate-500">{r.experience_years} {t.years}</p></div>
              </div>
              <div><p className="font-bold">★ {Number(r.rating || 0).toFixed(1)} <span className="text-xs font-normal text-slate-500">({r.reviews_count || 0})</span></p><p className="mt-2 line-clamp-2 text-xs text-slate-500">{r.bio || (ru ? 'Специалист по недвижимости' : 'Ko‘chmas mulk mutaxassisi')}</p><div className="mt-2 flex flex-wrap gap-1">{r.dealTypes.slice(0,2).map((v) => <span key={v} className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">{displayDeal(v, ru)}</span>)}</div></div>
              <div className="text-sm"><p className="text-xs text-slate-500">{t.ads}</p><p className="mt-1 text-xl font-black">{r.listingCount}</p></div>
              <div className="flex flex-col gap-2">{r.phone ? <a href={`tel:${r.phone.replace(/[^+\\d]/g, '')}`} className="rounded-lg bg-emerald-600 px-3 py-2.5 text-center text-sm font-bold text-white">{t.showPhone}</a> : <span className="rounded-lg bg-slate-100 px-3 py-2.5 text-center text-xs text-slate-500">{t.noPhone}</span>}<Link href={`/realtors/${r.id}`} className="rounded-lg bg-slate-100 px-3 py-2.5 text-center text-sm font-semibold">{t.profile}</Link></div>
            </article>)}</div>
          </> : <div className="grid gap-3 sm:grid-cols-2">{agencies.map((agency) => <Link key={agency.id} href={`/agencies/${agency.slug}`} className="rounded-2xl bg-white p-6 shadow-sm hover:shadow-md"><h2 className="text-lg font-black">{agency.name}</h2><p className="mt-2 text-sm text-slate-500">{agency.agentCount} {ru ? 'риелторов' : 'nafar rieltor'}</p><span className="mt-4 inline-block text-sm font-bold text-emerald-700">{ru ? 'Открыть агентство →' : 'Agentlikni ko‘rish →'}</span></Link>)}{!loading && agencies.length === 0 && <div className="rounded-2xl bg-white p-8 text-slate-500">{t.agencyEmpty}</div>}</div>}
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-emerald-700">ROYALHOUSE</p><h2 className="mt-2 text-lg font-black">{ru ? 'Вы риелтор?' : 'Siz rieltormisiz?'}</h2><p className="mt-2 text-sm text-slate-500">{ru ? 'Создайте профессиональный профиль и получайте обращения клиентов.' : 'Professional profilingizni yarating va mijozlardan murojaatlar oling.'}</p><Link href="/realtors/cabinet?mode=register" className="mt-4 block rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white">{t.join}</Link></div>
          <div className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="font-black">{ru ? 'Ищете недвижимость?' : 'Uy-joy qidiryapsizmi?'}</h2><p className="mt-2 text-sm text-slate-500">{ru ? 'Посмотрите актуальные предложения на RoyalHouse.' : 'RoyalHouse’dagi yangi e’lonlarni ko‘ring.'}</p><Link href="/listings" className="mt-3 inline-block text-sm font-bold text-emerald-700">{ru ? 'Смотреть объявления →' : 'E’lonlarni ko‘rish →'}</Link></div>
        </aside>
      </div>
    </section>

    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-[1440px] px-4 py-12">
        <h2 className="text-2xl font-black">{t.faqTitle}</h2>
        <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {t.faqs.map(([question, answer]) => <details key={question} className="group px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:hidden">{question}<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 transition group-open:rotate-180">⌄</span></summary>
            <p className="max-w-4xl pt-3 text-sm leading-6 text-slate-600">{answer}</p>
          </details>)}
        </div>
        <div className="mt-8 flex flex-wrap gap-4 border-t border-slate-100 pt-6 text-sm text-slate-500"><Link href="/" className="hover:text-emerald-700">RoyalHouse</Link><Link href="/listings" className="hover:text-emerald-700">{ru ? 'Объявления' : 'E’lonlar'}</Link><Link href="/agencies" className="hover:text-emerald-700">{t.agencies}</Link><Link href="/realtors/tariffs" className="hover:text-emerald-700">{ru ? 'Тарифы риелторов' : 'Rieltor tariflari'}</Link></div>
      </div>
    </section>
  </main>
}
