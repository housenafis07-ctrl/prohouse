'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

type ViewingRequest = {
  id: string
  listing_id: string
  requester_id: string
  owner_id: string
  requested_at: string
  note: string | null
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed'
  created_at: string
  listing: { id: string; title: string; title_ru?: string | null; city: string; district: string | null; price: number; currency: string } | null
}

export default function ViewingRequestsPage() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const [requests, setRequests] = useState<ViewingRequest[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/viewing-requests', { cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (response.status === 401) { window.location.href = '/register?redirect=/account/viewings'; return }
      if (!response.ok) throw new Error(result.error || 'So‘rovlarni yuklab bo‘lmadi.')
      setRequests(result.requests || [])
      // User role is inferred per row; no private account identifiers are exposed in the UI.
      setUserId(result.currentUserId || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik yuz berdi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const updateStatus = async (id: string, status: ViewingRequest['status']) => {
    if (busyId) return
    setBusyId(id)
    setError('')
    try {
      const response = await fetch('/api/viewing-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Holatni yangilab bo‘lmadi.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik yuz berdi.')
    } finally {
      setBusyId('')
    }
  }

  const label = (status: ViewingRequest['status']) => ({
    pending: ru ? 'Kutilmoqda' : 'Kutilmoqda',
    confirmed: ru ? 'Подтверждено' : 'Tasdiqlandi',
    declined: ru ? 'Отклонено' : 'Rad etildi',
    cancelled: ru ? 'Отменено' : 'Bekor qilindi',
    completed: ru ? 'Завершено' : 'Yakunlandi',
  })[status]

  const date = (value: string) => new Intl.DateTimeFormat(ru ? 'ru-RU' : 'uz-UZ', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tashkent' }).format(new Date(value))

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/account" className="font-black text-emerald-700">← {ru ? 'Кабинет' : 'Shaxsiy kabinet'}</Link>
        <button type="button" onClick={() => void load()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">{ru ? 'Обновить' : 'Yangilash'}</button>
      </div>
    </header>
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-xs font-black uppercase tracking-widest text-emerald-700">RoyalHouse</p>
      <h1 className="mt-1 text-3xl font-black">{ru ? 'Просмотры недвижимости' : 'Ko‘rish so‘rovlari'}</h1>
      <p className="mt-2 text-sm text-slate-500">{ru ? 'Ваши запросы на просмотр и заявки по вашим объявлениям.' : 'Siz yuborgan va e’lonlaringizga kelgan ko‘rish so‘rovlari.'}</p>
      {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      {loading ? <div className="mt-6 rounded-2xl bg-white p-10 text-center text-slate-500">{ru ? 'Загрузка...' : 'Yuklanmoqda...'}</div>
        : requests.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">{ru ? 'Пока нет запросов на просмотр.' : 'Hozircha ko‘rish so‘rovlari yo‘q.'}</div>
        : <div className="mt-6 space-y-4">{requests.map(item => {
          const isOwner = Boolean(userId && item.owner_id === userId)
          const title = ru ? item.listing?.title_ru || item.listing?.title : item.listing?.title
          return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{label(item.status)}</span>
                  <span className="text-xs font-semibold text-slate-400">{isOwner ? (ru ? 'Входящий запрос' : 'Kelgan so‘rov') : (ru ? 'Мой запрос' : 'Mening so‘rovim')}</span>
                </div>
                <h2 className="mt-3 text-lg font-black">{title || (ru ? 'Объявление' : 'E’lon')}</h2>
                <p className="mt-1 text-sm text-slate-500">{[item.listing?.city, item.listing?.district].filter(Boolean).join(', ')}</p>
              </div>
              <div className="text-sm font-black text-slate-800">{date(item.requested_at)}</div>
            </div>
            {item.note && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{item.note}</p>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Link href={`/listings/${item.listing_id}`} className="text-sm font-bold text-emerald-700 hover:underline">{ru ? 'Открыть объявление' : 'E’lonni ochish'} →</Link>
              <div className="flex flex-wrap gap-2">
                {isOwner && item.status === 'pending' && <>
                  <button type="button" disabled={busyId === item.id} onClick={() => void updateStatus(item.id, 'confirmed')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{ru ? 'Подтвердить' : 'Tasdiqlash'}</button>
                  <button type="button" disabled={busyId === item.id} onClick={() => void updateStatus(item.id, 'declined')} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50">{ru ? 'Отклонить' : 'Rad etish'}</button>
                </>}
                {isOwner && item.status === 'confirmed' && <button type="button" disabled={busyId === item.id} onClick={() => void updateStatus(item.id, 'completed')} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{ru ? 'Завершить просмотр' : 'Ko‘rishni yakunlash'}</button>}
                {!isOwner && ['pending', 'confirmed'].includes(item.status) && <button type="button" disabled={busyId === item.id} onClick={() => void updateStatus(item.id, 'cancelled')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-50">{ru ? 'Отменить запрос' : 'So‘rovni bekor qilish'}</button>}
              </div>
            </div>
          </article>
        })}</div>}
    </div>
  </main>
}
