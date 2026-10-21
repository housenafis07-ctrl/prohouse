'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

type Dashboard = {
  generatedAt: string
  source: { paymentAttempts: number; rentalBookings: number; capped: boolean }
  totals: { revenue: number; payments: number; customers: number; arppu: number; averageCheck: number; repeatRate: number; monthRevenue: number; monthPayments: number; currentMonthCustomers: number; previousMonthCustomers: number }
  trend: { key: string; label: string; revenue: number; payments: number; customers: number }[]
  services: { code: string; name_uz: string; name_ru: string; revenue: number; payments: number; customers: number; share: number }[]
  providers: { provider: string; revenue: number; payments: number; customers: number; share: number }[]
  customers: { id: string; name: string; phone: string | null; revenue: number; payments: number; services: number }[]
}

type Transaction = {
  id: string; order_id: string; customer_name: string; customer_phone: string | null; provider: string; status: string; amount_uzs: number
  paid_at: string | null; created_at: string
  services: { code: string; name_uz: string; name_ru: string; quantity: number }[]
}

type PaymentReport = { transactions: Transaction[] }

const money = (amount: number) => new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(Math.round(amount)) + ' so‘m'
const compact = (amount: number) => new Intl.NumberFormat('uz-UZ', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(amount))
const dateTime = (value: string | null, locale: string) => value ? new Date(value).toLocaleString(locale) : '—'

function Card({ title, value, note, accent = false }: { title: string; value: string; note: string; accent?: boolean }) {
  return <section className={'relative overflow-hidden rounded-3xl p-5 shadow-sm ring-1 ' + (accent ? 'bg-slate-950 text-white ring-slate-900' : 'bg-white text-slate-950 ring-slate-100')}>
    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl" />
    <p className={'relative text-xs font-bold uppercase tracking-wider ' + (accent ? 'text-emerald-300' : 'text-slate-500')}>{title}</p>
    <p className="relative mt-2 text-2xl font-black tracking-tight">{value}</p>
    <p className={'relative mt-2 text-xs ' + (accent ? 'text-slate-300' : 'text-slate-500')}>{note}</p>
  </section>
}

