'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

type Application = {
  id: string
  developer_name: string
  description: string | null
  website: string | null
  phone: string | null
  verification_status: string
  created_at: string
  metadata: Record<string, unknown> | null
  partner_profiles: { display_name: string | null; company_name: string | null; partner_type: string | null }
  applicant: { full_name: string | null; phone: string | null; company_name: string | null; inn: string | null } | null
}

const statusLabel: Record<string, [string, string]> = {
  pending: ['Tekshiruv kutilmoqda', 'Ожидает проверки'],
  verified: ['Tasdiqlangan', 'Подтверждён'],
  rejected: ['Rad etilgan', 'Отклонён'],
}

export default function DeveloperApplicationsPage() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const t = (uz: string, rr: string) => ru ? rr : uz
  const [items, setItems] = useState<Application[]>([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/developers', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'LOAD_FAILED')
      setItems(data.applications || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Yuklashda xatolik', 'Ошибка загрузки'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => filter === 'all' ? items : items.filter(item => item.verification_status === filter), [items, filter])
  const counts = useMemo(() => ({
    pending: items.filter(item => item.verification_status === 'pending').length,
    verified: items.filter(item => item.verification_status === 'verified').length,
    rejected: items.filter(item => item.verification_status === 'rejected').length,
  }), [items])

  async function review(item: Application, status: 'pending' | 'verified' | 'rejected') {
    const rejectionReason = status === 'rejected' ? window.prompt(t('Rad etish sababini kiriting:', 'Укажите причину отказа:'))?.trim() || '' : ''
    if (status === 'rejected' && !rejectionReason) return
    setBusy(item.id)
    setError('')
    try {
      const response = await fetch('/api/admin/developers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developerProfileId: item.id, status, rejectionReason }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'REVIEW_FAILED')
      setItems(current => current.map(row => row.id === item.id ? {
        ...row,
        verification_status: status,
        metadata: {
          ...(row.metadata || {}),
          admin_review: { status, reason: status === 'rejected' ? rejectionReason : null, reviewed_at: data.reviewedAt },
        },
      } : row))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Saqlashda xatolik', 'Ошибка сохранения'))
    } finally {
      setBusy(null)
    }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin" className="font-black text-emerald-700">← {t('Admin panel', 'Панель администратора')}</Link>
        <button onClick={() => void load()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">{t('Yangilash', 'Обновить')}</button>
      </div>
      <header className="mt-5 rounded-3xl bg-slate-900 p-7 text-white">
        <p className="text-sm font-bold text-emerald-300">ROYALHOUSE · DEVELOPER</p>
        <h1 className="mt-2 text-3xl font-black">{t('Developer arizalari', 'Заявки девелоперов')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{t('Hamkor kompaniyalar ma’lumotlarini tekshiring, arizani ko‘rib chiqing va developer maqomini tasdiqlang yoki rad eting.', 'Проверяйте данные компаний-партнёров и подтверждайте или отклоняйте статус девелопера.')}</p>
      </header>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {(['pending', 'verified', 'rejected'] as const).map(status => <button key={status} onClick={() => setFilter(status)} className={`rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ${filter === status ? 'ring-2 ring-emerald-500' : 'ring-slate-200'}`}>
          <p className="text-xs font-bold text-slate-500">{statusLabel[status][ru ? 1 : 0]}</p>
          <p className="mt-1 text-2xl font-black">{counts[status]}</p>
        </button>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(['pending', 'verified', 'rejected', 'all'] as const).map(status => <button key={status} onClick={() => setFilter(status)} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === status ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{status === 'all' ? t('Barchasi', 'Все') : statusLabel[status][ru ? 1 : 0]}</button>)}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {loading ? <div className="mt-6 rounded-2xl bg-white p-10 text-center">{t('Yuklanmoqda...', 'Загрузка...')}</div> : filtered.length === 0 ? <div className="mt-6 rounded-2xl bg-white p-10 text-center text-slate-500">{t('Bu bo‘limda arizalar yo‘q.', 'Заявок в этом разделе нет.')}</div> : <div className="mt-5 space-y-4">
        {filtered.map(item => {
          const reviewMeta = item.metadata?.admin_review as { reason?: string | null; reviewed_at?: string } | undefined
          return <article key={item.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">{statusLabel[item.verification_status]?.[ru ? 1 : 0] || item.verification_status}</span>
                <h2 className="mt-3 text-xl font-black text-slate-900">{item.developer_name}</h2>
                <p className="mt-1 text-sm text-slate-500">{item.partner_profiles?.company_name || item.partner_profiles?.display_name || item.applicant?.company_name || '—'}</p>
              </div>
              <p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString(ru ? 'ru-RU' : 'uz-UZ')}</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{t('Ariza beruvchi', 'Заявитель')}</p><p className="mt-1 font-bold">{item.applicant?.full_name || '—'}</p><p className="text-sm text-slate-600">{item.applicant?.phone || item.phone || '—'}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">INN</p><p className="mt-1 font-bold">{item.applicant?.inn || '—'}</p><p className="text-sm text-slate-600">{item.partner_profiles?.partner_type || '—'}</p></div>
              <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2"><p className="text-xs text-slate-400">{t('Kompaniya haqida', 'О компании')}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.description || '—'}</p></div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{t('Veb-sayt', 'Сайт')}</p>{item.website ? <a href={item.website} target="_blank" rel="noreferrer" className="mt-1 block break-all font-bold text-emerald-700">{item.website}</a> : '—'}</div>
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{t('Aloqa telefoni', 'Телефон')}</p><p className="mt-1 font-bold">{item.phone || item.applicant?.phone || '—'}</p></div>
            </div>
            {reviewMeta?.reason && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700"><b>{t('Rad etish sababi:', 'Причина отказа:')}</b> {reviewMeta.reason}</p>}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {item.verification_status !== 'pending' && <button disabled={busy === item.id} onClick={() => void review(item, 'pending')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold">{t('Tekshiruvga qaytarish', 'Вернуть на проверку')}</button>}
              {item.verification_status !== 'verified' && <button disabled={busy === item.id} onClick={() => void review(item, 'verified')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{t('Tasdiqlash', 'Подтвердить')}</button>}
              {item.verification_status !== 'rejected' && <button disabled={busy === item.id} onClick={() => void review(item, 'rejected')} className="rounded-xl bg-red-50 px-4 py-2 text-sm font-black text-red-700 disabled:opacity-50">{t('Rad etish', 'Отклонить')}</button>}
            </div>
          </article>
        })}
      </div>}
    </div>
  </main>
}
