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
    let timer: number | null = null
    let observer: MutationObserver | null = null
    let running = false

    const run = async () => {
      if (disposed || running) return
      const path = window.location.pathname
      if (path !== '/' && !path.startsWith('/listings')) return

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

        // Do not depend on rating_average/rating_count columns in listing_search.
        // Those columns were the reason the homepage badge silently disappeared
        // when the view was recreated by another migration. Read the source of
        // truth (published listing_reviews) directly instead.
        const { data: listingRows, error: listingError } = await db
          .from('listing_search')
          .select('id,listing_type,property_type,taxonomy_code')
          .in('id', ids)

        if (listingError || disposed) return

        const reviewableIds = (listingRows || [])
          .filter(isReviewable)
          .map((row: any) => row.id)

        if (!reviewableIds.length) return

        const { data: reviews, error: reviewsError } = await db
          .from('listing_reviews')
          .select('listing_id,rating')
          .in('listing_id', reviewableIds)
          .eq('status', 'published')

        if (reviewsError || disposed) return

        const grouped = new Map<string, number[]>()
        for (const row of reviews || []) {
          const rating = Number((row as any).rating)
          const listingId = String((row as any).listing_id || '')
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
          if (!rating || rating.count < 1 || !Number.isFinite(rating.score) || rating.score <= 0) continue

          // The homepage cards place the location row before the divider/seller.
          // Insert immediately after that row so the rating has a stable visual
          // position without changing the existing card layout.
          const location = link.querySelector<HTMLElement>(
            '[data-listing-location], p[class*="text-slate-500"], p[class*="text-slate-400"]'
          )
          const meta = link.querySelector<HTMLElement>('[class*="mt-3"][class*="flex-wrap"][class*="text-xs"]')
          const anchor = location || meta
          if (!anchor) continue

          const badge = document.createElement('div')
          badge.setAttribute('data-rh-rating-card', 'true')
          badge.setAttribute('aria-label', `O‘rtacha baho ${rating.score.toFixed(1)} / 5, ${rating.count} ta otziv`)
          badge.style.cssText = 'margin-top:7px;display:inline-flex;align-items:center;gap:5px;width:max-content;max-width:100%;font-size:12px;line-height:1;font-weight:800;white-space:nowrap;'
          badge.innerHTML = `<span style="color:#f59e0b;font-size:14px">★</span><span style="color:#b45309">${rating.score.toFixed(1)}</span><span style="color:#64748b;font-weight:700">(${rating.count})</span>`

          anchor.insertAdjacentElement('afterend', badge)
        }
      } finally {
        running = false
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
