'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/app/components/I18nProvider'

type Customer = {
  id: string
  name: string
  telegram_name: string | null
  telegram_username: string | null
  telegram_id: string | null
  phone: string | null
  account_type: string | null
  listing_count: number
  paid_total_uzs: number
}

const money = (value: number) => new Intl.NumberFormat('ru-RU').format(Math.round(value)) + ' so‘m'

export default function AdminCustomersPage() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, ruText: string) => ru ? ruText : uz

  const [rows, setRows] = useState<Customer[]>([])
  const [q, setQ] = useState('')
  const [accountType, setAccountType] = useState('')
  const [payment, setPayment] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (accountType) params.set('accountType', accountType)
      if (payment) params.set('payment', payment)
      const response = await fetch(`/api/admin/customers?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t('Yuklashda xatolik', 'Ошибка загрузки'))
      setRows(data.rows || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Xatolik yuz berdi', 'Произошла ошибка'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [accountType, payment])

  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(row => [row.name, row.phone, row.id, row.telegram_name, row.telegram_username, row.telegram_id]
      .some(value => String(value || '').toLowerCase().includes(needle)))
  }, [rows, q])

  const exportCsv = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ export: 'csv' })
      if (q.trim()) params.set('q', q.trim())
      if (accountType) params.set('accountType', accountType)
      if (payment) params.set('payment', payment)
      const response = await fetch(`/api/admin/customers?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || t('Eksportda xatolik', 'Ошибка экспорта'))
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'royalhouse-mijozlar.csv'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Eksportda xatolik', 'Ошибка экспорта'))
    } finally {
      setExporting(false)
    }
  }

  const totalPaid = filteredRows.reduce((sum, row) => sum + row.paid_total_uzs, 0)

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
        <div>
          <Link href="/admin" className="text-sm font-bold text-emerald-600">← {t('Admin', 'Админ')}</Link>
          <h1 className="mt-1 text-3xl font-black">{t('Barcha mijozlar', 'Все клиенты')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('Jismoniy shaxslar va hamkorlarning yagona ro‘yxati.', 'Единый список физических лиц и партнёров.')}</p>
        </div>
        <button onClick={exportCsv} disabled={exporting || loading} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
          {exporting ? t('Yuklanmoqda...', 'Загрузка...') : 'Excelga yuklash'}
        </button>
      </div>
    </header>

    <div className="mx-auto max-w-7xl px-4 py-7">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{t('Mijozlar', 'Клиенты')}</p><p className="mt-2 text-3xl font-black">{filteredRows.length}</p></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{t('E’lonlar', 'Объявления')}</p><p className="mt-2 text-3xl font-black">{filteredRows.reduce((sum, row) => sum + row.listing_count, 0)}</p></div>
        <div className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{t('Monetizatsiya tushumi', 'Доход от монетизации')}</p><p className="mt-2 text-2xl font-black">{money(totalPaid)}</p></div>
      </div>

      <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 gap-3">
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void load() }} placeholder={t('Ism, telefon, ID yoki Telegram username...', 'Имя, телефон, ID или Telegram username...')} className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />
            <button onClick={() => void load()} className="rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white">{t('Qidirish', 'Поиск')}</button>
          </div>
          <button onClick={() => setShowFilters(value => !value)} className={`rounded-2xl border px-5 py-3 font-bold ${showFilters || accountType || payment ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}>
            ⚙ {t('Filtr', 'Фильтр')}
          </button>
        </div>

        {showFilters && <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-3">
          <label className="text-sm font-bold text-slate-600">
            {t('Mijoz turi', 'Тип клиента')}
            <select value={accountType} onChange={e => setAccountType(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal outline-none">
              <option value="">{t('Barchasi', 'Все')}</option>
              <option value="individual">{t('Jismoniy shaxs', 'Физическое лицо')}</option>
              <option value="partner">{t('Hamkor', 'Партнёр')}</option>
              <option value="realtor">{t('Rieltor', 'Риелтор')}</option>
              <option value="agency">{t('Agentlik', 'Агентство')}</option>
            </select>
          </label>
          <label className="text-sm font-bold text-slate-600">
            {t('Monetizatsiya', 'Монетизация')}
            <select value={payment} onChange={e => setPayment(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal outline-none">
              <option value="">{t('Barchasi', 'Все')}</option>
              <option value="paid">{t('To‘lov qilgan', 'Оплачивали')}</option>
              <option value="unpaid">{t('To‘lov qilmagan', 'Не оплачивали')}</option>
            </select>
          </label>
          <div className="flex items-end"><button onClick={() => { setQ(''); setAccountType(''); setPayment('') }} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700">{t('Filtrlarni tozalash', 'Сбросить фильтры')}</button></div>
        </div>}

        {error && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
        {loading ? <div className="p-10 text-center text-slate-500">{t('Mijozlar yuklanmoqda...', 'Загрузка клиентов...')}</div> : filteredRows.length === 0 ? <div className="p-10 text-center text-slate-500">{t('Mijozlar topilmadi.', 'Клиенты не найдены.')}</div> : <div className="overflow-x-auto">
          <table className="min-w-[1150px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4">{t('Ismi familiyasi', 'Имя и фамилия')}</th>
                <th className="px-5 py-4">Telegram</th>
                <th className="px-5 py-4">{t('Telefon', 'Телефон')}</th>
                <th className="px-5 py-4">ID</th>
                <th className="px-5 py-4">{t('E’lonlar', 'Объявления')}</th>
                <th className="px-5 py-4">{t('Monetizatsiyaga to‘langan', 'Оплачено за монетизацию')}</th>
                <th className="px-5 py-4">{t('Turi', 'Тип')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map(row => <tr key={row.id} className="hover:bg-slate-50/80">
                <td className="px-5 py-4"><div className="font-black text-slate-900">{row.name}</div><div className="mt-1 text-xs text-slate-400">{row.telegram_name ? `(${row.telegram_name})` : 'Telegram nomi mavjud emas'}</div></td>
                <td className="px-5 py-4"><div className="font-bold text-slate-700">{row.telegram_username ? <a className="text-sky-600 hover:underline" href={`https://t.me/${row.telegram_username.replace(/^@/, '')}`} target="_blank" rel="noreferrer">@{row.telegram_username.replace(/^@/, '')}</a> : '—'}</div><div className="mt-1 text-xs text-slate-400">ID: {row.telegram_id || '—'}</div></td>
                <td className="px-5 py-4 font-medium">{row.phone || '—'}</td>
                <td className="px-5 py-4"><span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold">{row.id}</span></td>
                <td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-3 py-1 font-black text-emerald-700">{row.listing_count}</span></td>
                <td className="px-5 py-4 font-black">{money(row.paid_total_uzs)}</td>
                <td className="px-5 py-4 text-slate-500">{row.account_type || '—'}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </section>
    </div>
  </main>
}
