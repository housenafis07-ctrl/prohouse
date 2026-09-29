'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getMortgagePrograms,
  type MortgageMarket,
  type MortgageProgram,
} from '@/lib/mortgage-programs'
import MortgageMap from './MortgageMap'

const money = (n: number) =>
  new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' so‘m'

function payment(principal: number, rate: number, months: number) {
  if (principal <= 0 || months <= 0) return 0
  const r = rate / 100 / 12
  if (!r) return principal / months
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

const infoImages = [
  'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=82',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=82',
  'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=900&q=82',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=82',
]

export default function MortgageMarketPage({ market }: { market: MortgageMarket }) {
  const [lang, setLang] = useState<'uz' | 'ru'>('uz')
  const [selected, setSelected] = useState<MortgageProgram | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [listing, setListing] = useState<any>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [price, setPrice] = useState('')
  const [down, setDown] = useState('')
  const [years, setYears] = useState('15')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [mapItems, setMapItems] = useState<any[]>([])
  const router = useRouter()

  const programs = useMemo(() => getMortgagePrograms(market), [market])

  useEffect(() => {
    const l = window.localStorage.getItem('prohouse-lang')
    if (l === 'ru') setLang('ru')
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const listingId = params.get('listingId')
    if (!listingId) return

    fetch('/api/mortgage/listing?id=' + encodeURIComponent(listingId))
      .then((r) => r.json())
      .then((d) => {
        if (d.listing) {
          setListing(d.listing)
          setPrice(String(d.listing.price))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/mortgage/listings?market=' + market)
      .then((r) => r.json())
      .then((d) => setMapItems(d.listings || []))
      .catch(() => {})
  }, [market])

  const t =
    lang === 'ru'
      ? {
          eyebrow: 'ИПОТЕКА',
          title:
            market === 'secondary'
              ? 'Ипотека на вторичном рынке'
              : 'Ипотека на новостройку',
          sub: 'Сравните программы банков, изучите основные условия и сразу рассчитайте примерный платёж.',
          back: 'Назад',
          home: 'На главную',
          introTitle: 'Коротко об ипотеке',
          intro: [
            ['Подберите подходящую программу', 'Сравните ставку, первоначальный взнос, срок и максимальную сумму.'],
            ['Рассчитайте ежемесячный платёж', 'Введите стоимость жилья и первоначальный взнос — калькулятор покажет ориентировочный платёж.'],
            ['Выберите подходящий объект', 'На карте отображаются активные объявления Royalhouse с отметкой «Ипотека возможна».'],
            ['Оставьте заявку', 'После выбора программы ваши данные и расчёт поступят менеджеру Royalhouse.'],
          ],
          programs: 'Ипотечные программы банков',
          programHint: 'Нажмите на название банка или «Подробнее», чтобы открыть полные условия.',
          detail: 'Подробнее',
          calc: 'Рассчитать ипотеку',
          rate: 'Ставка',
          down: 'Первоначальный взнос',
          term: 'Срок',
          max: 'Максимальная сумма',
          map: 'Подходящие объекты на карте',
          mapHint: 'Только активные объявления, отмеченные в личном кабинете как подходящие для ипотеки.',
          name: 'Имя',
          phone: 'Телефон',
          price: 'Стоимость недвижимости',
          submit: 'Подать заявку',
          success: 'Заявка отправлена. Менеджер Royalhouse свяжется с вами.',
          source: 'Официальный источник',
        }
      : {
          eyebrow: 'IPOTEKA',
          title:
            market === 'secondary'
              ? 'Ipoteka na ikkilamchi bozorda'
              : 'Ipoteka yangi qurilishga',
          sub: 'Bank dasturlarini solishtiring, asosiy shartlarni ko‘ring va taxminiy oylik to‘lovni hisoblang.',
          back: 'Orqaga',
          home: 'Asosiy sahifa',
          introTitle: 'Ipoteka haqida qisqacha',
          intro: [
            ['Mos dasturni tanlang', 'Foiz stavkasi, boshlang‘ich badal, muddat va maksimal summani solishtiring.'],
            ['Oylik to‘lovni hisoblang', 'Uy narxi va boshlang‘ich badalni kiriting — kalkulyator taxminiy to‘lovni ko‘rsatadi.'],
            ['Mos uyni xaritadan toping', 'Xaritada Royalhouse’da “Ipotekaga mumkin” belgisi qo‘yilgan faol e’lonlar ko‘rsatiladi.'],
            ['Ariza yuboring', 'Tanlangan dastur bo‘yicha ma’lumotlaringiz Royalhouse menejeriga yuboriladi.'],
          ],
          programs: 'Banklarning ipoteka dasturlari',
          programHint: 'Bank nomi yoki “Batafsil” tugmasini bosing — to‘liq shartlar ochiladi.',
          detail: 'Batafsil',
          calc: 'Ipotekani hisoblash',
          rate: 'Foiz stavkasi',
          down: 'Boshlang‘ich badal',
          term: 'Muddat',
          max: 'Maksimal summa',
          map: 'Mos obyektlar xaritasi',
          mapHint: 'Faqat shaxsiy kabinetda “Ipotekaga mumkin” deb belgilangan faol e’lonlar.',
          name: 'Ism',
          phone: 'Telefon',
          price: 'Uy narxi',
          submit: 'Buyurtma yuborish',
          success: 'Ariza yuborildi. Royalhouse menejeri siz bilan bog‘lanadi.',
          source: 'Rasmiy manba',
        }

  const bankLogos: Record<string, string> = {
    'Xalq banki': 'https://xb.uz/favicon.ico',
    'Ipoteka-bank': 'https://www.ipotekabank.uz/favicon.ico',
    'Trastbank': 'https://trastbank.uz/favicon.ico',
    'Asakabank': 'https://asakabank.uz/favicon.ico',
    'O‘zbekiston Milliy banki': 'https://www.triathlon.uz/storage/photos/1/partners/11.jpg',
    'Biznesni rivojlantirish banki (BRB)': 'https://cabinet.brb.uz/PersonalCabinet/assets/images/brb-logo.svg',
    'Agrobank': 'https://agrobank.uz/favicon.ico',
    'O‘zsanoatqurilishbank (SQB)': 'https://www.sqb.uz/upload/img/footer_main_logo.png',
    'Octobank': 'https://octobank.uz/favicon.ico',
    'Ipak Yo‘li Bank': 'https://ipakyulibank.uz/favicon.ico',
    'Aloqabank': 'https://aloqabank.uz/favicon.ico',
    'Tenge Bank': 'https://tengebank.uz/favicon.ico',
    'Hamkorbank': 'https://hamkorbank.uz/favicon.ico',
    'Mikrokreditbank (MKBank)': 'https://mkbank.uz/favicon.ico',
  }

  const siteLogo = (bank: string, sourceUrl: string) => {
    try {
      return bankLogos[bank] || new URL(sourceUrl).origin + '/favicon.ico'
    } catch {
      return ''
    }
  }

  const logoFallback = (bank: string) => {
    const labels: Record<string, string> = {
      'O‘zbekiston Milliy banki': 'NBU',
      'Biznesni rivojlantirish banki (BRB)': 'BRB',
      'O‘zsanoatqurilishbank (SQB)': 'SQB',
      'Octobank': 'O',
      'Ipak Yo‘li Bank': 'IY',
    }
    return labels[bank] || bank.slice(0, 2).toUpperCase()
  }

  const openProgram = (program: MortgageProgram) => {
    setExpandedId(program.id)
    setSelected(program)
    setSent(false)
    setError('')
    setDown(
      listing?.price
        ? String(Math.round(Number(listing.price) * (program.downPaymentMin / 100)))
        : ''
    )
    if (listing?.price) setPrice(String(listing.price))
  }

  const submit = async () => {
    setError('')
    if (!selected || !name || !phone || !Number(price) || !Number(down)) {
      setError(
        lang === 'ru'
          ? 'Заполните имя, телефон, стоимость и первоначальный взнос.'
          : 'Ism, telefon, uy narxi va boshlang‘ich badalni kiriting.'
      )
      return
    }

    const rate = selected.rateMin
    const months = Math.max(12, Number(years) * 12)
    const monthly = payment(Number(price) - Number(down), rate, months)

    const r = await fetch('/api/mortgage/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programId: selected.id,
        market,
        listingId: listing?.id,
        name,
        phone,
        propertyPrice: Number(price),
        downPayment: Number(down),
        termMonths: months,
        rate,
        monthlyPayment: monthly,
      }),
    })

    const d = await r.json()
    if (!r.ok) {
      setError(d.error || 'Xatolik')
      return
    }
    setSent(true)
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-600 text-white">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-5 sm:pb-16">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (window.history.length > 1) router.back()
                  else router.push('/ipoteka')
                }}
                className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur hover:bg-white/20"
              >
                ← {t.back}
              </button>
              <Link
                href="/"
                className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur hover:bg-white/20"
              >
                ⌂ {t.home}
              </Link>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">
              {market === 'secondary'
                ? 'Ikkilamchi bozor / Вторичный рынок'
                : 'Yangi qurilish / Новостройка'}
            </span>
          </div>

          <p className="text-sm font-black tracking-[.2em] text-emerald-100">{t.eyebrow}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            {t.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-emerald-50 sm:text-lg">
            {t.sub}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <section>
          <div className="mb-5">
            <h2 className="text-2xl font-black sm:text-3xl">{t.introTitle}</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.intro.map(([title, description], index) => (
              <article
                key={title}
                className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"
              >
                <div className="relative h-36 overflow-hidden bg-emerald-50">
                  <img
                    src={infoImages[index]}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 to-transparent" />
                  <span className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-black text-emerald-700 shadow">
                    {index + 1}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-5">
            <h2 className="text-2xl font-black sm:text-3xl">{t.programs}</h2>
            <p className="mt-2 text-sm text-slate-500">{t.programHint}</p>
          </div>

          <div className="space-y-3">
            {programs.map((p) => {
              const expanded = expandedId === p.id
              return (
                <article
                  key={p.id}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : p.id)}
                    className="flex w-full items-center gap-3 p-4 text-left sm:p-5"
                    aria-expanded={expanded}
                  >
                    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-500" aria-hidden="true">{logoFallback(p.bank)}</span>
                      <img
                        src={siteLogo(p.bank, p.sourceUrl)}
                        alt={p.bank + ' logotipi'}
                        className="relative h-8 w-8 object-contain"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-black text-slate-950 sm:text-lg">
                        {p.bank}
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500 sm:text-sm">
                        {lang === 'ru' ? p.programRu : p.program}
                      </span>
                    </span>
                    <span className="hidden shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 sm:block">
                      {p.rateLabel}
                    </span>
                    <span className="shrink-0 text-xl font-black text-slate-400">
                      {expanded ? '−' : '+'}
                    </span>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                      <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800 sm:hidden">
                        {p.rateLabel}
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          [t.rate, p.rateLabel],
                          [t.down, p.downPaymentLabel],
                          [
                            t.term,
                            Math.round(p.termMonths / 12) +
                              ' ' +
                              (lang === 'ru' ? 'лет' : 'yil'),
                          ],
                          [t.max, p.maxAmountLabel],
                        ].map(([k, v]) => (
                          <div key={String(k)} className="rounded-xl bg-slate-50 p-3">
                            <div className="text-[10px] text-slate-400">{k}</div>
                            <div className="mt-1 text-sm font-black text-slate-900">{v}</div>
                          </div>
                        ))}
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {lang === 'ru' ? p.descriptionRu : p.description}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openProgram(p)
                          }}
                          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                        >
                          {t.detail}
                        </button>
                        <Link
                          href={
                            '/ipoteka/kalkulyator?market=' +
                            market +
                            (listing?.id ? '&listingId=' + listing.id : '') +
                            '&programId=' +
                            p.id
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                        >
                          {t.calc}
                        </Link>
                        <a
                          href={p.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold"
                        >
                          {t.source}
                        </a>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <section className="mt-12 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <h2 className="text-2xl font-black">{t.map}</h2>
          <p className="mt-2 text-sm text-slate-500">{t.mapHint}</p>

          <div className="mt-5 overflow-hidden rounded-3xl">
            <MortgageMap items={mapItems} market={market} />
          </div>

          {mapItems.length > 0 && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mapItems.map((x) => (
                <Link
                  key={x.id}
                  href={'/listings/' + x.id}
                  className="rounded-2xl border border-slate-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <b className="line-clamp-2">
                      {lang === 'ru' ? x.title_ru || x.title : x.title}
                    </b>
                    <span className="shrink-0 text-sm font-black text-emerald-700">
                      {money(x.price)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{x.district || x.city}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-emerald-600">{selected.bank}</p>
                <h2 className="mt-1 text-2xl font-black">
                  {lang === 'ru' ? selected.programRu : selected.program}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full bg-slate-100 px-3 py-2 text-xl font-black"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {selected.notes?.map((n) => (
                <div key={n} className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold">
                  {n}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6">
              {lang === 'ru' ? selected.descriptionRu : selected.description}
            </div>

            {sent ? (
              <div className="mt-5 rounded-2xl bg-emerald-600 p-5 font-bold text-white">
                {t.success}
              </div>
            ) : (
              <>
                <h3 className="mt-6 text-xl font-black">{t.calc}</h3>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold">
                    {t.name}
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                    />
                  </label>

                  <label className="text-sm font-bold">
                    {t.phone}
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                      placeholder="+998 90 123 45 67"
                    />
                  </label>

                  <label className="text-sm font-bold sm:col-span-2">
                    {t.price}
                    <input
                      value={price}
                      onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                    />
                  </label>

                  <label className="text-sm font-bold">
                    {t.down}
                    <input
                      value={down}
                      onChange={(e) => setDown(e.target.value.replace(/\D/g, ''))}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                    />
                  </label>

                  <label className="text-sm font-bold">
                    {lang === 'ru' ? 'Срок' : 'Muddat'}
                    <select
                      value={years}
                      onChange={(e) => setYears(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                    >
                      {[5, 10, 15, 20]
                        .filter((y) => y * 12 <= selected.termMonths)
                        .map((y) => (
                          <option key={y}>{y}</option>
                        ))}
                    </select>
                  </label>
                </div>

                {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}

                <button
                  type="button"
                  onClick={() => void submit()}
                  className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3.5 font-black text-white hover:bg-emerald-700"
                >
                  {t.submit}
                </button>

                <p className="mt-3 text-xs text-slate-400">
                  {lang === 'ru'
                    ? 'Расчёт предварительный. Окончательные условия определяет банк.'
                    : 'Hisob-kitob taxminiy. Yakuniy stavka va kredit shartlarini bank belgilaydi.'}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
