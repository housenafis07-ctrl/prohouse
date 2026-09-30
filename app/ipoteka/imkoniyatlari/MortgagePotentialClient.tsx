'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { mortgagePrograms } from '@/lib/mortgage-programs'
import { loanFromPayment } from '@/lib/mortgage-affordability'
import { useI18n } from '@/app/components/I18nProvider'
import MortgageMap from '@/app/ipoteka/_components/MortgageMap'

type Tool = 'homes' | 'banks' | 'map' | null

type Listing = {
  id: string
  title?: string | null
  title_ru?: string | null
  price?: number | null
  currency?: string | null
  area_m2?: number | null
  rooms?: number | null
  city?: string | null
  district?: string | null
  latitude?: number | null
  longitude?: number | null
  primary_image?: { image_url?: string | null } | null
  is_mortgage_available?: boolean | null
}

const money = (value: number, lang: 'uz' | 'ru') =>
  new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { maximumFractionDigits: 0 })
    .format(Math.max(0, Math.round(value)))

const monthlyPayment = (principal: number, annualRate: number, months: number) => {
  if (principal <= 0 || months <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) return principal / months
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

const normalize = (value: string) => value.replace(/\D/g, '')

export default function MortgagePotentialClient() {
  const router = useRouter()
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const tx = (uz: string, ruText: string) => (ru ? ruText : uz)

  const [income, setIncome] = useState('')
  const [existingCredits, setExistingCredits] = useState('')
  const [downPayment, setDownPayment] = useState('')
  const [rate, setRate] = useState('21.5')
  const [years, setYears] = useState('20')
  const [coBorrowerOpen, setCoBorrowerOpen] = useState(false)
  const [coBorrowerIncome, setCoBorrowerIncome] = useState('')
  const [coBorrowerCredits, setCoBorrowerCredits] = useState('')
  const [calculated, setCalculated] = useState(false)
  const [tool, setTool] = useState<Tool>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [listingsLoading, setListingsLoading] = useState(false)
  const [listingsError, setListingsError] = useState('')

  const result = useMemo(() => {
    const totalIncome = Number(income || 0) + Number(coBorrowerIncome || 0)
    const totalExisting = Number(existingCredits || 0) + Number(coBorrowerCredits || 0)
    const debtLimit = totalIncome * 0.5
    const mortgagePayment = Math.max(0, debtLimit - totalExisting)
    const months = Math.max(12, (Number(years || 20) || 20) * 12)
    const maxLoan = loanFromPayment(mortgagePayment, Number(rate || 0), months)
    const maxHome = maxLoan + Number(downPayment || 0)
    const debtRatio = totalIncome > 0
      ? ((totalExisting + mortgagePayment) / totalIncome) * 100
      : 0

    return {
      totalIncome,
      totalExisting,
      debtLimit,
      mortgagePayment,
      maxLoan,
      maxHome,
      debtRatio,
      months,
      downPayment: Number(downPayment || 0),
      rate: Number(rate || 0),
    }
  }, [income, existingCredits, downPayment, rate, years, coBorrowerIncome, coBorrowerCredits])

  const canCalculate =
    Number(income) > 0 &&
    Number(downPayment) >= 0 &&
    Number(rate) >= 0 &&
    Number(years) > 0

  const matchingBanks = useMemo(() => {
    const requestedLoan = result.maxLoan
    const requestedDownPct = result.maxHome > 0
      ? (result.downPayment / result.maxHome) * 100
      : 0

    return mortgagePrograms
      .filter((program) => {
        const amountOk = !program.maxAmount || requestedLoan <= program.maxAmount
        const downOk = requestedDownPct >= program.downPaymentMin
        return amountOk && downOk
      })
      .map((program) => {
        const rateDistance =
          result.rate >= program.rateMin && result.rate <= program.rateMax
            ? 0
            : Math.min(
                Math.abs(result.rate - program.rateMin),
                Math.abs(result.rate - program.rateMax),
              )
        const termDistance = Math.abs(program.termMonths - result.months) / 12
        const amountDistance = program.maxAmount
          ? Math.max(0, requestedLoan - program.maxAmount) / Math.max(1, requestedLoan)
          : 0
        const score = rateDistance * 8 + termDistance * 0.35 + amountDistance * 100
        return { program, score }
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 12)
  }, [result])

  const loadListings = async () => {
    if (!result.maxHome) return
    setListingsLoading(true)
    setListingsError('')
    try {
      const params = new URLSearchParams({
        tab: 'sale',
        mortgage: 'true',
        max: String(Math.round(result.maxHome)),
        limit: '24',
        sort: 'priceLow',
      })
      const response = await fetch('/api/listings/search?' + params.toString(), { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Listings request failed')
      setListings(Array.isArray(payload?.data) ? payload.data : [])
    } catch {
      setListingsError(
        tx(
          'Mos e’lonlarni yuklashda xatolik yuz berdi.',
          'Не удалось загрузить подходящие объявления.',
        ),
      )
      setListings([])
    } finally {
      setListingsLoading(false)
    }
  }

  useEffect(() => {
    if (tool === 'homes' || tool === 'map') void loadListings()
  }, [tool, result.maxHome])

  useEffect(() => {
    const syncTool = () => {
      const value = new URLSearchParams(window.location.search).get('tool')
      setTool(value === 'homes' || value === 'banks' || value === 'map' ? value : null)
    }
    syncTool()
    window.addEventListener('popstate', syncTool)
    return () => window.removeEventListener('popstate', syncTool)
  }, [])

  const openTool = (nextTool: Exclude<Tool, null>) => {
    if (!calculated) return
    setTool(nextTool)
    window.history.pushState({ tool: nextTool }, '', '?tool=' + nextTool)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const backToCalculator = () => {
    setTool(null)
    window.history.pushState({}, '', window.location.pathname)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toolCards = [
    {
      id: 'homes' as const,
      icon: '🏠',
      title: tx('1. Siz qancha uy olishingiz mumkin?', '1. Сколько жилья вам по карману?'),
      text: tx(
        'Hisoblangan budjetingizga mos ipotekali e’lonlar ro‘yxati.',
        'Список ипотечных объектов в рассчитанном вами бюджете.',
      ),
    },
    {
      id: 'banks' as const,
      icon: '💳',
      title: tx('2. Ipoteka imkoniyatlari', '2. Ипотечные возможности'),
      text: tx(
        'Sizning summa, stavka va muddatingizga mos bank dasturlari.',
        'Банковские программы под вашу сумму, ставку и срок.',
      ),
    },
    {
      id: 'map' as const,
      icon: '🗺️',
      title: tx('3. Menga mos uylar', '3. Подходящие мне объекты'),
      text: tx(
        'Ipotekaga mumkin bo‘lgan va sizning budjetingizdan oshmaydigan uylar xaritada.',
        'Ипотечные объекты на карте в пределах вашего бюджета.',
      ),
    },
  ]

  const summary = (
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-bold text-slate-500">{tx('Uy budjeti', 'Бюджет жилья')}</p>
        <p className="mt-1 text-lg font-black text-slate-950">{money(result.maxHome, lang)} {ru ? 'сум' : 'so‘m'}</p>
      </div>
      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-bold text-slate-500">{tx('Ipoteka summasi', 'Сумма ипотеки')}</p>
        <p className="mt-1 text-lg font-black text-slate-950">{money(result.maxLoan, lang)} {ru ? 'сум' : 'so‘m'}</p>
      </div>
      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-bold text-slate-500">{tx('Boshlang‘ich badal', 'Первоначальный взнос')}</p>
        <p className="mt-1 text-lg font-black text-slate-950">{money(result.downPayment, lang)} {ru ? 'сум' : 'so‘m'}</p>
      </div>
      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-bold text-slate-500">{tx('Stavka / muddat', 'Ставка / срок')}</p>
        <p className="mt-1 text-lg font-black text-slate-950">{result.rate}% / {Number(years || 20)} {ru ? 'лет' : 'yil'}</p>
      </div>
    </div>
  )

  const renderTool = () => {
    if (!tool) return null

    if (tool === 'banks') {
      return (
        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">ROYALHOUSE</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">{tx('Sizga mos ipoteka dasturlari', 'Подходящие ипотечные программы')}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                {tx(
                  'Banklar siz kiritgan uy budjeti, boshlang‘ich badal, stavka va muddatga nisbatan saralandi.',
                  'Программы отсортированы по вашему бюджету, первоначальному взносу, ставке и сроку.',
                )}
              </p>
            </div>
            <button type="button" onClick={backToCalculator} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700">
              ← {tx('Kalkulyatorga qaytish', 'Вернуться к расчёту')}
            </button>
          </div>

          <div className="mt-5">{summary}</div>

          <div className="mt-6 space-y-3">
            {matchingBanks.length ? matchingBanks.map(({ program }) => (
              <article key={program.id} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-emerald-300">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{program.bankShort}</span>
                      <h3 className="font-black text-slate-950">{program.bank}</h3>
                    </div>
                    <p className="mt-1 font-bold text-slate-700">{ru ? program.programRu : program.program}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{ru ? program.descriptionRu : program.description}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[390px]">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">{tx('Stavka', 'Ставка')}</p>
                      <p className="text-sm font-black">{program.rateLabel}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">{tx('Badal', 'Взнос')}</p>
                      <p className="text-sm font-black">{program.downPaymentLabel}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[11px] text-slate-500">{tx('Muddat', 'Срок')}</p>
                      <p className="text-sm font-black">{Math.round(program.termMonths / 12)} {ru ? 'лет' : 'yil'}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-xs font-bold text-slate-500">{tx('Maksimal summa', 'Максимальная сумма')}: {program.maxAmount ? money(program.maxAmount, lang) : tx('Shartlarga ko‘ra', 'По условиям')}</span>
                  <a href={program.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-emerald-700 hover:underline">
                    {tx('Bank shartlari', 'Условия банка')} ↗
                  </a>
                </div>
              </article>
            )) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-800">
                {tx(
                  'Kiritilgan shartlarga to‘liq mos dastur topilmadi. Kalkulyatordagi stavka yoki boshlang‘ich badalni o‘zgartirib qayta hisoblang.',
                  'Программа, полностью соответствующая введённым условиям, не найдена. Измените ставку или первоначальный взнос и пересчитайте.',
                )}
              </div>
            )}
          </div>
        </section>
      )
    }

    const validMapItems = listings.filter(
      (item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)),
    )

    return (
      <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">ROYALHOUSE</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {tool === 'homes'
                ? tx('Sizga mos uylar', 'Подходящие вам объекты')
                : tx('Menga mos uylar — xarita', 'Подходящие мне объекты — карта')}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {tx(
                'Faqat “Ipotekaga mumkin” belgisi qo‘yilgan faol sotuv e’lonlari siz hisoblagan uy budjetidan oshmagan holda ko‘rsatiladi.',
                'Показываем только активные объявления с отметкой «Ипотека возможна» и ценой не выше рассчитанного вами бюджета.',
              )}
            </p>
          </div>
          <button type="button" onClick={backToCalculator} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-700">
            ← {tx('Kalkulyatorga qaytish', 'Вернуться к расчёту')}
          </button>
        </div>

        <div className="mt-5">{summary}</div>

        {listingsLoading ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
            {tx('Mos e’lonlar yuklanmoqda…', 'Загружаем подходящие объекты…')}
          </div>
        ) : listingsError ? (
          <div className="mt-6 rounded-2xl bg-rose-50 p-5 text-sm font-bold text-rose-700">{listingsError}</div>
        ) : tool === 'map' ? (
          <div className="mt-6">
            {validMapItems.length ? (
              <MortgageMap items={validMapItems} market="secondary" />
            ) : (
              <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
                {tx('Hisoblangan budjetda koordinatasi mavjud ipotekali uylar topilmadi.', 'В рассчитанном бюджете не найдено ипотечных объектов с координатами.')}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6">
            {listings.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((listing) => {
                  const title = ru ? (listing.title_ru || listing.title || 'Royalhouse') : (listing.title || listing.title_ru || 'Royalhouse')
                  const location = [listing.city, listing.district].filter(Boolean).join(', ')
                  return (
                    <Link key={listing.id} href={'/listings/' + listing.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
                      <div className="aspect-[4/3] bg-slate-100">
                        {listing.primary_image?.image_url ? (
                          <img src={listing.primary_image.image_url} alt={title} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-4xl">🏠</div>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="line-clamp-2 min-h-10 font-black text-slate-950">{title}</p>
                        <p className="mt-2 text-lg font-black text-emerald-700">{money(Number(listing.price || 0), lang)} {ru ? 'сум' : 'so‘m'}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-slate-500">
                          {listing.area_m2 ? <span>{listing.area_m2} м²</span> : null}
                          {listing.rooms ? <span>{listing.rooms} {tx('xona', 'комн.')}</span> : null}
                          {location ? <span>{location}</span> : null}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50 p-8 text-center">
                <div className="text-4xl">🏠</div>
                <h3 className="mt-3 text-lg font-black text-slate-900">{tx('Mos e’lon topilmadi', 'Подходящие объявления не найдены')}</h3>
                <p className="mt-1 text-sm text-slate-500">{tx('Boshlang‘ich badalni oshirib yoki uy budjetini o‘zgartirib qayta hisoblab ko‘ring.', 'Попробуйте изменить первоначальный взнос или пересчитать бюджет жилья.')}</p>
              </div>
            )}
          </div>
        )}
      </section>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <button
            type="button"
            onClick={() => {
              if (tool) {
                backToCalculator()
                return
              }
              if (window.history.length > 1) router.back()
              else router.push('/ipoteka')
            }}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
          >
            ← {tx('Orqaga', 'Назад')}
          </button>
          <button type="button" onClick={() => router.push('/')} className="flex items-center gap-2">
            <img src="/royalhouse-icon.svg" alt="Royalhouse" className="h-9 w-9 rounded-xl" />
            <span className="text-xl font-black text-slate-900">Royal<span className="text-emerald-500">house</span></span>
          </button>
        </div>
      </header>

      <section className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 text-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">IPOTEKA</span>
          <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
            {tx('Ipoteka imkoniyatingizni hisoblang', 'Рассчитайте свои ипотечные возможности')}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50 sm:text-lg">
            {tx(
              'Avval kalkulyatorni to‘ldiring. Hisob-kitob tugagach, sizga mos uylar, banklar va xaritani oching.',
              'Сначала заполните калькулятор. После расчёта откроются подходящие объекты, банки и карта.',
            )}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pt-8 sm:pt-10">
        <section className="overflow-hidden rounded-3xl bg-slate-950 shadow-xl ring-1 ring-slate-800">
          <video
            className="block h-auto w-full"
            src="/videos/ipoteka.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            controls={false}
            aria-label="Royalhouse ipoteka imkoniyatlari"
          />
        </section>
      </div>

      {!tool ? (
        <>
          <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
                <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">KALKULYATOR</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{tx('Ma’lumotlaringiz', 'Ваши данные')}</h2>
                <p className="mt-1 text-sm text-slate-500">{tx('Hisob-kitob dastlabki taxmin hisoblanadi.', 'Расчёт является предварительным.')}</p>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">{tx('Jami oylik daromad', 'Общий ежемесячный доход')}</span>
                    <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-emerald-400 focus-within:bg-white">
                      <input value={income} onChange={e => setIncome(normalize(e.target.value))} inputMode="numeric" placeholder="12 000 000" className="w-full bg-transparent py-3.5 text-base font-bold outline-none" />
                      <span className="text-sm font-bold text-slate-400">{ru ? 'сум' : 'so‘m'}</span>
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">{tx('Har oylik mavjud kreditlar to‘lovi', 'Текущие ежемесячные платежи по кредитам')}</span>
                    <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-emerald-400 focus-within:bg-white">
                      <input value={existingCredits} onChange={e => setExistingCredits(normalize(e.target.value))} inputMode="numeric" placeholder="2 000 000" className="w-full bg-transparent py-3.5 text-base font-bold outline-none" />
                      <span className="text-sm font-bold text-slate-400">{ru ? 'сум' : 'so‘m'}</span>
                    </div>
                    <span className="mt-1.5 block text-xs text-slate-400">{tx('Boshqa banklardagi kreditlar va majburiy oylik to‘lovlar.', 'Кредиты в других банках и обязательные ежемесячные платежи.')}</span>
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">{tx('Boshlang‘ich badal', 'Первоначальный взнос')}</span>
                    <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-emerald-400 focus-within:bg-white">
                      <input value={downPayment} onChange={e => setDownPayment(normalize(e.target.value))} inputMode="numeric" placeholder="150 000 000" className="w-full bg-transparent py-3.5 text-base font-bold outline-none" />
                      <span className="text-sm font-bold text-slate-400">{ru ? 'сум' : 'so‘m'}</span>
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">{tx('Taxminiy yillik stavka', 'Ориентировочная годовая ставка')}</span>
                    <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4">
                      <input value={rate} onChange={e => setRate(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className="w-full bg-transparent py-3.5 text-base font-bold outline-none" />
                      <span className="text-sm font-bold text-slate-400">%</span>
                    </div>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-sm font-bold text-slate-700">{tx('Ipoteka muddati', 'Срок ипотеки')}</span>
                    <select value={years} onChange={e => setYears(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold outline-none focus:border-emerald-400">
                      {[5, 7, 10, 15, 20].map(y => <option key={y} value={y}>{y} {ru ? 'лет' : 'yil'}</option>)}
                    </select>
                  </label>
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                  <button type="button" onClick={() => setCoBorrowerOpen(v => !v)} className="flex w-full items-center justify-between px-4 py-4 text-left hover:bg-slate-50">
                    <span>
                      <span className="block font-black text-slate-900">{tx('Birgalikda qarz oluvchi / turmush o‘rtog‘i', 'Созаемщик / супруг(а)')}</span>
                      <span className="mt-1 block text-xs text-slate-500">{tx('Daromadini hisobga qo‘shish uchun oching', 'Откройте, чтобы добавить доход')}</span>
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-xl font-bold text-emerald-700">{coBorrowerOpen ? '−' : '+'}</span>
                  </button>

                  {coBorrowerOpen && (
                    <div className="grid gap-4 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                      <label>
                        <span className="text-sm font-bold text-slate-700">{tx('Qo‘shiladigan oylik daromad', 'Дополнительный ежемесячный доход')}</span>
                        <input value={coBorrowerIncome} onChange={e => setCoBorrowerIncome(normalize(e.target.value))} inputMode="numeric" placeholder="5 000 000" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-bold outline-none focus:border-emerald-400" />
                      </label>
                      <label>
                        <span className="text-sm font-bold text-slate-700">{tx('Uning mavjud kredit to‘lovi', 'Его/её текущий платёж по кредитам')}</span>
                        <input value={coBorrowerCredits} onChange={e => setCoBorrowerCredits(normalize(e.target.value))} inputMode="numeric" placeholder="1 000 000" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-bold outline-none focus:border-emerald-400" />
                      </label>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!canCalculate}
                  onClick={() => {
                    setCalculated(true)
                    setTool(null)
                    window.history.pushState({}, '', window.location.pathname)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tx('Ipoteka imkoniyatini hisoblash', 'Рассчитать ипотечные возможности')}
                </button>
              </section>

              <aside className="h-fit rounded-3xl bg-slate-950 p-6 text-white shadow-xl lg:sticky lg:top-6">
                <p className="text-sm font-bold text-emerald-300">{tx('Sizning taxminiy imkoniyatingiz', 'Ваши ориентировочные возможности')}</p>
                {!calculated ? (
                  <div className="py-12">
                    <div className="text-5xl">🏠</div>
                    <h2 className="mt-5 text-2xl font-black">{tx('Hisoblashni boshlang', 'Введите данные для расчёта')}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{tx('Daromad va mavjud kreditlarni kiriting. Royalhouse 50% qarz yuklamasi chegarasidan kelib chiqib hisoblaydi.', 'Введите доход и текущие кредиты. Royalhouse рассчитывает ориентир исходя из 50% долговой нагрузки.')}</p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{tx('Maksimal jami oylik kredit to‘lovi', 'Максимальный общий ежемесячный платёж')}</p>
                      <p className="mt-1 text-2xl font-black">{money(result.debtLimit, lang)} {ru ? 'сум' : 'so‘m'}</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-4">
                      <p className="text-xs font-bold text-slate-400">{tx('Mavjud kreditlardan keyin ipoteka uchun', 'Доступно для ипотеки после текущих кредитов')}</p>
                      <p className="mt-1 text-3xl font-black text-emerald-300">{money(result.mortgagePayment, lang)} {ru ? 'сум/мес.' : 'so‘m/oy'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{tx('Taxminiy maksimal ipoteka', 'Ориентировочная максимальная ипотека')}</p>
                      <p className="mt-1 text-2xl font-black">{money(result.maxLoan, lang)} {ru ? 'сум' : 'so‘m'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{tx('Boshlang‘ich badal bilan uy qiymati', 'Стоимость жилья с первоначальным взносом')}</p>
                      <p className="mt-1 text-2xl font-black">{money(result.maxHome, lang)} {ru ? 'сум' : 'so‘m'}</p>
                    </div>
                    <div className="border-t border-white/10 pt-4 text-sm text-slate-400">
                      {tx('Jami qarz yuklamasi:', 'Общая долговая нагрузка:')} <span className="font-bold text-white">{result.debtRatio.toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
          <div className="mx-auto max-w-5xl px-4 pt-6 sm:pt-8">
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">1-BOSQICH</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{tx('Avval kalkulyatorni hisoblang', 'Сначала выполните расчёт')}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {tx('Natija chiqqach, pastdagi 1, 2 va 3 oynalar avtomatik faollashadi.', 'После расчёта три следующих шага автоматически станут активными.')}
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {toolCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    disabled={!calculated}
                    onClick={() => openTool(card.id)}
                    className={[
                      'text-left rounded-2xl border p-4 transition',
                      calculated
                        ? 'cursor-pointer border-emerald-300 bg-white hover:-translate-y-0.5 hover:border-emerald-500 hover:shadow-md'
                        : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-55',
                      card.id === 'banks' && calculated ? 'ring-1 ring-emerald-500' : '',
                    ].join(' ')}
                  >
                    <span className="text-2xl">{card.icon}</span>
                    <h3 className="mt-2 font-black text-slate-950">{card.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{card.text}</p>
                    {calculated ? (
                      <span className="mt-3 inline-flex rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                        {tx('Ochish →', 'Открыть →')}
                      </span>
                    ) : (
                      <span className="mt-3 inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-400">
                        {tx('Hisoblang', 'Сначала рассчитайте')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          </div>

        </>
      ) : (
        <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
          <button type="button" onClick={backToCalculator} className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700">
            ← {tx('Kalkulyatorga qaytish', 'Вернуться к калькулятору')}
          </button>
          {renderTool()}
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 pb-10">
        <p className="text-xs leading-5 text-slate-400">
          {tx(
            'Eslatma: bu Royalhouse’ning dastlabki hisob-kitobi. Bankning yakuniy qarori daromadni tasdiqlash, kredit tarixi, qarz yuklamasi va tanlangan ipoteka dasturi shartlariga bog‘liq.',
            'Важно: это предварительный расчёт Royalhouse. Окончательное решение банка зависит от подтверждения дохода, кредитной истории, долговой нагрузки и условий выбранной ипотечной программы.',
          )}
        </p>
      </div>
    </main>
  )
}
