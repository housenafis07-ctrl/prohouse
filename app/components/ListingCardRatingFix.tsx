'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function ListingCardRatingFix() {
  useEffect(() => {
    let disposed = false
    let timer: number | null = null
    let observer: MutationObserver | null = null

    const run = async () => {
      if (disposed) return
      const path = window.location.pathname
      if (!path.startsWith('/listings') && path !== '/') return

      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/listings/"]'))
      const ids = [...new Set(links.map((link) => link.getAttribute('href')?.match(/^\/listings\/([^/?#]+)/)?.[1]).filter(Boolean) as string[])]
      if (!ids.length) return

      const db = createClient()
      const { data, error } = await db
        .from('listing_search')
        .select('id,rating_average,rating_count')
        .in('id', ids)

      if (error || disposed) return
      const ratings = new Map((data || []).map((row: any) => [row.id, row]))

      for (const link of links) {
        const id = link.getAttribute('href')?.match(/^\/listings\/([^/?#]+)/)?.[1]
        const rating = id ? ratings.get(id) : null
        const count = Number(rating?.rating_count || 0)
        const score = Number(rating?.rating_average || 0)
        if (!rating || count < 1 || !Number.isFinite(score) || score <= 0) continue
        if (link.querySelector('[data-rh-rating-card]')) continue

        const meta = link.querySelector<HTMLElement>('[class*="mt-3"][class*="flex-wrap"][class*="text-xs"]')
        const location = link.querySelector<HTMLElement>('p[class*="text-slate-500"], p[class*="text-slate-400"], [data-listing-location]')
        const fallback = link.lastElementChild as HTMLElement | null
        const anchor = meta || location || fallback
        if (!anchor) continue

        const badge = document.createElement('div')
        badge.setAttribute('data-rh-rating-card', 'true')
        badge.setAttribute('aria-label', `O‘rtacha baho ${score.toFixed(1)} / 5, ${count} ta otziv`)
        badge.style.cssText = 'margin-top:7px;display:inline-flex;align-items:center;gap:5px;width:max-content;max-width:100%;font-size:12px;line-height:1;font-weight:800;white-space:nowrap;'
        badge.innerHTML = `<span style="color:#f59e0b;font-size:14px">★</span><span style="color:#b45309">${score.toFixed(1)}</span><span style="color:#64748b;font-weight:700">(${count})</span>`

        if (meta || location) anchor.insertAdjacentElement('afterend', badge)
        else anchor.appendChild(badge)
      }
    }

    const schedule = () => {
      if (disposed || timer !== null) return
      timer = window.setTimeout(() => {
        timer = null
        void run().catch(() => {})
      }, 150)
    }

    observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    schedule()

    return () => {
      disposed = true
      if (timer !== null) window.clearTimeout(timer)
      observer?.disconnect()
    }
  }, [])

  return null
}
