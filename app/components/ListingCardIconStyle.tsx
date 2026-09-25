'use client'

import { useEffect } from 'react'

/**
 * Listing-card/detail rating enhancement.
 * Keeps the existing listing data flow intact and reads only published reviews.
 */
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
        a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span:nth-child(2)::before { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2362788f' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9V4h5'/%3E%3Cpath d='M20 15v5h-5'/%3E%3Cpath d='M4 4l6 6'/%3E%3Cpath d='M20 20l-6-6'/%3E%3C/svg%3E"); }
        a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span:nth-child(3)::before { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2362788f' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 18v-6h16v6'/%3E%3Cpath d='M6 12V9h12v3'/%3E%3Cpath d='M4 18v2M20 18v2'/%3E%3C/svg%3E"); }
        a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span:nth-child(4)::before { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2362788f' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 20h4v-4h4v-4h4V8h4'/%3E%3Cpath d='M4 20h16'/%3E%3C/svg%3E"); }
        a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span[class*="text-emerald"]::before { display:none; }
        a[href^="/listings/"] p[class*="text-slate-500"] { color:#62788f;font-size:.78rem; }
      `
      document.head.appendChild(style)
    }

    let disposed = false
    const run = async () => {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/listings/"]'))
      const ids = [...new Set(links.map((link) => link.getAttribute('href')?.match(/^\/listings\/([^/?#]+)/)?.[1]).filter(Boolean) as string[])]
      const currentId = window.location.pathname.match(/^\/listings\/([^/]+)\/?$/)?.[1]
      if (!ids.length && !currentId) return
      const queryIds = currentId ? [currentId] : ids
      const response = await fetch(`/api/listings/ratings?ids=${encodeURIComponent(queryIds.join(','))}`, { cache:'no-store' })
      if (!response.ok || disposed) return
      const result = await response.json().catch(() => ({}))
      const ratings = result.data || {}

      if (currentId) {
        const rating = ratings[currentId]
        if (!rating || document.querySelector('[data-rh-rating-detail]')) return
        const heading = document.querySelector('h1[data-no-global-i18n]') || document.querySelector('h1')
        if (!heading) return
        const box = document.createElement('div')
        box.setAttribute('data-rh-rating-detail','true')
        box.className = 'mt-3 flex flex-wrap items-center gap-3'
        box.innerHTML = `<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-black text-amber-700">★ ${Number(rating.average).toFixed(1)}/10</span><span class="text-sm font-semibold text-slate-500">${Number(rating.count)} ta sharh</span>`
        heading.insertAdjacentElement('afterend', box)
        return
      }

      for (const link of links) {
        const id = link.getAttribute('href')?.match(/^\/listings\/([^/?#]+)/)?.[1]
        const rating = id ? ratings[id] : null
        if (!rating || link.querySelector('[data-rh-rating-card]')) continue
        const title = link.querySelector('h2')
        if (!title) continue
        const badge = document.createElement('span')
        badge.setAttribute('data-rh-rating-card','true')
        badge.className = 'ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-extrabold text-amber-700 align-middle'
        badge.textContent = `★ ${Number(rating.average).toFixed(1)} · ${Number(rating.count)}`
        title.appendChild(badge)
      }
    }

    void run().catch(() => {})
    return () => { disposed = true }
  }, [])

  return null
}
