'use client'

import { FormEvent, useEffect, useState } from 'react'
import type { Lang } from '@/lib/i18n'

type ReviewRow = { id: string; rating: number; body: string | null; created_at: string }
type ReviewData = { average: number | null; count: number; reviews: ReviewRow[]; eligible: boolean; reviewable: boolean }

function formatReviewDate(value: string) {
  try {
    return new Intl.DateTimeFormat('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
  } catch {
    return ''
  }
}

function Stars({ value, size = 'text-base' }: { value: number; size?: string }) {
  const score = Math.max(0, Math.min(5, Math.round(Number(value) || 0)))
  return <span aria-hidden="true" className={`${size} tracking-[2px] text-amber-500`}>{'★'.repeat(score)}{'☆'.repeat(5 - score)}</span>
}

export default function ListingDetailReviews({ listingId, lang }: { listingId: string; lang: Lang }) {
  const [data, setData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedRating, setSelectedRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false

    const load = async () => {
      try {
        const response = await fetch(`/api/listings/reviews?listingId=${encodeURIComponent(listingId)}`, { cache: 'no-store' })
        const payload = await response.json().catch(() => null)

        if (response.ok && payload && Array.isArray(payload.reviews)) {
          if (!disposed) {
            const reviewable = Boolean(payload.reviewable)
            setData({
              average: payload.average == null ? null : Number(payload.average),
              count: Number(payload.count || payload.reviews.length),
              reviews: payload.reviews,
              eligible: Boolean(payload.eligible),
              reviewable,
            })
            setLoading(false)
          }
          return
        }

        // Do not fall back to a direct listing_reviews query here.
        // The API is the single source of truth for whether this listing type
        // is allowed to display or accept reviews. A direct table fallback used
        // to make reviews appear on apartments/houses when the API returned a
        // non-reviewable response.
        if (!disposed) {
          setData({ average: null, count: 0, reviews: [], eligible: false, reviewable: false })
          setLoading(false)
        }
      } catch {
        if (!disposed) {
          setData({ average: null, count: 0, reviews: [], eligible: false, reviewable: false })
          setError(lang === 'ru' ? 'Не удалось загрузить отзывы.' : 'Otzivlarni yuklab bo‘lmadi.')
          setLoading(false)
        }
      }
    }

    void load()
    return () => { disposed = true }
  }, [listingId, lang])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data?.reviewable || selectedRating < 1 || submitting) return

    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/listings/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, rating: selectedRating, review: reviewText.trim() }),
      })
      const result = await response.json().catch(() => ({}))
      if (response.status === 401) {
        window.location.href = `/register?redirect=${encodeURIComponent(window.location.pathname)}`
        return
      }
      if (!response.ok) throw new Error(result.error || (lang === 'ru' ? 'Не удалось отправить оценку.' : 'Bahoni yuborib bo‘lmadi.'))
      const created = result.review as ReviewRow
      setData((current) => {
        if (!current?.reviewable) return current
        const reviews = [created, ...current.reviews]
        const average = Math.round((reviews.reduce((sum, row) => sum + Number(row.rating || 0), 0) / reviews.length) * 10) / 10
        return { ...current, average, count: reviews.length, reviews, eligible: false }
      })
      setSelectedRating(0)
      setReviewText('')
    } catch (value) {
      setError(value instanceof Error ? value.message : (lang === 'ru' ? 'Не удалось отправить оценку.' : 'Bahoni yuborib bo‘lmadi.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !data || !data.reviewable) return null

  const average = data.average == null ? '—' : data.average.toFixed(1)
  const count = Number(data.count || 0)
  const isRu = lang === 'ru'

  return <section id="reviews" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-black text-slate-900">⭐ {isRu ? 'Оценки и отзывы' : 'Baholar va otzivlar'}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">{isRu ? 'Отзывы пользователей услуги или дачи' : 'Xizmat yoki dacha foydalanuvchilari baholari'}</p>
      </div>
      <div className="flex items-center gap-2">
        <Stars value={Number(average) || 0} size="text-xl" />
        <strong className="text-xl font-black text-emerald-700">{average}/5</strong>
        <span className="text-sm font-bold text-slate-500">({count})</span>
      </div>
    </div>

    <div className="mt-5 grid gap-3">
      {data.reviews.length ? data.reviews.map((review) => <article key={review.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <Stars value={review.rating} />
          <time className="text-xs font-bold text-slate-400">{formatReviewDate(review.created_at)}</time>
        </div>
        {review.body && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{review.body}</p>}
      </article>) : <div className="rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">{isRu ? 'Пока отзывов нет.' : 'Hozircha otzivlar yo‘q.'}</div>}
    </div>

    {data.eligible ? <form onSubmit={submit} className="mt-5 border-t border-slate-100 pt-5">
      <p className="font-black text-slate-900">{isRu ? 'Ваша оценка' : 'Sizning bahoyingiz'}</p>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label={isRu ? 'Оценка' : 'Baho'}>
        {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setSelectedRating(value)} aria-label={`${value} ${isRu ? 'звезд' : 'yulduz'}`} aria-pressed={selectedRating === value} className={`rounded-lg px-1 text-3xl leading-none transition ${value <= selectedRating ? 'text-amber-500' : 'text-slate-300'} hover:text-amber-400`}>
          ★
        </button>)}
      </div>
      <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} maxLength={1000} placeholder={isRu ? 'Напишите ваше мнение об услуге или даче...' : 'Xizmat yoki dacha haqidagi fikringizni yozing...'} className="mt-3 min-h-24 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50" />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-400">{reviewText.length}/1000</span>
        <button type="submit" disabled={selectedRating < 1 || submitting} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? (isRu ? 'Сохраняем...' : 'Saqlanmoqda...') : (isRu ? 'Отправить оценку' : 'Baholashni yuborish')}
        </button>
      </div>
    </form> : <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">{count ? (isRu ? 'Оценить могут только пользователи, которые воспользовались услугой или завершили бронирование дачи.' : 'Baholash faqat xizmatdan foydalangan yoki dacha bronini yakunlagan foydalanuvchilar uchun mavjud.') : (isRu ? 'Для оценки нужно воспользоваться услугой или завершить бронирование дачи.' : 'Baholash uchun xizmatdan foydalanish yoki dacha bronini yakunlash kerak.')}</p>}

    {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
  </section>
}
