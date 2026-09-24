'use client'

import { useEffect } from 'react'

/**
 * React cleans the ListingWizard image-preview effect whenever the image list
 * changes. At that moment the old preview <img> is still mounted, so an
 * immediate URL.revokeObjectURL() can invalidate the URL before the browser
 * finishes painting it. Defer revocation only while the URL is referenced by
 * a DOM image; temporary object URLs used for dimension probing are revoked
 * normally.
 */
export default function ObjectUrlLifetimeGuard() {
  useEffect(() => {
    const originalRevoke = URL.revokeObjectURL.bind(URL)
    const pending = new Map<string, ReturnType<typeof setTimeout>>()

    URL.revokeObjectURL = (url: string) => {
      const referencedByImage = Array.from(document.images).some(image => image.src === url)
      if (!referencedByImage) {
        originalRevoke(url)
        return
      }

      if (pending.has(url)) return
      const timer = setTimeout(() => {
        pending.delete(url)
        originalRevoke(url)
      }, 1500)
      pending.set(url, timer)
    }

    return () => {
      URL.revokeObjectURL = originalRevoke
      pending.forEach(timer => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  return null
}
