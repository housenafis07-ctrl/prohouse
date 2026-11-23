'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isReviewable = (row: { listing_type?: string | null; property_type?: string | null; taxonomy_code?: string | null }) =>
  row.listing_type === 'service' ||
  row.property_type === 'service' ||
  row.taxonomy_code === 'rent_dacha' ||
  Boolean(row.taxonomy_code?.startsWith('services_'))

function getListingId(href: string | null) {
  const match = href?.match(/(?:^|\/)listings\/([^/?#]+)/)
  const id = match?.[1] || ''
  return UUID_PATTERN.test(id) ? id : null
}

export default function ListingCardRatingFix() {
  useEffect(() => {
    let disposed = false
    let timer: number | null = null
    let observer: MutationObserver | null = null
    let running = false
    let rerun = false
    const processedIds = new Set<string>()
    const pendingIds = new Set<string>()

    const schedule = () => {
      if (disposed || timer !== null) return
      timer = window.setTimeout(() => {
        timer = null
        void run().catch(() => {})
      }, 120)
    }

    const collectNewIds = (root: ParentNode) => {
      const links: HTMLAnchorElement[] = []
      if (root instanceof HTMLAnchorElement) links.push(root)
      root.querySelectorAll('a[href*="/listings/"]').forEach((node) => {
        if (node instanceof HTMLAnchorElement) links.push(node)
      })

      let added = false
      for (const link of links) {
        const id = getListingId(link.getAttribute('href'))
        if (!id || processedIds.has(id)) continue
        pendingIds.add(id)
        added = true
      }
      if (added) schedule()
    }

    const run = async () => {
      if (disposed) return
      if (running) {
        rerun = true
        return
      }

      const ids = [...pendingIds]
      pendingIds.clear()
      if (!ids.length) return

      running = true
      ids.forEach((id) => processedIds.add(id))
      try {
        const db = createClient()
        const { data: listingRows, error: listingError } = await db
          .from('listings')
          .select('id,listing_type,property_type,taxonomy_code')
          .in('id', ids)

        if (listingError) {
          ids.forEach((id) => processedIds.delete(id))
          return
        }
        if (disposed) return

        const reviewableIds = (listingRows || [])
          .filter(isReviewable)
          .map((row: any) => String(row.id))

        if (!reviewableIds.length) return

        const { data: reviews, error: reviewsError } = await db
          .from('listing_reviews')
          .select('listing_id,rating')
          .in('listing_id', reviewableIds)
          .eq('status', 'published')

        if (reviewsError) {
          reviewableIds.forEach((id) => processedIds.delete(id))
          return
        }
        if (disposed) return

        const grouped = new Map<string, number[]>()
        for (const row of reviews || []) {
          const listingId = String(row.listing_id || '')
          const rating = Number(row.rating)
          if (!listingId || !Number.isFinite(rating) || rating < 1 || rating > 5) continue
          const values = grouped.get(listingId) || []
          values.push(rating)
          grouped.set(listingId, values)
        }

        const ratings = new Map<string, { score: number; count: number }>()
        for (const [listingId, values] of grouped) {
          const score = Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
          ratings.set(listingId, { score, count: values.length })
        }

        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/listings/"]'))
        for (const link of links) {
          if (link.querySelector('[data-rh-rating-card]')) continue
          const id = getListingId(link.getAttribute('href'))
          if (!id || !ids.includes(id)) continue
          const listing = (listingRows || []).find((row: any) => String(row.id) === id)
          if (!listing || !isReviewable(listing)) continue

          const rating = ratings.get(id)
          if (!rating || rating.count === 0) continue

          const content = link.querySelector<HTMLElement>(':scope > div.p-4')
          if (!content) continue

          const badge = document.createElement('div')
          badge.setAttribute('data-rh-rating-card', 'true')
          badge.setAttribute('aria-label', `O‘rtacha baho ${rating.score.toFixed(1)} / 5, ${rating.count} ta otziv`)
          badge.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:10px;margin-bottom:2px;font-size:13px;line-height:18px;font-weight:700;white-space:nowrap;'
          badge.innerHTML = `<span aria-hidden="true" style="color:#f59e0b;font-size:15px;line-height:18px">★</span><span style="color:#334155">${rating.score.toFixed(1)}</span><span style="color:#94a3b8;font-weight:600">(${rating.count})</span>`

          const sellerRow = content.lastElementChild
          if (sellerRow) content.insertBefore(badge, sellerRow)
          else content.appendChild(badge)
        }
      } finally {
        running = false
        if (rerun && pendingIds.size && !disposed) {
          rerun = false
          schedule()
        }
      }
    }

    collectNewIds(document)
    observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement) collectNewIds(node)
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      disposed = true
      if (timer !== null) window.clearTimeout(timer)
      observer?.disconnect()
    }
  }, [])

  return null
}