function RevenueChart({ rows, ru }: { rows: Dashboard['trend']; ru: boolean }) {
  const max = Math.max(...rows.map(row => row.revenue), 1)
  return <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">{ru ? 'Динамика' : 'Dinamika'}</p><h3 className="mt-1 text-xl font-black">{ru ? 'Выручка за последние 30 дней' : 'So‘nggi 30 kun daromadi'}</h3><p className="mt-1 text-sm text-slate-500">{ru ? 'Тренд поступлений и количество оплат' : 'Tushum va to‘lovlar trendi'}</p></div>
      <div className="rounded-2xl bg-slate-50 px-4 py-2 text-right"><p className="text-[10px] font-bold uppercase text-slate-400">30 kun</p><p className="text-lg font-black">{money(rows.reduce((s, r) => s + r.revenue, 0))}</p></div>
    </div>
    <div className="mt-6 h-64">
      <svg viewBox="0 0 900 260" className="h-full w-full overflow-visible" preserveAspectRatio="none">
        <defs><linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity=".28"/><stop offset="100%" stopColor="#10b981" stopOpacity="0"/></linearGradient></defs>
        {[0, .25, .5, .75, 1].map((tick, i) => <line key={i} x1="0" x2="900" y1={230 - tick * 205} y2={230 - tick * 205} stroke="#e2e8f0" strokeDasharray="4 8" />)}
        <path d={rows.map((row, i) => `${i === 0 ? 'M' : 'L'} ${(i / Math.max(rows.length - 1, 1)) * 900} ${230 - (row.revenue / max) * 205}`).join(' ') + ' L 900 230 L 0 230 Z'} fill="url(#revenueFill)" />
        <polyline fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={rows.map((row, i) => `${(i / Math.max(rows.length - 1, 1)) * 900},${230 - (row.revenue / max) * 205}`).join(' ')} />
        {rows.map((row, i) => i % 5 === 0 || i === rows.length - 1 ? <g key={row.key}><circle cx={(i / Math.max(rows.length - 1, 1)) * 900} cy={230 - (row.revenue / max) * 205} r="4" fill="#059669"/><text x={(i / Math.max(rows.length - 1, 1)) * 900} y="252" textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'} fontSize="11" fill="#64748b">{row.label}</text></g> : null)}
      </svg>
    </div>
  </section>
}

function ServiceChart({ services, ru }: { services: Dashboard['services']; ru: boolean }) {
  const max = Math.max(...services.map(item => item.revenue), 1)
  return <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
    <div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">{ru ? 'Продукты' : 'Mahsulotlar'}</p><h3 className="mt-1 text-xl font-black">{ru ? 'Что приносит деньги' : 'Daromadni nima olib kelmoqda?'}</h3><p className="mt-1 text-sm text-slate-500">{ru ? 'Рейтинг монетизации по выручке' : 'Monetizatsiya xizmatlari reytingi'}</p></div>
    <div className="mt-6 space-y-5">
      {services.slice(0, 6).map((item, index) => <div key={item.code}>
        <div className="mb-2 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">{index + 1}</span><div className="min-w-0"><p className="truncate font-bold">{ru ? item.name_ru : item.name_uz}</p><p className="text-xs text-slate-400">{item.payments} {ru ? 'платежей' : 'to‘lov'} · {item.customers} {ru ? 'клиентов' : 'mijoz'}</p></div></div><p className="shrink-0 font-black">{money(item.revenue)}</p></div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-300" style={{ width: Math.max(3, item.revenue / max * 100) + '%' }} /></div>
        <p className="mt-1 text-right text-[11px] font-bold text-slate-400">{item.share.toFixed(1)}%</p>
      </div>)}
    </div>
  </section>
}

function ProviderDonut({ providers, ru }: { providers: Dashboard['providers']; ru: boolean }) {
  const colors = ['#059669', '#0f172a', '#14b8a6', '#94a3b8']
  let cursor = 0
  const stops = providers.map((item, index) => { const start = cursor; cursor += item.share; return `${colors[index % colors.length]} ${start}% ${cursor}%` }).join(', ')
  return <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">{ru ? 'Провайдеры' : 'Provayderlar'}</p><h3 className="mt-1 text-xl font-black">{ru ? 'Структура оплат' : 'To‘lovlar tarkibi'}</h3>
    <div className="mt-7 flex items-center gap-7">
      <div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background: providers.length ? `conic-gradient(${stops})` : '#334155' }}><div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-slate-950"><span className="text-2xl font-black">{providers.length}</span><span className="text-[10px] text-slate-400">{ru ? 'канала' : 'kanal'}</span></div></div>
      <div className="min-w-0 space-y-4">{providers.map((item, index) => <div key={item.provider} className="flex items-center gap-3"><span className="h-3 w-3 rounded-full" style={{ background: colors[index % colors.length] }} /><div className="min-w-0"><p className="font-bold uppercase">{item.provider}</p><p className="text-xs text-slate-400">{item.payments} · {item.customers} {ru ? 'клиентов' : 'mijoz'}</p></div><p className="ml-auto font-black">{item.share.toFixed(1)}%</p></div>)}</div>
    </div>
  </section>
}

