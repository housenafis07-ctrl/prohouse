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
 * Telegram authentication is strictly background-only.
 * The Mini App must render and remain usable even when auth/network is slow
 * or unavailable. We also avoid loading Telegram's SDK on ordinary web visits.
 */
export default function TelegramMiniAppAuth() {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    let timer: number | undefined

    const authenticate = async (webApp: TelegramWebApp) => {
      if (cancelled || !webApp.initData) return

      webApp.ready()
      webApp.expand()

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
          return
        }

        // A phone/email-authenticated user opening the Mini App keeps the
        // existing RoyalHouse session. Do not silently switch to a separate
        // Telegram auth account. Attach the Telegram identity to this profile
        // so listings, chats and Telegram notifications use one profile.
        if (sessionUser && sessionUser.user_metadata?.auth_provider !== 'telegram') {
          const linkResponse = await fetch('/api/account/telegram/auto-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: webApp.initData }),
            credentials: 'include',
            cache: 'no-store',
          })

          const linkData = await linkResponse.json().catch(() => null)
          if (!cancelled && !linkResponse.ok) {
            console.warn('[telegram-miniapp-auth] phone profile auto-link failed', linkData?.error || linkResponse.status)
          }
          return
        }
      } catch (error) {
        console.warn('[telegram-miniapp-auth] session inspection skipped', error)
      }

      const controller = new AbortController()
      timer = window.setTimeout(() => controller.abort(), 4000)

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
          console.warn('[telegram-miniapp-auth] background auth failed', data?.error || response.status)
          return
        }

        if (!data?.session?.access_token || !data?.session?.refresh_token) {
          console.warn('[telegram-miniapp-auth] background auth returned no session')
          return
        }

        const { error } = await createClient().auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })

        if (error) {
          console.error('[telegram-miniapp-auth] setSession failed', error)
        }
      } catch (error) {
        console.warn('[telegram-miniapp-auth] background authentication skipped', error)
      } finally {
        if (timer) window.clearTimeout(timer)
      }
    }

    const start = () => {
      if (cancelled) return true
      const webApp = window.Telegram?.WebApp
      if (!webApp) return false

      if (webApp.initData) void authenticate(webApp)
      else {
        webApp.ready()
        webApp.expand()
      }
      return true
    }

    if (start()) {
      return () => {
        cancelled = true
        if (timer) window.clearTimeout(timer)
      }
    }

    const isTelegramWebView = /Telegram/i.test(navigator.userAgent)
    if (!isTelegramWebView) return

    const existing = document.querySelector('script[data-telegram-web-app]') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', start, { once: true })
      return () => {
        cancelled = true
        if (timer) window.clearTimeout(timer)
        existing.removeEventListener('load', start)
      }
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-web-app.js'
    script.async = true
    script.dataset.telegramWebApp = 'true'
    script.onload = start
    document.head.appendChild(script)

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      script.onload = null
    }
  }, [])

  return null
}
