'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type TelegramWebApp = {
  initData: string
  initDataUnsafe?: { start_param?: string }
  ready: () => void
  expand: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export async function ensureTelegramSession() {
  const webApp = window.Telegram?.WebApp
  if (!webApp?.initData) return false

  const startParam = webApp.initDataUnsafe?.start_param || new URLSearchParams(window.location.search).get('tgWebAppStartParam') || ''
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: webApp.initData, startParam }),
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) throw new Error(data?.error || 'Telegram authentication failed')

    if (data?.session?.access_token && data?.session?.refresh_token) {
      const supabase = createClient()
      const { error } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      if (error) throw error
    }

    webApp.ready()
    webApp.expand()
    return true
  } finally {
    window.clearTimeout(timeout)
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
    let timer: number | undefined
    const startedAt = Date.now()

    const finish = async () => {
      const webApp = window.Telegram?.WebApp
      if (cancelled || !webApp?.initData) return
      setActive(true)

      try {
        const authenticated = await ensureTelegramSession()
        if (cancelled) return
        if (!authenticated) throw new Error('Telegram initData is missing')

        const next = new URLSearchParams(window.location.search).get('next')
        const target = next && next.startsWith('/') ? next : pathname === '/register' ? '/account' : pathname

        // /telegram is itself the Main Mini App landing page. After successful
        // authentication there is nothing to navigate to: replacing /telegram
        // with /telegram leaves the loading overlay mounted forever. Only
        // navigate when authentication actually requires a different route.
        if (target !== pathname) {
          setActive(false)
          router.replace(target || '/')
          return
        }

        setActive(false)
      } catch (error) {
        console.error('[telegram-miniapp-auth]', error)
        if (!cancelled) {
          setActive(false)
          setFailed(true)
        }
      }
    }

    const tryStart = () => {
      const webApp = window.Telegram?.WebApp
      if (webApp?.initData) {
        void finish()
        return true
      }
      if (Date.now() - startedAt >= 8000) {
        if (!cancelled) setFailed(true)
        return true
      }
      timer = window.setTimeout(tryStart, 100)
      return false
    }

    tryStart()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
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