export default function PaymentReportPage() {
  const { lang, setLang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, ruText: string) => ru ? ruText : uz
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [report, setReport] = useState<PaymentReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [dashboardResponse, reportResponse] = await Promise.all([
        fetch('/api/admin/monetization-dashboard', { cache: 'no-store' }),
        fetch('/api/admin/payment-report', { cache: 'no-store' }),
      ])
      const dashboardData = await dashboardResponse.json().catch(() => ({}))
      const reportData = await reportResponse.json().catch(() => ({}))
      if ([dashboardResponse.status, reportResponse.status].some(status => status === 401 || status === 403)) { window.location.href = '/admin/login'; return }
      if (!dashboardResponse.ok) throw new Error(dashboardData.error || t('Dashboardni yuklab bo‘lmadi', 'Не удалось загрузить dashboard'))
      setDashboard(dashboardData); setReport(reportData)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Noma’lum xatolik', 'Неизвестная ошибка'))
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const filteredTransactions = useMemo(() => (report?.transactions || []).filter(row => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [row.customer_name, row.customer_phone || '', row.order_id, row.provider, ...row.services.map(s => s.name_uz + ' ' + s.name_ru)].join(' ').toLowerCase().includes(q)
  }).slice(0, 12), [report, search])

  function exportCsv() {
    const rows = report?.transactions || []
    const columns = ['date', 'customer', 'phone', 'service', 'amount_uzs', 'provider', 'status', 'order_id']
    const data = rows.map(row => [row.paid_at || row.created_at, row.customer_name, row.customer_phone || '', row.services.map(s => ru ? s.name_ru : s.name_uz).join('; '), row.amount_uzs, row.provider, row.status, row.order_id])
    const csv = [columns, ...data].map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'royalhouse-monetization-report.csv'; anchor.click(); URL.revokeObjectURL(url)
  }

  const d = dashboard
  const monthGrowth = d && d.totals.monthRevenue > 0 ? ((d.totals.monthRevenue / Math.max(d.totals.revenue - d.totals.monthRevenue, 1)) * 100) : 0
  const topCustomer = d?.customers?.[0]
  const topService = d?.services?.[0]
  const maxDaily = Math.max(...(d?.trend || []).map(row => row.revenue), 1)

  return <main className="min-h-screen bg-slate-50 text-slate-950">
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur"><div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6"><div className="flex items-center gap-4"><Link href="/admin" className="font-black text-emerald-700">← {t('Admin', 'Админ')}</Link><div className="hidden h-7 w-px bg-slate-200 sm:block"/><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">RoyalHouse</p><h1 className="font-black">{t('Monetizatsiya Intelligence', 'Monetization Intelligence')}</h1></div></div><div className="flex items-center gap-2"><button onClick={() => setLang('uz')} className={'rounded-lg border px-3 py-2 text-xs font-bold ' + (!ru ? 'bg-slate-950 text-white' : 'bg-white')}>UZ</button><button onClick={() => setLang('ru')} className={'rounded-lg border px-3 py-2 text-xs font-bold ' + (ru ? 'bg-slate-950 text-white' : 'bg-white')}>RU</button><button onClick={exportCsv} className="hidden rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white sm:block">{t('CSV eksport', 'Экспорт CSV')}</button><button onClick={() => void load()} className="rounded-xl border bg-white px-3 py-2 text-sm font-bold">↻</button></div></div></header>

    <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-black text-emerald-600">{t('Moliya → Qaror qabul qilish', 'Финансы → Принятие решений')}</p><h2 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{t('Monetizatsiya boshqaruv paneli', 'Панель управления монетизацией')}</h2><p className="mt-2 max-w-3xl text-sm text-slate-500">{t('Daromad, mijozlar, xizmatlar va to‘lovlar bo‘yicha marketing qarorlarini bir joyda ko‘ring.', 'Доход, клиенты, услуги и платежи в одном месте для маркетинговых решений.')}</p></div>{d?.source.capped && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">{t('10 000 ta yozuv limiti: to‘liq tarix uchun keyingi bosqichda agregatsiya kerak.', 'Лимит 10 000 записей: для полной истории нужна агрегация.')}</div>}</div>
      {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading && <div className="mt-6 rounded-3xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">{t('Monetizatsiya ma’lumotlari yuklanmoqda…', 'Загружаются данные монетизации…')}</div>}

      {d && <>
        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Card title={t('Jami daromad', 'Общая выручка')} value={money(d.totals.revenue)} note={t(`${d.totals.payments} ta muvaffaqiyatli to‘lov`, `${d.totals.payments} успешных платежей`)} accent />
          <Card title={t('Oy daromadi', 'Выручка за месяц')} value={money(d.totals.monthRevenue)} note={t(`${d.totals.currentMonthCustomers} ta mijoz`, `${d.totals.currentMonthCustomers} клиентов`)} />
          <Card title="ARPPU" value={money(d.totals.arppu)} note={t('1 to‘lovchi mijozga', 'На платящего клиента')} />
          <Card title={t('O‘rtacha chek', 'Средний чек')} value={money(d.totals.averageCheck)} note={t('Bir operatsiya', 'За операцию')} />
          <Card title={t('Qayta xarid', 'Повторная покупка')} value={d.totals.repeatRate.toFixed(1) + '%'} note={t('2+ marta to‘laganlar', 'Купили 2+ раза')} />
          <Card title={t('Top xizmat', 'Топ услуга')} value={topService ? (ru ? topService.name_ru : topService.name_uz) : '—'} note={topService ? money(topService.revenue) : '—'} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,.8fr)]">
          <RevenueChart rows={d.trend} ru={ru} />
          <div className="grid gap-5"><ProviderDonut providers={d.providers} ru={ru} /><section className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-500 p-6 text-white shadow-sm"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">{t('Marketing signali', 'Маркетинговый сигнал')}</p><h3 className="mt-2 text-xl font-black">{t('Kimga va nimani taklif qilish kerak?', 'Кому и что продавать?')}</h3><div className="mt-5 space-y-3 text-sm"><p className="rounded-2xl bg-white/10 p-3">🔥 <b>{topCustomer?.name || '—'}</b> — {topCustomer ? money(topCustomer.revenue) : '—'} {t('daromad keltirgan', 'выручки')}</p><p className="rounded-2xl bg-white/10 p-3">📈 <b>{topService ? (ru ? topService.name_ru : topService.name_uz) : '—'}</b> — {topService?.share.toFixed(1) || 0}% {t('tushum ulushi', 'доли выручки')}</p><p className="rounded-2xl bg-white/10 p-3">🎯 {t('Qayta xaridni oshirish uchun bundle va bonus testini sinang.', 'Тестируйте bundle и бонус для роста повторных покупок.')}</p></div></section></div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <ServiceChart services={d.services} ru={ru} />
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">{t('Mijozlar', 'Клиенты')}</p><h3 className="mt-1 text-xl font-black">{t('Eng ko‘p daromad keltirgan mijozlar', 'Самые ценные клиенты')}</h3><p className="mt-1 text-sm text-slate-500">{t('Marketing va CRM uchun prioritet auditoriya', 'Приоритетная аудитория для маркетинга и CRM')}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">TOP 12</span></div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3"># / {t('Mijoz','Клиент')}</th><th className="px-4 py-3">{t('Daromad','Выручка')}</th><th className="px-4 py-3">{t('To‘lov','Платежи')}</th><th className="px-4 py-3">{t('Xizmat','Услуги')}</th></tr></thead><tbody className="divide-y">{d.customers.map((row, index) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-950 text-[10px] font-black text-white">{index + 1}</span><div><p className="font-bold">{row.name}</p>{row.phone && <p className="text-[11px] text-slate-400">{row.phone}</p>}</div></div></td><td className="px-4 py-3 font-black">{money(row.revenue)}</td><td className="px-4 py-3 font-semibold">{row.payments}</td><td className="px-4 py-3 text-slate-500">{row.services}</td></tr>)}</tbody></table></div>
          </section>
        </div>

        <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">{t('Operatsiyalar', 'Операции')}</p><h3 className="mt-1 text-xl font-black">{t('Oxirgi to‘lovlar', 'Последние платежи')}</h3></div><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Mijoz, telefon, xizmat…', 'Клиент, телефон, услуга…')} className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-500 sm:w-72" /></div>
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-[10px] font-black uppercase tracking-wider text-slate-400"><th className="px-3 py-3">{t('Mijoz / sana', 'Клиент / дата')}</th><th className="px-3 py-3">{t('Xizmat', 'Услуга')}</th><th className="px-3 py-3">{t('Provayder', 'Провайдер')}</th><th className="px-3 py-3">{t('Summa', 'Сумма')}</th><th className="px-3 py-3">{t('Holat', 'Статус')}</th></tr></thead><tbody className="divide-y">{filteredTransactions.map(row => <tr key={row.id} className="align-top hover:bg-slate-50"><td className="px-3 py-3"><p className="font-bold">{row.customer_name}</p>{row.customer_phone && <p className="text-xs text-slate-500">{row.customer_phone}</p>}<p className="text-[11px] text-slate-400">{dateTime(row.paid_at || row.created_at, ru ? 'ru-RU' : 'uz-UZ')}</p></td><td className="px-3 py-3">{row.services.length ? row.services.map(service => <p key={service.code} className="font-medium">{ru ? service.name_ru : service.name_uz}{service.quantity > 1 ? ' ×' + service.quantity : ''}</p>) : '—'}</td><td className="px-3 py-3 font-bold uppercase">{row.provider}</td><td className="px-3 py-3 font-black whitespace-nowrap">{money(row.amount_uzs)}</td><td className="px-3 py-3"><span className={'rounded-full px-2 py-1 text-xs font-bold ' + (row.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{row.status === 'paid' ? t('To‘langan', 'Оплачен') : row.status}</span></td></tr>)}</tbody></table></div></section>
      </>}
    </div>
  </main>
}
