'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type TelegramWebApp = {
  initData: string
  ready: () => void
  expand: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export default function TelegramMiniAppAuth() {
  const router = useRouter()
  const pathname = usePathname()
  const started = useRef(false)
  const [active, setActive] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    const authenticate = async (webApp: TelegramWebApp) => {
      if (!webApp.initData) return
      setActive(true)
      webApp.ready()
      webApp.expand()

      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: webApp.initData }),
          credentials: 'include',
        })
        if (!response.ok) throw new Error('Telegram authentication failed')
        if (cancelled) return

        // Read the redirect target only in the browser. This keeps the
        // global client component safe during Next.js prerendering.
        const next = new URLSearchParams(window.location.search).get('next')
        const target = next && next.startsWith('/') ? next : pathname === '/register' ? '/account' : pathname
        router.replace(target || '/')
      } catch (error) {
        console.error('[telegram-miniapp-auth]', error)
        if (!cancelled) setFailed(true)
      }
    }

    const tryStart = () => {
      const webApp = window.Telegram?.WebApp
      if (webApp?.initData) {
        void authenticate(webApp)
        return true
      }
      return false
    }

    if (tryStart()) return () => { cancelled = true }

    const existing = document.querySelector('script[data-telegram-web-app]') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', tryStart, { once: true })
      return () => {
        cancelled = true
        existing.removeEventListener('load', tryStart)
      }
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-web-app.js'
    script.async = true
    script.dataset.telegramWebApp = 'true'
    script.onload = tryStart
    document.head.appendChild(script)

    return () => {
      cancelled = true
      script.onload = null
    }
  }, [pathname, router])

  if (!active || failed) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-slate-200">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
        <p className="text-lg font-extrabold text-slate-900">Royalhouse</p>
        <p className="mt-1 text-sm text-slate-500">Telegram orqali avtomatik kirilmoqda...</p>
      </div>
    </div>
  )
}
