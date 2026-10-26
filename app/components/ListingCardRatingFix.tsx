'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

const isReviewable = (row: any) =>
  row?.listing_type === 'service' ||
  row?.property_type === 'service' ||
  row?.taxonomy_code === 'rent_dacha' ||
  (typeof row?.taxonomy_code === 'string' && row.taxonomy_code.startsWith('services_'))

export default function ListingCardRatingFix() {
  useEffect(() => {
    let disposed = false
    let running = false
    const timers: number[] = []
    let observer: MutationObserver | null = null

    const run = async () => {
      if (disposed || running) return

      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/listings/"]'))
      const ids = [...new Set(
        links
          .map((link) => link.getAttribute('href')?.match(/^\/listings\/([^/?#]+)/)?.[1])
          .filter(Boolean) as string[]
      )]
      if (!ids.length) return

      running = true
      try {
        const db = createClient()

        // listing_search deliberately is not used here. Its schema is a read
        // model and has changed during previous migrations. The listings table
        // is the authoritative source for the listing type, while
        // listing_reviews is the authoritative source for the rating itself.
        const { data: listingRows, error: listingError } = await db
          .from('listings')
          .select('id,listing_type,property_type,taxonomy_code')
          .in('id', ids)

        if (listingError || disposed) return

        const reviewableIds = (listingRows || [])
          .filter(isReviewable)
          .map((row: any) => String(row.id))

        if (!reviewableIds.length) return

        const { data: reviews, error: reviewsError } = await db
          .from('listing_reviews')
          .select('listing_id,rating')
          .in('listing_id', reviewableIds)
          .eq('status', 'published')

        if (reviewsError || disposed) return

        const grouped = new Map<string, number[]>()
        for (const row of reviews || []) {
          const listingId = String((row as any).listing_id || '')
          const rating = Number((row as any).rating)
          if (!listingId || !Number.isFinite(rating) || rating < 1 || rating > 5) continue
          const values = grouped.get(listingId) || []
          values.push(rating)
          grouped.set(listingId, values)
        }

        const ratings = new Map<string, { score: number; count: number }>()
        for (const [listingId, values] of grouped) {
          if (!values.length) continue
          const score = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
          ratings.set(listingId, { score, count: values.length })
        }

        for (const link of links) {
          const id = link.getAttribute('href')?.match(/^\/listings\/([^/?#]+)/)?.[1]
          if (!id || link.querySelector('[data-rh-rating-card]')) continue

          const listing = (listingRows || []).find((row: any) => String(row.id) === id)
          if (!listing || !isReviewable(listing)) continue

          const rating = ratings.get(id)
          if (!rating || rating.count < 1 || !Number.isFinite(rating.score)) continue

          // PropertyCard has a stable .p-4 body. Render inside that body and
          // directly after the location/meta block instead of depending on
          // seller/border class names that can change with unrelated UI work.
          const cardBody = link.querySelector<HTMLElement>('.p-4')
          if (!cardBody) continue

          const existing = cardBody.querySelector('[data-rh-rating-card]')
          if (existing) continue

          const location = cardBody.querySelector<HTMLElement>('.mt-2.flex.items-center')
          const meta = cardBody.querySelector<HTMLElement>('.mt-3.flex.flex-wrap')
          const anchor = location || meta
          if (!anchor) continue

          const badge = document.createElement('div')
          badge.setAttribute('data-rh-rating-card', 'true')
          badge.setAttribute('aria-label', `O‘rtacha baho ${rating.score.toFixed(1)} / 5, ${rating.count} ta otziv`)
          badge.style.cssText = 'margin-top:8px;display:inline-flex;align-items:center;gap:5px;width:max-content;max-width:100%;font-size:12px;line-height:1;font-weight:800;white-space:nowrap;'
          badge.innerHTML = `<span style="color:#f59e0b;font-size:14px">★</span><span style="color:#b45309">${rating.score.toFixed(1)}</span><span style="color:#64748b;font-weight:700">(${rating.count})</span>`
          anchor.insertAdjacentElement('afterend', badge)
        }
      } finally {
        running = false
      }
    }

    const schedule = () => {
      if (disposed) return
      window.setTimeout(() => void run().catch(() => {}), 50)
    }

    // The homepage cards are rendered by HomeClient after the root layout
    // mounts. Retry a few times and also observe later client-side renders.
    timers.push(window.setTimeout(() => void run().catch(() => {}), 100))
    timers.push(window.setTimeout(() => void run().catch(() => {}), 500))
    timers.push(window.setTimeout(() => void run().catch(() => {}), 1200))

    observer = new MutationObserver(() => schedule())
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      disposed = true
      timers.forEach((timer) => window.clearTimeout(timer))
      observer?.disconnect()
    }
  }, [])

  return null
}
