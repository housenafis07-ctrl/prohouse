'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

type TelegramWebApp = {
  initData: string
  initDataUnsafe?: {
    user?: {
      id?: number | string
    }
  }
  ready: () => void
  expand: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

/**
 * Owns the complete browser-side Telegram Mini App bootstrap:
 * Telegram SDK -> validated initData -> RoyalHouse auth endpoint ->
 * Supabase browser session.
 *
 * Authentication is intentionally non-blocking for normal web visits, but
 * Telegram WebViews get a short retry window so a slow SDK/initData race does
 * not leave the user permanently unauthenticated.
 */
export default function TelegramMiniAppAuth() {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    let authTimer: number | undefined
    let sdkPoll: number | undefined

    const clearTimers = () => {
      if (authTimer) window.clearTimeout(authTimer)
      if (sdkPoll) window.clearInterval(sdkPoll)
    }

    const authenticate = async (webApp: TelegramWebApp) => {
      if (cancelled) return

      webApp.ready()
      webApp.expand()

      // Telegram can expose the WebApp object before initData is populated.
      // Do not abandon authentication in that race; wait briefly for it.
      if (!webApp.initData) return

      try {
        const supabase = createClient()
        const { data: sessionData } = await supabase.auth.getSession()
        const sessionUser = sessionData.session?.user
        const telegramUserId = webApp.initDataUnsafe?.user?.id

        if (
          sessionUser?.user_metadata?.auth_provider === 'telegram' &&
          telegramUserId != null &&
          String(sessionUser.user_metadata.telegram_user_id) === String(telegramUserId)
        ) {
          window.dispatchEvent(new CustomEvent('royalhouse:telegram-authenticated'))
          return
        }
      } catch (error) {
        console.warn('[telegram-miniapp-auth] session fast-path skipped', error)
      }

      const controller = new AbortController()
      authTimer = window.setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: webApp.initData }),
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        const data = await response.json().catch(() => null)
        if (cancelled || !response.ok) {
          console.error('[telegram-miniapp-auth] authentication failed', data?.error || response.status)
          return
        }

        if (!data?.session?.access_token || !data?.session?.refresh_token) {
          console.error('[telegram-miniapp-auth] authentication returned no session')
          return
        }

        const supabase = createClient()
        const { error } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })

        if (error) {
          console.error('[telegram-miniapp-auth] setSession failed', error)
          return
        }

        const { data: verifiedSession } = await supabase.auth.getSession()
        if (!verifiedSession.session?.user) {
          console.error('[telegram-miniapp-auth] session was not persisted')
          return
        }

        window.dispatchEvent(new CustomEvent('royalhouse:telegram-authenticated'))

        // The bot opens the Mini App with ?open=account when the user wants
        // the authenticated cabinet. This redirect happens only after the
        // browser session is confirmed, so /account never races the login.
        const params = new URLSearchParams(window.location.search)
        if (params.get('open') === 'account' && window.location.pathname === '/telegram') {
          window.location.replace('/account')
        }
      } catch (error) {
        if (!cancelled) console.error('[telegram-miniapp-auth] authentication error', error)
      } finally {
        if (authTimer) window.clearTimeout(authTimer)
        authTimer = undefined
      }
    }

    const start = () => {
      if (cancelled) return false
      const webApp = window.Telegram?.WebApp
      if (!webApp) return false

      webApp.ready()
      webApp.expand()
      void authenticate(webApp)
      return true
    }

    // The /telegram page no longer injects a second SDK instance. Still support
    // pages where Telegram's SDK is supplied by another component.
    if (start()) {
      sdkPoll = window.setInterval(() => {
        const webApp = window.Telegram?.WebApp
        if (webApp?.initData) {
          if (sdkPoll) window.clearInterval(sdkPoll)
          sdkPoll = undefined
          void authenticate(webApp)
        }
      }, 150)

      window.setTimeout(() => {
        if (sdkPoll) {
          window.clearInterval(sdkPoll)
          sdkPoll = undefined
        }
      }, 8000)

      return () => {
        cancelled = true
        clearTimers()
      }
    }

    const isTelegramWebView = /Telegram/i.test(navigator.userAgent)
    if (!isTelegramWebView) return

    const existing = document.querySelector('script[src*="telegram.org/js/telegram-web-app.js"]') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', start, { once: true })
      sdkPoll = window.setInterval(() => {
        if (start()) {
          if (sdkPoll) window.clearInterval(sdkPoll)
          sdkPoll = undefined
        }
      }, 150)
      return () => {
        cancelled = true
        clearTimers()
        existing.removeEventListener('load', start)
      }
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-web-app.js'
    script.async = true
    script.dataset.telegramWebApp = 'true'
    script.onload = start
    document.head.appendChild(script)

    sdkPoll = window.setInterval(() => {
      if (start()) {
        if (sdkPoll) window.clearInterval(sdkPoll)
        sdkPoll = undefined
      }
    }, 150)

    return () => {
      cancelled = true
      clearTimers()
      script.onload = null
    }
  }, [])

  return null
}
