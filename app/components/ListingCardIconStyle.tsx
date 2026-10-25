'use client'

import { useEffect } from 'react'

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function formatReviewDate(value: string) {
  try { return new Intl.DateTimeFormat('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) } catch { return '' }
}

export default function ListingCardIconStyle() {
  useEffect(() => {
    const styleId = 'prohouse-listing-card-outline-icons'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = `
        a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span { position:relative;display:inline-flex;align-items:center;gap:7px;padding-left:9px;color:#52667a; }
        a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span::before { content:"";width:18px;height:18px;flex:0 0 18px;background-repeat:no-repeat;background-position:center;background-size:18px 18px;opacity:.9; }
        a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span:nth-child(1)::before { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2362788f' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 10.5 12 3l9 7.5'/%3E%3Cpath d='M5 9.5V21h14V9.5'/%3E%3Cpath d='M9 21v-6h6v6'/%3E%3C/svg%3E"); }
        a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span:nth-child(2)::before { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2362788f' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9V4h5'/%3E%3Cpath d='M20 15v5h-5'/%3E%3Cpath d='M4 4l6 6'/%3E%3Cpath d='M20 20l-6-6'/%3E%3Cpath d='M20 9V4h-5'/%3E%3Cpath d='M4 15v5h5'/%3E%3C/svg%3E"); }
        a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span:nth-child(3)::before { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2362788f' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 18v-6h16v6'/%3E%3Cpath d='M6 12V9h12v3'/%3E%3Cpath d='M4 18v2M20 18v2'/%3E%3C/svg%3E"); }
        a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span:nth-child(4)::before { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2362788f' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 20h4v-4h4v-4h4V8h4'/%3E%3Cpath d='M4 20h16'/%3E%3C/svg%3E"); }
        a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span[class*="text-emerald"]::before { display:none; }
        a[href^="/listings/"] p[class*="text-slate-500"] { color:#62788f;font-size:.78rem; }
        a[href^="/listings/"] [data-rh-rating-card] { margin-top:7px;display:flex;align-items:center;gap:5px;width:max-content;max-width:100%;font-size:11px;line-height:1;font-weight:800;color:#b45309;white-space:nowrap; }
        a[href^="/listings/"] [data-rh-rating-card] .rh-card-rating-star { color:#f59e0b;font-size:13px; }
        a[href^="/listings/"] [data-rh-rating-card] .rh-card-rating-count { color:#64748b;font-weight:700; }
        [data-rh-reviews] { margin:20px 0 28px;border:1px solid #dbe5e1;border-radius:20px;background:#fff;padding:22px;box-shadow:0 4px 18px rgba(15,23,42,.05); }
        [data-rh-reviews] .rh-review-head { display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap; }
        [data-rh-reviews] .rh-review-score { display:flex;align-items:center;gap:10px;color:#047857;font-size:22px;font-weight:900; }
        [data-rh-reviews] .rh-review-stars { color:#f59e0b;letter-spacing:1px; }
        [data-rh-reviews] .rh-review-muted { color:#64748b;font-size:13px;font-weight:700; }
        [data-rh-reviews] .rh-review-list { display:grid;gap:12px;margin-top:16px; }
        [data-rh-reviews] .rh-review { border:1px solid #e8eef0;border-radius:15px;padding:14px;background:#f8fafc; }
        [data-rh-reviews] .rh-review-meta { display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:7px; }
        [data-rh-reviews] .rh-review-body { color:#334155;font-size:14px;line-height:1.55;white-space:pre-wrap; }
        [data-rh-reviews] .rh-review-form { margin-top:18px;border-top:1px solid #e8eef0;padding-top:18px; }
        [data-rh-reviews] .rh-review-rate { display:flex;gap:5px;margin:10px 0 12px; }
        [data-rh-reviews] .rh-star-btn { border:0;background:transparent;cursor:pointer;font-size:30px;line-height:1;padding:2px;color:#cbd5e1; }
        [data-rh-reviews] .rh-star-btn.active { color:#f59e0b; }
        [data-rh-reviews] textarea { width:100%;min-height:92px;resize:vertical;border:1px solid #cbd5e1;border-radius:13px;padding:12px;outline:none;font:inherit; }
        [data-rh-reviews] textarea:focus { border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.12); }
        [data-rh-reviews] .rh-submit { margin-top:10px;border:0;border-radius:12px;background:#059669;color:white;padding:11px 16px;font-weight:900;cursor:pointer; }
        [data-rh-reviews] .rh-submit:disabled { opacity:.55;cursor:wait; }
        [data-rh-reviews] .rh-review-note { margin-top:10px;color:#64748b;font-size:13px;line-height:1.5; }
        [data-rh-reviews] .rh-review-error { margin-top:10px;color:#b91c1c;font-size:13px;font-weight:700; }
      `
      document.head.appendChild(style)
    }

    if (!/^\/listings(?:\/|$)/.test(window.location.pathname)) return

    let disposed = false
    const run = async () => {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/listings/"]'))
      const ids = [...new Set(links.map((link) => link.getAttribute('href')?.match(/^\/listings\/([^/?#]+)/)?.[1]).filter(Boolean) as string[])]
      const currentId = window.location.pathname.match(/^\/listings\/([^/]+)\/?$/)?.[1]
      if (!ids.length && !currentId) return

      if (currentId) {
        const response = await fetch(`/api/listings/reviews?listingId=${encodeURIComponent(currentId)}`, { cache:'no-store' })
        if (!response.ok || disposed) return
        const data = await response.json().catch(() => null)
        if (!data?.reviewable || document.querySelector('[data-rh-reviews]')) return
        const heading = document.querySelector('h1[data-no-global-i18n]') || document.querySelector('h1')
        if (!heading) return

        const box = document.createElement('section')
        box.setAttribute('data-rh-reviews','true')
        const average = data.average == null ? '—' : Number(data.average).toFixed(1)
        const count = Number(data.count || 0)
        const reviews = Array.isArray(data.reviews) ? data.reviews : []
        const stars = count ? '★★★★★' : '☆☆☆☆☆'
        box.innerHTML = `
          <div class="rh-review-head">
            <div><div style="font-size:18px;font-weight:900;color:#0f172a">⭐ Baholar va otzivlar</div><div class="rh-review-muted">Xizmat yoki dacha foydalanuvchilari baholari</div></div>
            <div class="rh-review-score"><span class="rh-review-stars">${stars}</span> ${average}/5 <span class="rh-review-muted">(${count})</span></div>
          </div>
          <div class="rh-review-list">
            ${reviews.length ? reviews.map((item: any) => `
              <article class="rh-review">
                <div class="rh-review-meta"><span class="rh-review-stars">${'★'.repeat(Math.max(0, Math.min(5, Number(item.rating || 0))))}${'☆'.repeat(Math.max(0, 5 - Number(item.rating || 0)))}</span><span class="rh-review-muted">${escapeHtml(formatReviewDate(item.created_at))}</span></div>
                ${item.body ? `<div class="rh-review-body">${escapeHtml(item.body)}</div>` : ''}
              </article>`).join('') : '<div class="rh-review-muted">Hozircha otzivlar yo‘q.</div>'}
          </div>
          ${data.eligible ? `
            <form class="rh-review-form" data-rh-review-form>
              <div style="font-weight:900;color:#0f172a">Sizning bahoyingiz</div>
              <div class="rh-review-rate" data-rh-stars>${[1,2,3,4,5].map((n) => `<button type="button" class="rh-star-btn" data-rating="${n}" aria-label="${n} yulduz">★</button>`).join('')}</div>
              <textarea name="review" maxlength="1000" placeholder="Xizmat yoki dacha haqidagi fikringizni yozing..."></textarea>
              <button class="rh-submit" type="submit" disabled>Baholashni yuborish</button>
              <div class="rh-review-error" data-rh-review-error hidden></div>
            </form>` : `<div class="rh-review-note">${count ? 'Baholash faqat xizmatdan foydalangan yoki bronni yakunlagan foydalanuvchilar uchun mavjud.' : 'Baholash uchun xizmatdan foydalanish yoki dacha bronini yakunlash kerak.'}</div>`}
        `
        heading.insertAdjacentElement('afterend', box)

        const form = box.querySelector<HTMLFormElement>('[data-rh-review-form]')
        const starsWrap = box.querySelector<HTMLElement>('[data-rh-stars]')
        const submit = box.querySelector<HTMLButtonElement>('.rh-submit')
        const error = box.querySelector<HTMLElement>('[data-rh-review-error]')
        let selectedRating = 0
        const paint = () => box.querySelectorAll<HTMLButtonElement>('.rh-star-btn').forEach((button) => button.classList.toggle('active', Number(button.dataset.rating) <= selectedRating))
        starsWrap?.addEventListener('click', (event) => {
          const target = (event.target as HTMLElement).closest<HTMLButtonElement>('.rh-star-btn')
          if (!target) return
          selectedRating = Number(target.dataset.rating || 0)
          paint()
          if (submit) submit.disabled = selectedRating < 1
        })
        form?.addEventListener('submit', async (event) => {
          event.preventDefault()
          if (!selectedRating || !submit) return
          submit.disabled = true
          if (error) { error.hidden = true; error.textContent = '' }
          const review = String(new FormData(form).get('review') || '')
          try {
            const response = await fetch('/api/listings/reviews', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ listingId:currentId, rating:selectedRating, review }) })
            const result = await response.json().catch(() => ({}))
            if (response.status === 401) { window.location.href = `/register?redirect=${encodeURIComponent(window.location.pathname)}`; return }
            if (!response.ok) throw new Error(result.error || 'Bahoni yuborib bo‘lmadi.')
            window.location.reload()
          } catch (e) {
            if (error) { error.hidden = false; error.textContent = e instanceof Error ? e.message : 'Bahoni yuborib bo‘lmadi.' }
            submit.disabled = false
          }
        })
        return
      }

      const response = await fetch(`/api/listings/ratings?ids=${encodeURIComponent(ids.join(','))}`, { cache:'no-store' })
      if (!response.ok || disposed) return
      const result = await response.json().catch(() => ({}))
      const ratings = result.data || {}
      for (const link of links) {
        const id = link.getAttribute('href')?.match(/^\/listings\/([^/?#]+)/)?.[1]
        const rating = id ? ratings[id] : null
        if (!rating || link.querySelector('[data-rh-rating-card]')) continue

        const meta = link.querySelector<HTMLElement>('[class*="mt-3"][class*="flex-wrap"][class*="text-xs"]')
        if (!meta) continue

        const badge = document.createElement('div')
        badge.setAttribute('data-rh-rating-card','true')
        badge.setAttribute('aria-label',`O‘rtacha baho ${Number(rating.average / 2).toFixed(1)} / 5, ${Number(rating.count)} ta baho`)
        badge.innerHTML = `<span class="rh-card-rating-star">★</span><span>${Number(rating.average / 2).toFixed(1)}</span><span class="rh-card-rating-count">(${Number(rating.count)})</span>`
        meta.insertAdjacentElement('afterend', badge)
      }
    }

    void run().catch(() => {})
    return () => { disposed = true }
  }, [])

  return null
}
