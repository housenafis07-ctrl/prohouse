'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Lang = 'uz' | 'ru'
type Role = 'buyer' | 'seller'
type Status = 'lead' | 'viewing' | 'offer' | 'deal' | 'payment' | 'contract' | 'cancelled'

type Transaction = { id: string; status: Status; amount: number | null; currency: string; buyer_id: string; seller_id: string }
type TransactionResponse = { transaction: Transaction | null; role: Role | null; nextStatus: Status | null; nextActor: Role | null; canAdvance: boolean; error?: string }

const STEPS: Status[] = ['lead', 'viewing', 'offer', 'deal', 'payment', 'contract']
const labels: Record<Lang, Record<Status, string>> = {
  uz: { lead: 'Murojaat', viewing: 'Ko‘rish', offer: 'Taklif', deal: 'Bitim', payment: 'To‘lov', contract: 'Shartnoma', cancelled: 'Bekor qilingan' },
  ru: { lead: 'Заявка', viewing: 'Просмотр', offer: 'Предложение', deal: 'Сделка', payment: 'Оплата', contract: 'Договор', cancelled: 'Отменена' },
}
const roleLabels: Record<Lang, Record<Role, string>> = { uz: { buyer: 'Xaridor', seller: 'Sotuvchi' }, ru: { buyer: 'Покупатель', seller: 'Продавец' } }
const nextActionLabels: Record<Lang, Record<Status, string>> = {
  uz: { lead: 'Ko‘rishni tasdiqlash', viewing: 'Taklif yuborish', offer: 'Bitimni tasdiqlash', deal: 'To‘lovni tasdiqlash', payment: 'Shartnomaga o‘tish', contract: 'Yakunlangan', cancelled: 'Bekor qilingan' },
  ru: { lead: 'Подтвердить просмотр', viewing: 'Отправить предложение', offer: 'Подтвердить сделку', deal: 'Подтвердить оплату', payment: 'Перейти к договору', contract: 'Завершено', cancelled: 'Отменена' },
}
const actorHints: Record<Lang, Record<Role, string>> = { uz: { buyer: 'Xaridorning navbati', seller: 'Sotuvchining navbati' }, ru: { buyer: 'Ход покупателя', seller: 'Ход продавца' } }

export default function TransactionPanel({ conversationId }: { conversationId: string | null }) {
  const [lang, setLang] = useState<Lang>('uz')
  const [data, setData] = useState<TransactionResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { const saved = window.localStorage.getItem('prohouse-lang'); if (saved === 'ru') setLang('ru') }, [])

  const load = useCallback(async () => {
    if (!conversationId) { setData(null); return }
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/transactions/chat?conversationId=${encodeURIComponent(conversationId)}`, { cache: 'no-store' })
      const result = await response.json().catch(() => ({})) as TransactionResponse
      if (!response.ok) throw new Error(result.error || 'Transaction yuklanmadi.')
      setData(result)
    } catch (e) { setError(e instanceof Error ? e.message : 'Transaction yuklanmadi.'); setData(null) }
    finally { setLoading(false) }
  }, [conversationId])

  useEffect(() => { void load() }, [load])

  const currentIndex = useMemo(() => !data?.transaction || data.transaction.status === 'cancelled' ? -1 : STEPS.indexOf(data.transaction.status), [data])

  const transition = async (status: Status) => {
    if (!data?.transaction || transitioning) return
    setTransitioning(true); setError('')
    try {
      const response = await fetch(`/api/transactions/${data.transaction.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Transaction bosqichini o‘zgartirib bo‘lmadi.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Transaction bosqichini o‘zgartirib bo‘lmadi.') }
    finally { setTransitioning(false) }
  }

  const createTransaction = async () => {
    if (!conversationId || transitioning) return
    setTransitioning(true); setError('')
    try {
      const response = await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Bitim yaratilmadi.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Bitim yaratilmadi.') }
    finally { setTransitioning(false) }
  }

  if (!conversationId || loading && !data) return null
  if (error && !data) return <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  if (!data?.transaction) return (
    <div className="border-b border-emerald-100 bg-emerald-50/60 p-4 sm:p-5"><div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-wider text-emerald-600">{lang === 'uz' ? 'BITIM' : 'СДЕЛКА'}</p><p className="mt-1 text-sm font-extrabold text-slate-900">{lang === 'uz' ? 'E’lon bo‘yicha bitim' : 'Сделка по объявлению'}</p><p className="mt-1 text-xs text-slate-500">{lang === 'uz' ? 'Murojaat asosida bitimni boshlashingiz mumkin.' : 'Начните сделку на основе заявки.'}</p></div><button type="button" onClick={() => void createTransaction()} disabled={transitioning} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60">{transitioning ? (lang === 'uz' ? 'Ochilyapti...' : 'Открытие...') : (lang === 'uz' ? 'Bitimni boshlash' : 'Начать сделку')}</button></div>{error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}</div></div>
  )

  const transaction = data.transaction
  const status = transaction.status
  const nextStatus = data.nextStatus
  const nextActor = data.nextActor
  const role = data.role
  const canCancel = status !== 'contract' && status !== 'cancelled'

  return <div className="border-b border-emerald-100 bg-emerald-50/60 p-4 sm:p-5"><div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-wider text-emerald-600">{lang === 'uz' ? 'BITIM' : 'СДЕЛКА'}</p><h2 className="mt-1 text-sm font-extrabold text-slate-900">{lang === 'uz' ? 'E’lon bo‘yicha bitim' : 'Сделка по объявлению'}</h2></div>{role && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{roleLabels[lang][role]}</span>}</div><div className="mt-5 grid grid-cols-6 gap-1">{STEPS.map((step, index) => <div key={step} className="min-w-0 text-center"><div className={`mx-auto h-3 w-3 rounded-full ${currentIndex >= index ? 'bg-emerald-600' : 'bg-slate-200'}`} /><p className={`mt-2 truncate text-[10px] font-bold ${status === step ? 'text-emerald-700' : 'text-slate-500'}`}>{labels[lang][step]}</p></div>)}</div><div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">{lang === 'uz' ? 'Hozirgi holat:' : 'Текущий статус:'}</span><strong className="text-sm text-slate-900">{labels[lang][status]}</strong>{nextActor && nextStatus && <span className="text-xs text-slate-500">· {actorHints[lang][nextActor]}</span>}<div className="ml-auto flex flex-wrap gap-2">{data.canAdvance && nextStatus && <button type="button" onClick={() => void transition(nextStatus)} disabled={transitioning} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60">{transitioning ? (lang === 'uz' ? 'Saqlanmoqda...' : 'Сохранение...') : nextActionLabels[lang][nextStatus]}</button>}{!data.canAdvance && nextActor && <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">{roleLabels[lang][nextActor]} {lang === 'uz' ? 'davom ettiradi' : 'продолжает'}</span>}{canCancel && <button type="button" onClick={() => void transition('cancelled')} disabled={transitioning} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60">{lang === 'uz' ? 'Bekor qilish' : 'Отменить'}</button>}</div></div>{error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}</div></div>
}
