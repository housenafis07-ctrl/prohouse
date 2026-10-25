'use client'

import { useEffect } from 'react'

export default function ListingCardRatingFix() {
  useEffect(() => {
    let disposed = false
    const run = async () => {
      if (!/^\/listings(?:\/|$)/.test(window.location.pathname)) return
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/listings/"]'))
      const ids = [...new Set(links.map((link) => link.getAttribute('href')?.match(/^\/listings\/([^/?#]+)/)?.[1]).filter(Boolean) as string[])]
      if (!ids.length) return
      const response = await fetch(`/api/listings/ratings?ids=${encodeURIComponent(ids.join(','))}`, { cache: 'no-store' })
      if (!response.ok || disposed) return
      const result = await response.json().catch(() => ({}))
      const ratings = result.data || {}
      for (const link of links) {
        const id = link.getAttribute('href')?.match(/^\/listings\/([^/?#]+)/)?.[1]
        const rating = id ? ratings[id] : null
        if (!rating || link.querySelector('[data-rh-rating-card]')) continue
        const meta = link.querySelector<HTMLElement>('[class*="mt-3"][class*="flex-wrap"][class*="text-xs"]')
        const location = link.querySelector<HTMLElement>('p[class*="text-slate-500"]')
        const anchor = meta || location
        if (!anchor) continue
        const badge = document.createElement('div')
        badge.setAttribute('data-rh-rating-card', 'true')
        badge.setAttribute('aria-label', `O‘rtacha baho ${Number(rating.average / 2).toFixed(1)} / 5, ${Number(rating.count)} ta baho`)
        badge.style.cssText = 'margin-top:6px;display:flex;align-items:center;gap:4px;width:max-content;max-width:100%;font-size:11px;line-height:1;font-weight:800;color:#b45309;white-space:nowrap;'
        badge.innerHTML = `<span style="color:#f59e0b;font-size:13px">★</span><span>${Number(rating.average / 2).toFixed(1)}</span><span style="color:#64748b;font-weight:700">(${Number(rating.count)})</span>`
        anchor.insertAdjacentElement('afterend', badge)
      }
    }
    void run().catch(() => {})
    return () => { disposed = true }
  }, [])
  return null
}
