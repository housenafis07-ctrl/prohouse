'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

type SummaryItem = { amount_uzs: number; payments: number; customers: number }
type ServiceSummary = { code: string; name_uz: string; name_ru: string; product_type: string; payments: number; customers: number; orders: number; share_percent: number; all_time: number; today: number; month: number; year: number }
type Transaction = {
  id: string; order_id: string; customer_id: string | null; customer_name: string; customer_phone: string | null
  provider: string; status: string; amount_uzs: number; currency: string; provider_payment_id: string | null
  paid_at: string | null; created_at: string
  services: { code: string; name_uz: string; name_ru: string; product_type: string; quantity: number; listing_id: string | null }[]
}
type Report = { summary: { all_time: SummaryItem; today: SummaryItem; month: SummaryItem; year: SummaryItem }; by_service: ServiceSummary[]; transactions: Transaction[]; truncated: boolean }

const money = (amount: number) => new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 }).format(amount) + ' so‘m'
const dateTime = (value: string | null, locale: string) => value ? new Date(value).toLocaleString(locale) : '—'

export default function PaymentReportPage() {
  const { lang, setLang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, ruText: string) => ru ? ruText : uz
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('all')
  const [provider, setProvider] = useState('all')
  const [search, setSearch] = useState('')
  const [servicePeriod, setServicePeriod] = useState<'today' | 'month' | 'year' | 'all_time'>('month')

  async function load() {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/admin/payment-report', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) { window.location.href = '/admin/login'; return }
      if (!response.ok) throw new Error(data.error || t('Hisobotni yuklab bo‘lmadi', 'Не удалось загрузить отчёт'))
      setReport(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Noma’lum xatolik', 'Неизвестная ошибка'))
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const transactions = useMemo(() => (report?.transactions || []).filter(row => {
    if (status !== 'all' && row.status !== status) return false
    if (provider !== 'all' && row.provider !== provider) return false
    const haystack = [row.customer_name, row.customer_phone || '', row.order_id, row.provider_payment_id || '', ...row.services.map(s => s.name_uz + ' ' + s.name_ru)].join(' ').toLowerCase()
    return haystack.includes(search.toLowerCase().trim())
  }), [report, status, provider, search])

  function exportCsv() {
    const columns = ['date', 'customer', 'phone', 'service', 'amount_uzs', 'provider', 'status', 'order_id', 'provider_payment_id']
    const rows = transactions.map(row => [
      row.paid_at || row.created_at, row.customer_name, row.customer_phone || '',
      row.services.map(s => (ru ? s.name_ru : s.name_uz) + (s.quantity > 1 ? ' x' + s.quantity : '')).join('; '),
      row.amount_uzs, row.provider, row.status, row.order_id, row.provider_payment_id || ''
    ])
    const csv = [columns, ...rows].map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'royalhouse-payment-report.csv'; anchor.click(); URL.revokeObjectURL(url)
  }

  const stats = report?.summary
  const statCards = [
    { label: t('Bugun qabul qilingan', 'Принято сегодня'), item: stats?.today, note: t('To‘langan operatsiyalar', 'Успешные платежи') },
    { label: t('Oy boshidan', 'С начала месяца'), item: stats?.month, note: t('Joriy oy tushumi', 'Поступления за текущий месяц') },
    { label: t('Yil boshidan', 'С начала года'), item: stats?.year, note: t('Joriy yil tushumi', 'Поступления за текущий год') },
    { label: t('Jami tushum', 'Всего поступлений'), item: stats?.all_time, note: t('Barcha muvaffaqiyatli to‘lovlar', 'Все успешные платежи') },
  ]

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
      <div className="flex items-center gap-4"><Link href="/admin" className="font-black text-emerald-700">← {t('Admin', 'Админ')}</Link><h1 className="font-black">{t('To‘lovlar hisoboti', 'Отчёт по платежам')}</h1></div>
      <div className="flex items-center gap-2"><button onClick={() => setLang('uz')} className={'rounded-lg border px-3 py-2 text-xs font-bold ' + (!ru ? 'bg-slate-900 text-white' : 'bg-white')}>UZ</button><button onClick={() => setLang('ru')} className={'rounded-lg border px-3 py-2 text-xs font-bold ' + (ru ? 'bg-slate-900 text-white' : 'bg-white')}>RU</button><button onClick={() => void load()} className="rounded-xl border bg-white px-3 py-2 text-sm font-bold">{t('Yangilash', 'Обновить')}</button></div>
    </div></header>
    <div className="mx-auto max-w-7xl px-4 py-7">
      <p className="font-bold text-emerald-600">{t('Moliya va tushum nazorati', 'Финансы и контроль поступлений')}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-3xl font-black text-slate-900">{t('To‘lovlar statistikasi', 'Статистика платежей')}</h2><p className="mt-2 text-sm text-slate-500">{t('Faqat provayder tasdiqlagan muvaffaqiyatli to‘lovlar tushumga qo‘shiladi.', 'В поступления включаются только успешные платежи, подтверждённые платёжным провайдером.')}</p></div><button onClick={exportCsv} disabled={!transactions.length} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{t('CSV yuklab olish', 'Скачать CSV')}</button></div>
      {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading && <p className="mt-6 text-sm text-slate-500">{t('Hisobot yuklanmoqda…', 'Загружается отчёт…')}</p>}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(card => <section key={card.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100"><p className="text-sm font-medium text-slate-500">{card.label}</p><p className="mt-2 break-words text-2xl font-black text-slate-900">{card.item ? money(card.item.amount_uzs) : '—'}</p><p className="mt-2 text-xs text-slate-500">{card.item ? card.item.payments + ' ' + t('ta to‘lov', 'платежей') + ' · ' + card.item.customers + ' ' + t('mijoz', 'клиентов') : card.note}</p></section>)}
      </div>
      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)]">
        <section className="rounded-3xl bg-white p-5 shadow-sm"><h3 className="text-lg font-black">{t('Monetizatsiya yo‘nalishlari', 'Направления монетизации')}</h3><p className="mt-1 text-sm text-slate-500">{t('Tushum, mijozlar soni va umumiy tushumdagi ulush bo‘yicha taqqoslash', 'Сравнение поступлений, клиентов и доли в общей выручке')}</p>
          <div className="mt-4 flex flex-wrap gap-2">{([{value:'today',label:t('Bugun','Сегодня')},{value:'month',label:t('Oy','Месяц')},{value:'year',label:t('Yil','Год')},{value:'all_time',label:t('Jami','Всё время')}] as const).map(option => <button key={option.value} onClick={() => setServicePeriod(option.value)} className={'rounded-lg border px-3 py-2 text-xs font-bold ' + (servicePeriod === option.value ? 'border-slate-900 bg-slate-900 text-white' : 'bg-white text-slate-600')}>{option.label}</button>)}</div>
          {!report?.by_service.length ? <p className="py-8 text-center text-sm text-slate-400">{t('Hozircha to‘langan xizmatlar yo‘q', 'Пока нет оплаченных услуг')}</p> : <div className="mt-4 divide-y">{report.by_service.slice().sort((a,b) => b[servicePeriod] - a[servicePeriod]).map(item => <div key={item.code} className="py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold">{ru ? item.name_ru : item.name_uz}</p><p className="mt-1 text-xs text-slate-500">{item.payments} {t('to‘lov','платежей')} · {item.customers} {t('mijoz','клиентов')}</p></div><p className="shrink-0 text-right font-black">{money(item[servicePeriod])}</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width: Math.min(100, item.share_percent) + '%'}} /></div><p className="mt-1 text-right text-xs text-slate-500">{t('Jami tushumdagi ulushi','Доля общей выручки')}: {item.share_percent}%</p></div>)}</div>}
        </section>
        <section className="min-w-0 rounded-3xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">{t('Tranzaksiyalar', 'Транзакции')}</h3><p className="mt-1 text-sm text-slate-500">{t('Oxirgi 1 000 ta operatsiya', 'Последние 1 000 операций')}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{transactions.length}</span></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3"><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Mijoz, telefon, xizmat…', 'Клиент, телефон, услуга…')} className="min-w-0 rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm"><option value="all">{t('Barcha holatlar', 'Все статусы')}</option><option value="paid">{t('To‘langan', 'Оплачен')}</option><option value="pending">{t('Kutilmoqda', 'Ожидает')}</option><option value="processing">{t('Jarayonda', 'В обработке')}</option><option value="failed">{t('Xato', 'Ошибка')}</option><option value="cancelled">{t('Bekor qilingan', 'Отменён')}</option></select>
            <select value={provider} onChange={e => setProvider(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm"><option value="all">{t('Barcha provayderlar', 'Все провайдеры')}</option><option value="payme">Payme</option><option value="click">Click</option></select>
          </div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-400"><th className="px-2 py-3">{t('Mijoz / sana', 'Клиент / дата')}</th><th className="px-2 py-3">{t('Xizmat', 'Услуга')}</th><th className="px-2 py-3">{t('Provayder', 'Провайдер')}</th><th className="px-2 py-3">{t('Summa', 'Сумма')}</th><th className="px-2 py-3">{t('Holat', 'Статус')}</th></tr></thead><tbody className="divide-y">
            {transactions.map(row => <tr key={row.id} className="align-top hover:bg-slate-50"><td className="px-2 py-3"><p className="font-bold text-slate-900">{row.customer_name}</p>{row.customer_phone && <p className="mt-1 text-xs text-slate-500">{row.customer_phone}</p>}<p className="mt-1 text-xs text-slate-400">{dateTime(row.paid_at || row.created_at, ru ? 'ru-RU' : 'uz-UZ')}</p><p className="mt-1 max-w-40 truncate text-[10px] text-slate-400" title={row.order_id}>{row.order_id}</p></td><td className="px-2 py-3">{row.services.length ? row.services.map(s => <p key={s.code} className="mb-1 font-medium">{ru ? s.name_ru : s.name_uz}{s.quantity > 1 ? ' ×' + s.quantity : ''}</p>) : <span className="text-slate-400">—</span>}</td><td className="px-2 py-3 font-semibold uppercase">{row.provider}</td><td className="px-2 py-3 whitespace-nowrap font-black">{money(row.amount_uzs)}</td><td className="px-2 py-3"><span className={'rounded-full px-2 py-1 text-xs font-bold ' + (row.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : row.status === 'failed' || row.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>{row.status === 'paid' ? t('To‘langan', 'Оплачен') : row.status === 'pending' ? t('Kutilmoqda', 'Ожидает') : row.status === 'processing' ? t('Jarayonda', 'В обработке') : row.status === 'cancelled' ? t('Bekor qilingan', 'Отменён') : t('Xato', 'Ошибка')}</span></td></tr>)}
          </tbody></table>{!loading && !transactions.length && <p className="py-8 text-center text-sm text-slate-400">{t('Filtr bo‘yicha operatsiya topilmadi.', 'По выбранным фильтрам операции не найдены.')}</p>}</div>
        </section>
      </div>
      {report?.truncated && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{t('Eslatma: tarixiy statistika uchun 10 000 tagacha to‘lov yuklandi. To‘liq tarix uchun bazaviy agregatsiya kerak bo‘ladi.', 'Внимание: для статистики загружено до 10 000 платежей. Для полной истории потребуется агрегация на уровне БД.')}</p>}
    </div>
  </main>
}
