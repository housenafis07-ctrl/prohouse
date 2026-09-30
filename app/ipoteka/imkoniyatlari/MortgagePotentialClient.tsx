'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getMortgagePrograms } from '@/lib/mortgage-programs'
import { loanFromPayment } from '@/lib/mortgage-affordability'

const money = (value: number) =>
  new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)))

const payment = (principal: number, annualRate: number, months: number) => {
  if (principal <= 0 || months <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) return principal / months
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}


export default function MortgagePotentialClient() {
  const router = useRouter()
  const [income, setIncome] = useState('')
  const [existingCredits, setExistingCredits] = useState('')
  const [downPayment, setDownPayment] = useState('')
  const [rate, setRate] = useState('21.5')
  const [years, setYears] = useState('20')
  const [coBorrowerOpen, setCoBorrowerOpen] = useState(false)
  const [coBorrowerIncome, setCoBorrowerIncome] = useState('')
  const [coBorrowerCredits, setCoBorrowerCredits] = useState('')
  const [calculated, setCalculated] = useState(false)

  const result = useMemo(() => {
    const totalIncome = Number(income || 0) + Number(coBorrowerIncome || 0)
    const totalExisting = Number(existingCredits || 0) + Number(coBorrowerCredits || 0)
    const debtLimit = totalIncome * 0.5
    const mortgagePayment = Math.max(0, debtLimit - totalExisting)
    const months = Math.max(12, Number(years || 20) * 12)
    const maxLoan = loanFromPayment(mortgagePayment, Number(rate || 0), months)
    const maxHome = maxLoan + Number(downPayment || 0)
    const debtRatio = totalIncome > 0 ? ((totalExisting + mortgagePayment) / totalIncome) * 100 : 0

    return { totalIncome, totalExisting, debtLimit, mortgagePayment, maxLoan, maxHome, debtRatio }
  }, [income, existingCredits, downPayment, rate, years, coBorrowerIncome, coBorrowerCredits])

  const canCalculate = Number(income) > 0 && Number(downPayment) >= 0

  const matchingUrl = '/listings?tab=sale&min=' + Math.round(result.maxHome * 0.85) + '&max=' + Math.round(result.maxHome) + '&mortgage=true'
  const matchingBanks = getMortgagePrograms('secondary').filter(p => Number(downPayment || 0) >= result.maxHome * (p.downPaymentMin / 100) && (!p.maxAmount || result.maxHome <= p.maxAmount)).slice(0, 6)

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) router.back()
              else router.push('/ipoteka')
            }}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
          >
            ← Orqaga
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
            Ipoteka imkoniyatingizni hisoblang
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50 sm:text-lg">
            Daromadingiz, mavjud kreditlaringiz va boshlang‘ich badalingiz asosida taxminiy ipoteka imkoniyatingizni hisoblang.
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

      <div className="mx-auto max-w-5xl px-4 pt-6 sm:pt-8">
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">ROYALHOUSE SMART TOOLS</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Ipoteka va uy xaridi uchun 6 ta vosita</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">O‘zingizga mos uy budjetini hisoblang, ipoteka imkoniyatingizni tekshiring va uylarni toping.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/ipoteka/uy-qancha" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 hover:shadow-md"><span className="text-2xl">🏠</span><h3 className="mt-2 font-black text-slate-950">1. Siz qancha uy olishingiz mumkin?</h3><p className="mt-1 text-xs leading-5 text-slate-500">Daromad va kreditlaringizdan kelib chiqib uy budjetini hisoblang.</p></Link>
            <Link href="/ipoteka/imkoniyatlari" className="rounded-2xl border-2 border-emerald-500 bg-white p-4 shadow-sm hover:shadow-md"><span className="text-2xl">💳</span><h3 className="mt-2 font-black text-slate-950">2. Ipoteka imkoniyatlari</h3><p className="mt-1 text-xs leading-5 text-slate-500">Maksimal ipoteka va sizga mos bank dasturlarini hisoblang.</p></Link>
            <Link href="/listings?tab=sale&mortgage=true" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:shadow-md"><span className="text-2xl">🗺️</span><h3 className="mt-2 font-black text-slate-950">3. Menga mos uylar</h3><p className="mt-1 text-xs leading-5 text-slate-500">Ipotekaga mos sotuvdagi uylarni toping.</p></Link>
            <Link href="/account/favorites" className="rounded-2xl border border-rose-100 bg-rose-50 p-4 hover:shadow-md"><span className="text-2xl">❤️</span><h3 className="mt-2 font-black text-slate-950">4. Saqlangan uylar</h3><p className="mt-1 text-xs leading-5 text-slate-500">Yoqtirgan obyektlaringizni saqlang.</p></Link>
            <Link href="/account/saved-searches" className="rounded-2xl border border-amber-100 bg-amber-50 p-4 hover:shadow-md"><span className="text-2xl">🔔</span><h3 className="mt-2 font-black text-slate-950">5. Xabarnomalar</h3><p className="mt-1 text-xs leading-5 text-slate-500">Yangi uylar va narx o‘zgarishlari haqida bildirishnoma oling.</p></Link>
            <Link href="/solishtirish" className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md"><span className="text-2xl">⚖️</span><h3 className="mt-2 font-black text-slate-950">6. Uylarni solishtirish</h3><p className="mt-1 text-xs leading-5 text-slate-500">3 tagacha uyni narx, maydon va ipoteka bo‘yicha taqqoslang.</p></Link>
          </div>
        </section>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
            <h2 className="text-2xl font-black text-slate-950">Ma’lumotlaringiz</h2>
            <p className="mt-1 text-sm text-slate-500">Hisob-kitob dastlabki taxmin hisoblanadi.</p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Jami oylik daromad</span>
                <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-emerald-400 focus-within:bg-white">
                  <input value={income} onChange={e => setIncome(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="12 000 000" className="w-full bg-transparent py-3.5 text-base font-bold outline-none" />
                  <span className="text-sm font-bold text-slate-400">so‘m</span>
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Har oylik mavjud kreditlar to‘lovi</span>
                <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-emerald-400 focus-within:bg-white">
                  <input value={existingCredits} onChange={e => setExistingCredits(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="2 000 000" className="w-full bg-transparent py-3.5 text-base font-bold outline-none" />
                  <span className="text-sm font-bold text-slate-400">so‘m</span>
                </div>
                <span className="mt-1.5 block text-xs text-slate-400">Boshqa banklardagi kreditlar va boshqa majburiy oylik to‘lovlar.</span>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Boshlang‘ich badal</span>
                <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-emerald-400 focus-within:bg-white">
                  <input value={downPayment} onChange={e => setDownPayment(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="150 000 000" className="w-full bg-transparent py-3.5 text-base font-bold outline-none" />
                  <span className="text-sm font-bold text-slate-400">so‘m</span>
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Taxminiy yillik stavka</span>
                <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4">
                  <input value={rate} onChange={e => setRate(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className="w-full bg-transparent py-3.5 text-base font-bold outline-none" />
                  <span className="text-sm font-bold text-slate-400">%</span>
                </div>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-bold text-slate-700">Ipoteka muddati</span>
                <select value={years} onChange={e => setYears(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold outline-none focus:border-emerald-400">
                  {[5, 7, 10, 15, 20].map(y => <option key={y} value={y}>{y} yil</option>)}
                </select>
              </label>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <button type="button" onClick={() => setCoBorrowerOpen(v => !v)} className="flex w-full items-center justify-between px-4 py-4 text-left hover:bg-slate-50">
                <span>
                  <span className="block font-black text-slate-900">Birgalikda qarz oluvchi / turmush o‘rtog‘i</span>
                  <span className="mt-1 block text-xs text-slate-500">Daromadini hisobga qo‘shish uchun oching</span>
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-xl font-bold text-emerald-700">{coBorrowerOpen ? '−' : '+'}</span>
              </button>

              {coBorrowerOpen && (
                <div className="grid gap-4 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                  <label>
                    <span className="text-sm font-bold text-slate-700">Qo‘shiladigan oylik daromad</span>
                    <input value={coBorrowerIncome} onChange={e => setCoBorrowerIncome(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="5 000 000" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-bold outline-none focus:border-emerald-400" />
                  </label>
                  <label>
                    <span className="text-sm font-bold text-slate-700">Uning mavjud kredit to‘lovi</span>
                    <input value={coBorrowerCredits} onChange={e => setCoBorrowerCredits(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="1 000 000" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 font-bold outline-none focus:border-emerald-400" />
                  </label>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!canCalculate}
              onClick={() => setCalculated(true)}
              className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ipoteka imkoniyatini hisoblash
            </button>
          </section>

          <aside className="h-fit rounded-3xl bg-slate-950 p-6 text-white shadow-xl lg:sticky lg:top-6">
            <p className="text-sm font-bold text-emerald-300">Sizning taxminiy imkoniyatingiz</p>
            {!calculated ? (
              <div className="py-12">
                <div className="text-5xl">🏠</div>
                <h2 className="mt-5 text-2xl font-black">Hisoblashni boshlang</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Daromad va mavjud kreditlarni kiriting. Royalhouse 50% qarz yuklamasi chegarasidan kelib chiqib hisoblaydi.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Maksimal jami oylik kredit to‘lovi</p>
                  <p className="mt-1 text-2xl font-black">{money(result.debtLimit)} so‘m</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs font-bold text-slate-400">Mavjud kreditlardan keyin ipoteka uchun</p>
                  <p className="mt-1 text-3xl font-black text-emerald-300">{money(result.mortgagePayment)} so‘m/oy</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Taxminiy maksimal ipoteka</p>
                  <p className="mt-1 text-2xl font-black">{money(result.maxLoan)} so‘m</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Boshlang‘ich badal bilan uy qiymati</p>
                  <p className="mt-1 text-2xl font-black">{money(result.maxHome)} so‘m</p>
                </div>
                <div className="border-t border-white/10 pt-4 text-sm text-slate-400">
                  Jami qarz yuklamasi: <span className="font-bold text-white">{result.debtRatio.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </aside>
        </div>

        {calculated && (
          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">Sizga mos banklar</h2>
                <p className="mt-1 text-sm text-slate-500">Boshlang‘ich badal va taxminiy uy qiymatingizga mos dasturlar.</p>
              </div>
              <Link href={matchingUrl} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">Mos uylarni ko‘rish →</Link>
            </div>
            <div className="mt-5 space-y-3">
              {(matchingBanks.length ? matchingBanks : getMortgagePrograms('secondary').slice(0, 6)).map(p => {
                const loan = Math.max(0, result.maxHome - Number(downPayment || 0))
                const payment = loanFromPayment(loan, p.rateMin, Math.max(12, Number(years || 20) * 12))
                return (
                  <div key={p.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[1.3fr_.6fr_.8fr_.9fr] sm:items-center">
                    <div><b>{p.bank}</b><p className="text-xs text-slate-500">{p.program}</p></div>
                    <div><span className="text-xs text-slate-400">Stavka</span><b className="block">{p.rateLabel}</b></div>
                    <div><span className="text-xs text-slate-400">Badal</span><b className="block">{p.downPaymentLabel}</b></div>
                    <div><span className="text-xs text-slate-400">Taxminiy to‘lov</span><b className="block text-emerald-700">{money(payment)} so‘m/oy</b></div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {calculated && (
          <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-600">ROYALHOUSE SMART TOOLS</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Keyingi qadamni tanlang</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Hisob-kitobdan keyin Royalhouse’da mos uylarni topish, saqlash, xabarnoma olish va solishtirish mumkin.</p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link href={matchingUrl} className="group rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="text-2xl">🗺️</span>
                <h3 className="mt-2 font-black text-slate-950">Menga mos uylar</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Sizning budjetingiz va ipotekaga mos obyektlarni ko‘ring.</p>
                <span className="mt-3 inline-flex text-sm font-black text-emerald-700">Mos uylarni ko‘rish →</span>
              </Link>

              <Link href="/account/favorites" className="group rounded-2xl border border-rose-100 bg-rose-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="text-2xl">❤️</span>
                <h3 className="mt-2 font-black text-slate-950">Saqlangan uylar</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Yoqtirgan uylaringizni bitta joyda saqlang va kuzating.</p>
                <span className="mt-3 inline-flex text-sm font-black text-rose-700">Mening uylarim →</span>
              </Link>

              <Link href="/account/saved-searches" className="group rounded-2xl border border-amber-100 bg-amber-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="text-2xl">🔔</span>
                <h3 className="mt-2 font-black text-slate-950">Yangi uy va narx xabarnomasi</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Saqlangan qidiruv va uylar bo‘yicha bildirishnomalarni yoqing.</p>
                <span className="mt-3 inline-flex text-sm font-black text-amber-700">Xabarnomalarni sozlash →</span>
              </Link>

              <Link href="/solishtirish" className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="text-2xl">⚖️</span>
                <h3 className="mt-2 font-black text-slate-950">Uylarni solishtirish</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">3 tagacha uyni narx, maydon va ipoteka bo‘yicha taqqoslang.</p>
                <span className="mt-3 inline-flex text-sm font-black text-slate-700">Solishtirish →</span>
              </Link>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💳</span>
                <div>
                  <h3 className="font-black text-slate-950">Sizga mos banklar</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Yuqoridagi banklar jadvalida stavka, boshlang‘ich badal va taxminiy to‘lovlar ko‘rsatilgan.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <strong>Eslatma:</strong> bu Royalhouse’ning dastlabki hisob-kitobi. Bankning yakuniy qarori daromadni tasdiqlash, kredit tarixi, qarz yuklamasi va tanlangan ipoteka dasturi shartlariga bog‘liq.
        </div>
      </div>
    </main>
  )
}
