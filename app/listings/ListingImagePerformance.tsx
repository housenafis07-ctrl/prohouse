'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Browser-side image delivery policy for the public listing surfaces.
 *
 * The existing listing/image markup stays untouched: this layer only adds
 * browser hints so cards do not eagerly decode/download the whole result set,
 * while the detail page keeps its first hero image as the high-priority asset.
 */
export default function ListingImagePerformance() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.querySelector('main')
    if (!root) return

    const images = Array.from(root.querySelectorAll('img'))
    if (!images.length) return

    const isDetail = /^\/listings\/[^/]+$/.test(pathname)

    images.forEach((image, index) => {
      image.decoding = 'async'

      if (isDetail && index === 0) {
        image.loading = 'eager'
        image.setAttribute('fetchpriority', 'high')
        image.setAttribute('sizes', '(max-width: 1024px) 100vw, 65vw')
        return
      }

      image.loading = 'lazy'
      image.setAttribute('fetchpriority', 'low')
      image.setAttribute(
        'sizes',
        isDetail ? '80px' : '(max-width: 1024px) 100vw, 280px',
      )
    })
  }, [pathname])

  return null
}
