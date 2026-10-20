'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type TelegramWebApp = {
  initData: string
  ready: () => void
  expand: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
    TelegramWebviewProxy?: unknown
    __ROYALHOUSE_TELEGRAM_AUTH_STATE__?: 'idle' | 'pending' | 'ready' | 'blocked' | 'failed'
  }
}

type Props = { children?: ReactNode }

function LoadingGate({ text = 'Telegram profilingiz tekshirilmoqda...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-slate-200">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
        <p className="text-lg font-extrabold text-slate-900">Royalhouse</p>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </div>
    </div>
  )
}

export default function TelegramMiniAppAuth({ children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const started = useRef(false)
  const [active, setActive] = useState(false)
  const [failed, setFailed] = useState(false)
  const [conflict, setConflict] = useState<'link' | 'already-linked' | null>(null)
  const [linking, setLinking] = useState(false)
  const [telegramContext, setTelegramContext] = useState<boolean | null>(null)

  useEffect(() => {
    if (started.current) return
    started.current = true
    window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'idle'

    let cancelled = false
    let pollTimer: number | undefined
    let timeoutTimer: number | undefined

    const finish = () => {
      if (pollTimer) window.clearInterval(pollTimer)
      if (timeoutTimer) window.clearTimeout(timeoutTimer)
    }

    const authenticate = async (webApp: TelegramWebApp) => {
      if (cancelled || !webApp.initData) return

      setTelegramContext(true)
      window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'pending'
      setActive(true)
      webApp.ready()
      webApp.expand()

      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: webApp.initData }),
          credentials: 'include',
          cache: 'no-store',
        })
        const data = await response.json().catch(() => null)

        if (response.status === 409) {
          window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'blocked'
          if (!cancelled) {
            setConflict(data?.error === 'TELEGRAM_ALREADY_LINKED_TO_ANOTHER_PROFILE' ? 'already-linked' : 'link')
            setActive(false)
          }
          return
        }

        if (!response.ok) throw new Error(data?.error || 'TELEGRAM_AUTH_FAILED')
        if (cancelled) return

        if (!data?.session?.access_token || !data?.session?.refresh_token || !data?.profile?.id) {
          throw new Error('TELEGRAM_SESSION_MISSING')
        }

        const supabase = createClient()
        // The browser may contain a session for a different person. It must
        // never survive into the Telegram Mini App identity.
        await supabase.auth.signOut({ scope: 'local' })

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
        if (sessionError) throw sessionError

        const { data: verified } = await supabase.auth.getUser()
        if (!verified.user || verified.user.id !== data.profile.id) {
          await supabase.auth.signOut({ scope: 'local' })
          throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')
        }

        window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'ready'
        setActive(false)
        if (cancelled) return

        const next = new URLSearchParams(window.location.search).get('next')
        const target = next && next.startsWith('/') ? next : pathname === '/register' ? '/account' : pathname
        // Full navigation makes the new auth cookie/session authoritative for
        // both server components and client components; router.refresh alone
        // can retain a stale authenticated tree during hydration.
        window.location.replace(target || '/')
      } catch (error) {
        console.error('[telegram-miniapp-auth]', error)
        window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'failed'
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

    // Telegram normally injects WebApp before React runs. If it is already
    // available, authentication starts immediately with no artificial delay.
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

    // Ordinary browser visits must not be held by the Telegram gate forever.
    // 1500ms is only a fallback; Telegram normally resolves immediately.
    timeoutTimer = window.setTimeout(() => {
      finish()
      if (!cancelled && !window.Telegram?.WebApp?.initData) {
        setTelegramContext(false)
        window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'idle'
      }
    }, 1500)

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

  // A real Telegram Mini App is always gated until its identity is resolved.
  // This prevents an old browser/phone session from rendering another user's
  // account before Telegram authentication completes.
  if (telegramContext === null || telegramContext === true) {
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
              <button type="button" onClick={startLinking} disabled={linking} className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-60">
                {linking ? 'Ulash havolasi tayyorlanmoqda…' : 'Telegramni ulash'}
              </button>
            ) : (
              <button type="button" onClick={() => router.replace('/account')} className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white">
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
            <button type="button" onClick={() => window.location.reload()} className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white">Qayta tekshirish</button>
          </div>
        </div>
      )
    }

    return <LoadingGate text={active ? 'Telegram profilingiz tekshirilmoqda...' : 'Royalhouse xavfsiz kirishni tekshirmoqda...'} />
  }

  // Normal browser: preserve the existing RoyalHouse session and render the app.
  return <>{children}</>
}
