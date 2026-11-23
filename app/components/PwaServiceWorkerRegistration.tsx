'use client'

import { useEffect } from 'react'

export default function PwaServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let cancelled = false

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        if (cancelled) return
        await registration.update()
      } catch {
        // PWA support must never block the normal website.
      }
    }

    void register()
    return () => { cancelled = true }
  }, [])

  return null
}
