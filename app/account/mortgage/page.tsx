'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

type Lead = {
  id: string
  listing_id: string | null
  market: string
  bank_name: string
  program_name: string
  property_price: number
  down_payment: number
  term_months: number
  annual_rate: number
  monthly_payment: number | null
  status: string
  created_at: string
  updated_at: string
  listing: { id: string; title: string | null; title_ru: string | null; price: number | null } | null
}

const money = (value: number, ru: boolean) => `${new Intl.NumberFormat(ru ? 'ru-RU' : 'uz-UZ').format(Math.round(value))}${ru ? ' сум' : ' so‘m'}`

function statusInfo(status: string, ru: boolean) {
  const map: Record<string, { label: string; short: string; index: number }> = {
    new: { label: ru ? 'Заявка отправлена' : 'Ariza yuborildi', short: ru ? 'Отправлена' : 'Yuborildi', index: 0 },
    contacted: { label: ru ? 'Связались с вами' : 'Siz bilan bog‘lanildi', short: ru ? 'Связались' : 'Bog‘lanildi', index: 1 },
    reviewing: { label: ru ? 'Заявка рассматривается' : 'Ariza ko‘rib chiqilmoqda', short: ru ? 'Рассматривается' : 'Ko‘rib chiqilmoqda', index: 2 },
    approved: { label: ru ? 'Заявка одобрена' : 'Ariza tasdiqlandi', short: ru ? 'Одобрена' : 'Tasdiqlandi', index: 3 },
    rejected: { label: ru ? 'Заявка отклонена' : 'Ariza rad etildi', short: ru ? 'Отклонена' : 'Rad etildi', index: -1 },
    closed: { label: ru ? 'Заявка закрыта' : 'Ariza yopildi', short: ru ? 'Закрыта' : 'Yopildi', index: -1 },
  }
  return map[status] || { label: status, short: status, index: 0 }
}

export default function MortgageApplicationsPage() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    fetch('/api/account/mortgage-leads', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || (ru ? 'Не удалось загрузить заявки.' : 'Arizalarni yuklab bo‘lmadi.'))
        if (mounted) setLeads(data.leads || [])
      })
      .catch(error => { if (mounted) setError(error instanceof Error ? error.message : (ru ? 'Ошибка загрузки.' : 'Yuklashda xatolik.')) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [ru])

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div><Link href="/account" className="text-sm font-extrabold text-emerald-700">← {ru ? 'Кабинет' : 'Shaxsiy kabinet'}</Link><h1 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">{ru ? 'Мои ипотечные заявки' : 'Ipoteka arizalarim'}</h1><p className="mt-1 text-sm text-slate-500">{ru ? 'Следите за этапом рассмотрения каждой заявки.' : 'Har bir ipoteka arizangiz qaysi bosqichda ekanini kuzatib boring.'}</p></div>
      </div>

      {loading && <div className="mt-6 rounded-3xl bg-white p-10 text-center text-sm text-slate-500">{ru ? 'Загрузка...' : 'Yuklanmoqda...'}</div>}
      {error && <div className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
      {!loading && !error && !leads.length && <div className="mt-6 rounded-3xl bg-white p-10 text-center shadow-sm"><h2 className="text-lg font-black text-slate-900">{ru ? 'У вас пока нет ипотечных заявок' : 'Hozircha ipoteka arizalaringiz yo‘q'}</h2><p className="mt-2 text-sm text-slate-500">{ru ? 'Отправленная через калькулятор заявка появится здесь.' : 'Kalkulyator orqali yuborgan arizangiz shu yerda ko‘rinadi.'}</p><Link href="/ipoteka" className="mt-5 inline-flex rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">{ru ? 'Открыть ипотечный калькулятор' : 'Ipoteka kalkulyatorini ochish'}</Link></div>}

      <div className="mt-6 space-y-5">
        {leads.map((lead, index) => {
          const current = statusInfo(lead.status, ru)
          const steps = [statusInfo('new', ru), statusInfo('contacted', ru), statusInfo('reviewing', ru), statusInfo('approved', ru)]
          return <article key={lead.id} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{lead.market === 'primary' ? (ru ? 'Первичный рынок' : 'Birlamchi') : (ru ? 'Вторичный рынок' : 'Ikkilamchi')}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{lead.bank_name} · {lead.program_name}</span></div><h2 className="mt-3 text-xl font-black text-slate-950">{ru ? 'Ипотечная заявка' : 'Ipoteka arizasi'} #{lead.id.slice(0, 8).toUpperCase()}</h2></div>
                <div className="text-left sm:text-right"><div className="text-xs text-slate-400">{ru ? 'Отправлена' : 'Ariza yuborilgan sana'}</div><div className="mt-1 text-sm font-bold text-slate-800">{new Intl.DateTimeFormat(ru ? 'ru-RU' : 'uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lead.created_at))}</div></div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                {lead.status === 'rejected' || lead.status === 'closed' ? <div className="rounded-xl bg-rose-50 p-4"><div className="font-black text-rose-800">{current.label}</div><div className="mt-1 text-sm text-rose-700">{ru ? 'Если вам нужна дополнительная информация, свяжитесь с Royalhouse.' : 'Qo‘shimcha ma’lumot kerak bo‘lsa, Royalhouse bilan bog‘lanishingiz mumkin.'}</div></div> : <div><div className="text-sm font-black text-slate-900">{current.label}</div><div className="mt-5 grid grid-cols-4 gap-1 sm:gap-3">{steps.map((step, stepIndex) => { const done = current.index >= stepIndex; const active = current.index === stepIndex; return <div key={step.short} className="min-w-0"><div className={`mx-auto h-3 w-3 rounded-full sm:h-4 sm:w-4 ${done ? 'bg-emerald-600' : 'bg-slate-200'} ${active ? 'ring-4 ring-emerald-100' : ''}`} /><div className={`mt-2 text-center text-[10px] font-bold leading-4 sm:text-xs ${done ? 'text-emerald-700' : 'text-slate-400'}`}>{step.short}</div></div> })}</div><div className="mt-2 h-1.5 rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, current.index / 3 * 100))}%` }} /></div></div>}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">{ru ? 'Банк' : 'Bank'}</div><div className="mt-1 font-bold text-slate-900">{lead.bank_name}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">{ru ? 'Сумма кредита' : 'Kredit summasi'}</div><div className="mt-1 font-bold text-slate-900">{money(lead.property_price, ru)}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">{ru ? 'Первоначальный взнос' : 'Boshlang‘ich badal'}</div><div className="mt-1 font-bold text-slate-900">{money(lead.down_payment, ru)}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">{ru ? 'Срок' : 'Muddati'}</div><div className="mt-1 font-bold text-slate-900">{Math.round(lead.term_months / 12)} {ru ? 'лет' : 'yil'}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">{ru ? 'Ставка' : 'Foiz stavkasi'}</div><div className="mt-1 font-bold text-slate-900">{lead.annual_rate}%</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">{ru ? 'Объект' : 'Bog‘langan e’lon'}</div><div className="mt-1 font-bold text-slate-900">{lead.listing ? (ru ? lead.listing.title_ru || lead.listing.title : lead.listing.title || lead.listing.title_ru) : (ru ? 'Общий ипотечный расчёт' : 'Umumiy ipoteka kalkulyatori')}</div></div>
              </div>
              {lead.listing_id && <Link href={`/listings/${lead.listing_id}`} className="mt-5 inline-flex rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">{ru ? 'Открыть объявление →' : 'E’lonni ochish →'}</Link>}
            </div>
          </article>
        })}
      </div>
    </div>
  </main>
}
