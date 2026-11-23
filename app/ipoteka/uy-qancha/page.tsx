'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { calculateAffordableHome, monthlyPayment } from '@/lib/mortgage-affordability'
import { useI18n } from '@/app/components/I18nProvider'

const money = (n: number, lang: 'uz' | 'ru') =>
  new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ', { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(n)))

export default function AffordableHomePage() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const [income, setIncome] = useState('')
  const [existing, setExisting] = useState('')
  const [down, setDown] = useState('')
  const [rate, setRate] = useState('21.5')
  const [years, setYears] = useState('20')
  const [calculated, setCalculated] = useState(false)

  const result = useMemo(() => calculateAffordableHome({
    income: Number(income),
    existingCredits: Number(existing),
    downPayment: Number(down),
    annualRate: Number(rate),
    years: Number(years),
  }), [income, existing, down, rate, years])

  const canCalculate = Number(income) > 0 && Number(down) >= 0

  const matchingUrl = '/listings?tab=sale&min=' + Math.round(result.minHome) + '&max=' + Math.round(result.maxHome) + '&mortgage=true'
  const monthlyFor = (price: number) => monthlyPayment(Math.max(0, price - Number(down || 0)), Number(rate || 0), Number(years || 20) * 12)

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/ipoteka" className="font-black text-emerald-700">← {ru ? 'Ипотека' : 'Ipoteka'}</Link>
        <Link href="/" className="text-xl font-black">Royal<span className="text-emerald-500">house</span></Link>
      </div></header>

      <section className="bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-600 text-white"><div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black tracking-wider">IPOTEKA</span>
        <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">{ru ? 'Сколько жилья вам по карману?' : 'Siz qancha uy olishingiz mumkin?'}</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-emerald-50 sm:text-lg">{ru ? 'Укажите доход, первоначальный взнос и срок — Royalhouse покажет ориентировочный диапазон стоимости жилья и подходящие объявления.' : 'Daromad, boshlang‘ich badal va muddatni kiriting — Royalhouse sizga mos taxminiy uy narxi diapazonini va mos e’lonlarni ko‘rsatadi.'}</p>
      </div></section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_390px]">
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
            <h2 className="text-2xl font-black">{ru ? 'Ваши данные' : 'Ma’lumotlaringiz'}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {([
                [ru ? 'Ежемесячный доход' : 'Oylik daromad', income, setIncome, '10 000 000'],
                [ru ? 'Текущие кредитные платежи' : 'Mavjud kredit to‘lovlari', existing, setExisting, '2 000 000'],
                [ru ? 'Первоначальный взнос' : 'Boshlang‘ich badal', down, setDown, '150 000 000'],
              ] as Array<[string, string, (value: string) => void, string]>).map(([label, value, setter, placeholder]) => (
                <label key={label} className="block">
                  <span className="text-sm font-bold text-slate-700">{label}</span>
                  <div className="mt-2 flex rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-emerald-400 focus-within:bg-white">
                    <input
                      value={value}
                      onChange={e => setter(e.target.value.replace(/\D/g, ''))}
                      inputMode="numeric"
                      placeholder={placeholder}
                      className="w-full bg-transparent py-3.5 font-bold outline-none"
                    />
                    <span className="py-3.5 text-sm font-bold text-slate-400">{ru ? 'сум' : 'so‘m'}</span>
                  </div>
                </label>
              ))}
              <label><span className="text-sm font-bold text-slate-700">{ru ? 'Ориентировочная ставка' : 'Taxminiy yillik stavka'}</span>
                <div className="mt-2 flex rounded-2xl border border-slate-200 bg-slate-50 px-4"><input value={rate} onChange={e => setRate(e.target.value.replace(/[^0-9.]/g, ''))} className="w-full bg-transparent py-3.5 font-bold outline-none" /><span className="py-3.5 text-sm font-bold text-slate-400">%</span></div>
              </label>
              <label><span className="text-sm font-bold text-slate-700">{ru ? 'Срок ипотеки' : 'Ipoteka muddati'}</span>
                <select value={years} onChange={e => setYears(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 font-bold">{[5,7,10,15,20].map(y => <option key={y} value={y}>{y} {ru ? 'лет' : 'yil'}</option>)}</select>
              </label>
            </div>
            <button disabled={!canCalculate} onClick={() => setCalculated(true)} className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white shadow-lg shadow-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-40">{ru ? 'Рассчитать' : 'Hisoblash'}</button>
          </section>

          <aside className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
            <p className="text-sm font-bold text-emerald-300">{ru ? 'Ваш ориентировочный бюджет' : 'Sizning taxminiy uy budjetingiz'}</p>
            {!calculated ? <div className="py-12"><div className="text-5xl">🏠</div><h2 className="mt-5 text-2xl font-black">{ru ? 'Введите данные' : 'Ma’lumotlarni kiriting'}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{ru ? 'После расчёта покажем диапазон и подходящие объекты.' : 'Hisoblagandan keyin diapazon va mos uylarni ko‘rsatamiz.'}</p></div> :
              <div className="mt-6"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{ru ? 'Подходящий диапазон' : 'Mos kelishi mumkin bo‘lgan diapazon'}</p>
                <p className="mt-2 text-3xl font-black text-emerald-300">{money(result.minHome, lang)} – {money(result.maxHome, lang)} {ru ? 'сум' : 'so‘m'}</p>
                <div className="mt-5 rounded-2xl bg-white/10 p-4"><p className="text-xs text-slate-400">{ru ? 'Ориентировочный платёж' : 'Taxminiy oylik to‘lov'}</p><p className="mt-1 text-2xl font-black">{money(result.mortgagePayment, lang)} so‘m/oy</p></div>
                <Link href={matchingUrl} className="mt-5 flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-5 py-4 text-center font-black text-white">{ru ? 'Посмотреть подходящие дома →' : 'Sizga mos uylarni ko‘rish →'}</Link>
              </div>}
          </aside>
        </div>

        {calculated && <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black">{ru ? 'Примеры платежа' : 'Oylik to‘lov misollari'}</h2><p className="mt-1 text-sm text-slate-500">{ru ? 'Для нескольких цен в вашем диапазоне.' : 'Sizning diapazoningizdagi bir nechta narx uchun.'}</p></div>
          <Link href={matchingUrl} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">{ru ? 'Все подходящие объекты' : 'Barcha mos obyektlar'}</Link></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">{[result.minHome,(result.minHome+result.maxHome)/2,result.maxHome].map((price,index)=><div key={index} className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold">{money(price,lang)} so‘m</p><p className="mt-1 text-xs text-slate-500">{money(monthlyFor(price),lang)} so‘m/oy</p></div>)}</div>
        </section>}
        <p className="mt-5 text-xs leading-5 text-slate-400">{ru ? 'Расчёт ориентировочный и не является решением банка.' : 'Hisob-kitob taxminiy bo‘lib, bankning yakuniy qarori hisoblanmaydi.'}</p>
      </div>
    </main>
  )
}
