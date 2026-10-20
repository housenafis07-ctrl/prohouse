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
  const [conflict, setConflict] = useState<'link' | 'already-linked' | null>(null)
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    let pollTimer: number | undefined
    let timeoutTimer: number | undefined

    const finish = () => {
      if (pollTimer) window.clearInterval(pollTimer)
      if (timeoutTimer) window.clearTimeout(timeoutTimer)
    }

    const authenticate = async (webApp: TelegramWebApp) => {
      if (cancelled || !webApp.initData) return

      setActive(true)
      webApp.ready()
      webApp.expand()

      try {
        // Do not let a stale phone-authenticated browser session determine
        // which RoyalHouse profile is shown while Telegram auth is running.
        // The server is authoritative: it validates initData and returns the
        // canonical Telegram-linked profile/session.
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: webApp.initData }),
          credentials: 'include',
          cache: 'no-store',
        })

        if (response.status === 409) {
          const data = await response.json().catch(() => null)
          if (!cancelled) {
            setConflict(data?.error === 'TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE' ? 'already-linked' : 'link')
            setActive(false)
          }
          return
        }

        if (!response.ok) throw new Error('Telegram authentication failed')
        if (cancelled) return

        // Force Next/Supabase-backed pages to remount after the Telegram auth
        // response has established the canonical session. Without this,
        // /listings/new could render once from the previous phone session.
        router.refresh()
        await new Promise((resolve) => window.setTimeout(resolve, 100))

        const next = new URLSearchParams(window.location.search).get('next')
        const target = next && next.startsWith('/') ? next : pathname === '/register' ? '/account' : pathname
        router.replace(target || '/')
      } catch (error) {
        console.error('[telegram-miniapp-auth]', error)
        if (!cancelled) {
          setActive(false)
          setFailed(true)
        }
      }
    }

    const tryStart = () => {
      if (cancelled) return true
      const webApp = window.Telegram?.WebApp
      if (!webApp?.initData) return false
      void authenticate(webApp)
      return true
    }

    if (tryStart()) {
      return () => {
        cancelled = true
        finish()
      }
    }

    const existing = document.querySelector('script[data-telegram-web-app]') as HTMLScriptElement | null
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://telegram.org/js/telegram-web-app.js'
      script.async = true
      script.dataset.telegramWebApp = 'true'
      document.head.appendChild(script)
    }

    pollTimer = window.setInterval(() => {
      if (tryStart()) finish()
    }, 50)

    timeoutTimer = window.setTimeout(() => {
      finish()
      if (!cancelled && !window.Telegram?.WebApp?.initData) setFailed(true)
    }, 5000)

    return () => {
      cancelled = true
      finish()
    }
  }, [pathname, router])

  const startLinking = async () => {
    setLinking(true)
    try {
      const response = await fetch('/api/account/telegram/link', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.url) throw new Error(data?.error || 'LINK_FAILED')
      window.location.href = data.url
    } catch (error) {
      console.error('[telegram-miniapp-auth] link failed', error)
      setLinking(false)
    }
  }

  if (conflict) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 px-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-slate-200">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-xl">⚠️</div>
          <p className="text-lg font-extrabold text-slate-900">Telegram akkaunti tekshirildi</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {conflict === 'already-linked'
              ? 'Bu Telegram akkaunti boshqa RoyalHouse profiliga ulangan. Hozirgi profilni almashtirmaymiz.'
              : 'Siz hozir RoyalHouse akkauntiga telefon orqali kirgansiz. Telegramni shu profilga ulash uchun tasdiqlang.'}
          </p>
          {conflict === 'link' ? (
            <button
              type="button"
              onClick={startLinking}
              disabled={linking}
              className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-60"
            >
              {linking ? 'Ulash havolasi tayyorlanmoqda…' : 'Telegramni ulash'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.replace('/account')}
              className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white"
            >
              Hozirgi profilga qaytish
            </button>
          )}
        </div>
      </div>
    )
  }

  if (failed) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 px-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-slate-200">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-xl">⚠️</div>
          <p className="text-lg font-extrabold text-slate-900">Telegram tekshiruvi bajarilmadi</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Telegram orqali ochilgan oynani qayta oching. Eski RoyalHouse profiliga avtomatik o‘tmaymiz.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white"
          >
            Qayta tekshirish
          </button>
        </div>
      </div>
    )
  }

  if (!active) return null

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
