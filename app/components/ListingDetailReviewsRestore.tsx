'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;')
}

function formatReviewDate(value: string) {
  try { return new Intl.DateTimeFormat('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) } catch { return '' }
}

type ReviewRow = { id: string; rating: number; body: string | null; created_at: string }
type ReviewData = { average: number | null; count: number; reviews: ReviewRow[]; eligible: boolean }

export default function ListingDetailReviewsRestore() {
  useEffect(() => {
    const currentId = window.location.pathname.match(/^\/listings\/([^/]+)\/?$/)?.[1]
    if (!currentId) return

    let disposed = false
    let timer: number | null = null
    let attempts = 0

    const schedule = () => {
      if (disposed || timer !== null || attempts >= 20) return
      attempts += 1
      timer = window.setTimeout(() => { timer = null; void run().catch(() => {}) }, 300)
    }

    const loadData = async (): Promise<ReviewData | null> => {
      try {
        const response = await fetch(`/api/listings/reviews?listingId=${encodeURIComponent(currentId)}`, { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json().catch(() => null)
          if (data && Array.isArray(data.reviews)) {
            return { average: data.average == null ? null : Number(data.average), count: Number(data.count || data.reviews.length), reviews: data.reviews, eligible: Boolean(data.eligible) }
          }
        }
      } catch {}

      // Keep public reviews visible even if the API route has a transient/session error.
      try {
        const db = createClient()
        const { data: rows, error } = await db.from('listing_reviews').select('id,rating,body,created_at').eq('listing_id', currentId).eq('status', 'published').order('created_at', { ascending: false }).limit(50)
        if (error) return null
        const reviews = (rows || []) as ReviewRow[]
        const average = reviews.length ? Math.round((reviews.reduce((sum, row) => sum + Number(row.rating || 0), 0) / reviews.length) * 10) / 10 : null
        return { average, count: reviews.length, reviews, eligible: false }
      } catch { return null }
    }

    const run = async () => {
      if (disposed || document.querySelector('[data-rh-reviews]')) return
      const heading = document.querySelector('h1[data-no-global-i18n]') || document.querySelector('h1')
      if (!heading) { schedule(); return }

      const data = await loadData()
      if (disposed || document.querySelector('[data-rh-reviews]')) return
      if (!data) { schedule(); return }

      attempts = 0
      const box = document.createElement('section')
      box.setAttribute('data-rh-reviews', 'true')
      box.style.cssText = 'margin:20px 0 28px;border:1px solid #dbe5e1;border-radius:20px;background:#fff;padding:22px;box-shadow:0 4px 18px rgba(15,23,42,.05);'
      const average = data.average == null ? '—' : data.average.toFixed(1)
      const count = Number(data.count || 0)
      const reviews = Array.isArray(data.reviews) ? data.reviews : []
      const stars = count ? '★★★★★' : '☆☆☆☆☆'

      box.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
          <div><div style="font-size:18px;font-weight:900;color:#0f172a">⭐ Baholar va otzivlar</div><div style="color:#64748b;font-size:13px;font-weight:700">Xizmat yoki dacha foydalanuvchilari baholari</div></div>
          <div style="display:flex;align-items:center;gap:10px;color:#047857;font-size:22px;font-weight:900"><span style="color:#f59e0b;letter-spacing:1px">${stars}</span> ${average}/5 <span style="color:#64748b;font-size:13px;font-weight:700">(${count})</span></div>
        </div>
        <div style="display:grid;gap:12px;margin-top:16px">
          ${reviews.length ? reviews.map((item) => `<article style="border:1px solid #e8eef0;border-radius:15px;padding:14px;background:#f8fafc"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:7px"><span style="color:#f59e0b;letter-spacing:1px">${'★'.repeat(Math.max(0, Math.min(5, Number(item.rating || 0))))}${'☆'.repeat(Math.max(0, 5 - Number(item.rating || 0)))}</span><span style="color:#64748b;font-size:13px;font-weight:700">${escapeHtml(formatReviewDate(item.created_at))}</span></div>${item.body ? `<div style="color:#334155;font-size:14px;line-height:1.55;white-space:pre-wrap">${escapeHtml(item.body)}</div>` : ''}</article>`).join('') : '<div style="color:#64748b;font-size:13px;font-weight:700">Hozircha otzivlar yo‘q.</div>'}
        </div>
        ${data.eligible ? `<form data-rh-review-form style="margin-top:18px;border-top:1px solid #e8eef0;padding-top:18px"><div style="font-weight:900;color:#0f172a">Sizning bahoyingiz</div><div data-rh-stars style="display:flex;gap:5px;margin:10px 0 12px">${[1,2,3,4,5].map((n) => `<button type="button" data-rating="${n}" aria-label="${n} yulduz" style="border:0;background:transparent;cursor:pointer;font-size:30px;line-height:1;padding:2px;color:#cbd5e1">★</button>`).join('')}</div><textarea name="review" maxlength="1000" placeholder="Xizmat yoki dacha haqidagi fikringizni yozing..." style="width:100%;min-height:92px;resize:vertical;border:1px solid #cbd5e1;border-radius:13px;padding:12px;outline:none;font:inherit"></textarea><button data-rh-submit type="submit" disabled style="margin-top:10px;border:0;border-radius:12px;background:#059669;color:white;padding:11px 16px;font-weight:900;cursor:pointer">Baholashni yuborish</button><div data-rh-error hidden style="margin-top:10px;color:#b91c1c;font-size:13px;font-weight:700"></div></form>` : `<div style="margin-top:10px;color:#64748b;font-size:13px;line-height:1.5">${count ? 'Baholash faqat xizmatdan foydalangan yoki bronni yakunlagan foydalanuvchilar uchun mavjud.' : 'Baholash uchun xizmatdan foydalanish yoki dacha bronini yakunlash kerak.'}</div>`}
      `
      heading.insertAdjacentElement('afterend', box)

      const form = box.querySelector<HTMLFormElement>('[data-rh-review-form]')
      const starsWrap = box.querySelector<HTMLElement>('[data-rh-stars]')
      const submit = box.querySelector<HTMLButtonElement>('[data-rh-submit]')
      const error = box.querySelector<HTMLElement>('[data-rh-error]')
      let selectedRating = 0
      starsWrap?.addEventListener('click', (event) => {
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-rating]')
        if (!target) return
        selectedRating = Number(target.dataset.rating || 0)
        box.querySelectorAll<HTMLButtonElement>('[data-rating]').forEach((button) => { button.style.color = Number(button.dataset.rating) <= selectedRating ? '#f59e0b' : '#cbd5e1' })
        if (submit) submit.disabled = selectedRating < 1
      })
      form?.addEventListener('submit', async (event) => {
        event.preventDefault()
        if (!selectedRating || !submit) return
        submit.disabled = true
        if (error) { error.hidden = true; error.textContent = '' }
        const review = String(new FormData(form).get('review') || '')
        try {
          const resultResponse = await fetch('/api/listings/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: currentId, rating: selectedRating, review }) })
          const result = await resultResponse.json().catch(() => ({}))
          if (resultResponse.status === 401) { window.location.href = `/register?redirect=${encodeURIComponent(window.location.pathname)}`; return }
          if (!resultResponse.ok) throw new Error(result.error || 'Bahoni yuborib bo‘lmadi.')
          window.location.reload()
        } catch (errorValue) {
          if (error) { error.hidden = false; error.textContent = errorValue instanceof Error ? errorValue.message : 'Bahoni yuborib bo‘lmadi.' }
          submit.disabled = false
        }
      })
    }

    const observer = new MutationObserver(() => { if (!document.querySelector('[data-rh-reviews]')) void run().catch(() => {}) })
    observer.observe(document.body, { childList: true, subtree: true })
    void run().catch(() => {})
    return () => { disposed = true; observer.disconnect(); if (timer !== null) window.clearTimeout(timer) }
  }, [])

  return null
}
