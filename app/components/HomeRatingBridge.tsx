'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function HomeRatingBridge() {
  useEffect(() => {
    let disposed = false

    const run = async () => {
      if (disposed || window.location.pathname !== '/') return

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
        if (link.querySelector('[data-rh-rating-card]')) continue

        const id = link.getAttribute('href')?.match(/^\/listings\/([^/?#]+)/)?.[1]
        const rating = id ? ratings.get(id) : null
        const count = Number(rating?.rating_count || 0)
        const score = Number(rating?.rating_average || 0)
        if (!rating || count < 1 || !Number.isFinite(score)) continue

        const cardBody = link.querySelector<HTMLElement>('.p-4') || (link.lastElementChild as HTMLElement | null)
        if (!cardBody) continue

        const badge = document.createElement('div')
        badge.setAttribute('data-rh-rating-card', 'true')
        badge.setAttribute('aria-label', `O‘rtacha baho ${score.toFixed(1)} / 5, ${count} ta baho`)
        badge.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-top:7px;font-size:11px;line-height:1;font-weight:800;white-space:nowrap;'
        badge.innerHTML = `<span style="color:#f59e0b;font-size:13px">★</span><span style="color:#b45309">${score.toFixed(1)}</span><span style="color:#64748b;font-weight:700">(${count})</span>`

        const seller = Array.from(cardBody.children).find((node) => (node as HTMLElement).className?.includes('border-t'))
        if (seller) seller.insertAdjacentElement('beforebegin', badge)
        else cardBody.appendChild(badge)
      }
    }

    const timer = window.setTimeout(() => void run().catch(() => {}), 300)
    return () => {
      disposed = true
      window.clearTimeout(timer)
    }
  }, [])

  return null
}
