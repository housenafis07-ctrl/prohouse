'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/app/components/I18nProvider'

type Lang = 'uz' | 'ru'
type Role = 'buyer' | 'seller'
type Status = 'lead' | 'viewing' | 'offer' | 'deal' | 'payment' | 'contract' | 'cancelled'

type Transaction = { id: string; status: Status; amount: number | null; currency: string; buyer_id: string; seller_id: string }
type ServiceOrder = {
  id: string
  listing_id: string
  lead_id: string
  buyer_id: string
  seller_id: string
  status: 'requested' | 'agreed' | 'completed' | 'cancelled'
  buyer_agreed_at: string | null
  seller_agreed_at: string | null
  buyer_completed_at: string | null
  seller_completed_at: string | null
}
type TransactionResponse = {
  kind?: 'property' | 'service'
  transaction: Transaction | null
  serviceOrder?: ServiceOrder | null
  listing?: { id: string; title?: string | null } | null
  role: Role | null
  nextStatus?: Status | null
  nextActor?: Role | null
  canAdvance: boolean
  agreedByMe?: boolean
  completedByMe?: boolean
  agreedByBoth?: boolean
  completedByBoth?: boolean
  error?: string
}

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
  const { lang } = useI18n()
  const [data, setData] = useState<TransactionResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [error, setError] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [reviewError, setReviewError] = useState('')

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

  const ensureServiceOrder = async () => {
    if (!conversationId) throw new Error('Suhbat aniqlanmadi.')
    if (data?.serviceOrder) return data.serviceOrder
    const response = await fetch('/api/service-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId }) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.serviceOrder) throw new Error(result.error || 'Xizmat kelishuvini boshlashda xatolik.')
    return result.serviceOrder as ServiceOrder
  }

  const serviceAction = async (action: 'agree' | 'complete') => {
    if (!conversationId || transitioning || !data?.kind || data.kind !== 'service') return
    setTransitioning(true); setError('')
    try {
      const order = await ensureServiceOrder()
      const response = await fetch(`/api/service-orders/${order.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Xizmat bosqichini saqlab bo‘lmadi.')
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Xizmat bosqichini saqlab bo‘lmadi.') }
    finally { setTransitioning(false) }
  }

  const submitServiceReview = async () => {
    if (!data?.listing?.id || data.role !== 'buyer' || reviewRating < 1 || reviewSubmitting) return
    setReviewSubmitting(true)
    setReviewError('')
    try {
      const response = await fetch('/api/listings/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: data.listing.id, rating: reviewRating, review: reviewText.trim() }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Baholashni saqlab bo‘lmadi.')
      setReviewSubmitted(true)
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Baholashni saqlab bo‘lmadi.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  const openServiceReview = () => {
    if (data?.role !== 'buyer') return
    setReviewError('')
    setReviewOpen(true)
  }

  const closeServiceReview = () => {
    if (reviewSubmitting) return
    setReviewOpen(false)
    if (reviewSubmitted) {
      setReviewRating(0)
      setReviewText('')
      setReviewSubmitted(false)
    }
  }

  if (!conversationId || loading && !data) return null
  if (error && !data) return <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>

  if (data?.kind === 'service') {
    const order = data.serviceOrder
    const status = order?.status ?? 'requested'
    const agreedByMe = Boolean(data.agreedByMe)
    const agreedByBoth = Boolean(data.agreedByBoth)
    const completedByMe = Boolean(data.completedByMe)
    const completedByBoth = Boolean(data.completedByBoth)
    const serviceStep = status === 'completed' || completedByBoth ? 4 : status === 'agreed' || agreedByBoth ? 2 : 1
    const serviceLabels = lang === 'ru'
      ? ['Заявка', 'Договорились', 'Услуга выполнена', 'Оценка']
      : ['Murojaat', 'Kelishildi', 'Xizmat yakunlandi', 'Baholash']
    const currentLabel = serviceLabels[serviceStep - 1]

    return <>
      <div className="border-b border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-emerald-600">{lang === 'ru' ? 'УСЛУГА' : 'XIZMAT'}</p>
              <h2 className="mt-1 text-sm font-extrabold text-slate-900">{lang === 'ru' ? 'Статус оказания услуги' : 'Xizmat ko‘rsatish jarayoni'}</h2>
              <p className="mt-1 text-xs text-slate-500">{lang === 'ru' ? 'Статус подтверждается обеими сторонами.' : 'Bosqichlar mijoz va xizmat ko‘rsatuvchi tomonidan tasdiqlanadi.'}</p>
            </div>
            {data.role && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{roleLabels[lang][data.role]}</span>}
          </div>

          <div className="mt-5 grid grid-cols-4 gap-1">
            {serviceLabels.map((step, index) => <div key={step} className="min-w-0 text-center">
              <div className={`mx-auto h-3 w-3 rounded-full ${serviceStep >= index + 1 ? 'bg-emerald-600' : 'bg-slate-200'}`} />
              <p className={`mt-2 truncate text-[10px] font-bold ${serviceStep === index + 1 ? 'text-emerald-700' : 'text-slate-500'}`}>{step}</p>
            </div>)}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
            <span className="text-xs text-slate-500">{lang === 'ru' ? 'Текущий статус:' : 'Hozirgi holat:'}</span>
            <strong className="text-sm text-slate-900">{currentLabel}</strong>
            <div className="ml-auto flex flex-wrap gap-2">
              {status === 'requested' && !agreedByMe && <button type="button" onClick={() => void serviceAction('agree')} disabled={transitioning} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60">{transitioning ? (lang === 'ru' ? 'Сохраняем...' : 'Saqlanmoqda...') : (lang === 'ru' ? 'Договорились' : 'Kelishildi')}</button>}
              {status === 'requested' && agreedByMe && !agreedByBoth && <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">{lang === 'ru' ? 'Ждём подтверждение второй стороны' : 'Ikkinchi tomon tasdig‘i kutilmoqda'}</span>}
              {status === 'agreed' && !completedByMe && <button type="button" onClick={() => void serviceAction('complete')} disabled={transitioning} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-60">{transitioning ? (lang === 'ru' ? 'Сохраняем...' : 'Saqlanmoqda...') : (lang === 'ru' ? 'Услуга выполнена' : 'Xizmat yakunlandi')}</button>}
              {status === 'agreed' && completedByMe && !completedByBoth && <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">{lang === 'ru' ? 'Ждём подтверждение выполнения' : 'Xizmat bajarilgani bo‘yicha ikkinchi tomon tasdig‘i kutilmoqda'}</span>}
              {status === 'completed' && data.role === 'buyer' && data.listing?.id && !reviewSubmitted && <button type="button" onClick={openServiceReview} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700">{lang === 'ru' ? 'Оценить услугу' : 'Xizmatni baholash'}</button>}
              {status === 'completed' && data.role === 'seller' && <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">{lang === 'ru' ? 'Ожидается оценка клиента' : 'Mijoz bahosi kutilmoqda'}</span>}
            </div>
          </div>
          {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
        </div>
      </div>

      {reviewOpen && data.role === 'buyer' && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="service-review-title">
        <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
          {!reviewSubmitted ? <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-600">{lang === 'ru' ? 'ОТЗЫВ' : 'OTZIV'}</p>
                <h3 id="service-review-title" className="mt-1 text-xl font-extrabold text-slate-900">{lang === 'ru' ? 'Оцените услугу' : 'Xizmatni baholang'}</h3>
                <p className="mt-1 text-sm text-slate-500">{lang === 'ru' ? 'Ваш отзыв поможет другим клиентам выбрать исполнителя.' : 'Sizning baho va sharhingiz boshqa mijozlarga xizmat ko‘rsatuvchini tanlashda yordam beradi.'}</p>
              </div>
              <button type="button" onClick={closeServiceReview} disabled={reviewSubmitting} className="rounded-full p-2 text-xl leading-none text-slate-400 hover:bg-slate-100 disabled:opacity-50" aria-label={lang === 'ru' ? 'Закрыть' : 'Yopish'}>×</button>
            </div>

            <div className="mt-6 flex justify-center gap-2" aria-label={lang === 'ru' ? 'Оценка от 1 до 5' : '1 dan 5 gacha baho'}>
              {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setReviewRating(star)} aria-label={`${star}/5`} className={`text-4xl leading-none transition-transform hover:scale-110 ${star <= reviewRating ? 'text-amber-400' : 'text-slate-200'}`}>★</button>)}
            </div>
            <p className="mt-2 text-center text-xs font-bold text-slate-500">{reviewRating ? `${reviewRating}/5` : (lang === 'ru' ? 'Выберите оценку' : 'Bahoni tanlang')}</p>

            <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} maxLength={1000} rows={5} placeholder={lang === 'ru' ? 'Напишите свой отзыв...' : 'Sharhingizni yozing...'} className="mt-5 w-full resize-none rounded-2xl border border-slate-200 p-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            <div className="mt-1 text-right text-[11px] text-slate-400">{reviewText.length}/1000</div>

            {reviewError && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{reviewError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeServiceReview} disabled={reviewSubmitting} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{lang === 'ru' ? 'Отмена' : 'Bekor qilish'}</button>
              <button type="button" onClick={() => void submitServiceReview()} disabled={reviewRating < 1 || reviewSubmitting} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{reviewSubmitting ? (lang === 'ru' ? 'Сохраняем...' : 'Saqlanmoqda...') : (lang === 'ru' ? 'Отправить отзыв' : 'Baholashni yuborish')}</button>
            </div>
          </> : <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">✓</div>
            <h3 className="mt-4 text-xl font-extrabold text-slate-900">{lang === 'ru' ? 'Спасибо за отзыв!' : 'Baholaganingiz uchun rahmat!'}</h3>
            <p className="mt-2 text-sm text-slate-500">{lang === 'ru' ? 'Ваш отзыв опубликован.' : 'Sizning baho va sharhingiz saqlandi.'}</p>
            <button type="button" onClick={closeServiceReview} className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700">{lang === 'ru' ? 'Готово' : 'Tayyor'}</button>
          </div>}
        </div>
      </div>}
    </>
  }

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
