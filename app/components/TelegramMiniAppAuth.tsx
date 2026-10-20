'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type TelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

type TelegramWebApp = {
  initData: string
  initDataUnsafe?: { user?: TelegramUser }
  ready: () => void
  expand: () => void
}

type TelegramAuthResponse = {
  ok?: boolean
  error?: string
  session?: {
    access_token?: string
    refresh_token?: string
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
    __royalHouseTelegramAuthReady?: boolean
    __royalHouseTelegramAuthPromise?: Promise<void>
  }
}

function markAuthReady() {
  window.__royalHouseTelegramAuthReady = true
  window.dispatchEvent(new CustomEvent('royalhouse:telegram-auth-ready'))
}

async function hardResetSupabase(supabase: ReturnType<typeof createClient>) {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) console.warn('[STRICT AUTH] local signOut failed', error)

  try {
    window.localStorage.clear()
  } catch (error) {
    console.warn('[STRICT AUTH] localStorage.clear failed', error)
  }

  try {
    window.sessionStorage.clear()
  } catch (error) {
    console.warn('[STRICT AUTH] sessionStorage.clear failed', error)
  }
}

/**
 * Telegram Mini App authentication boundary.
 *
 * When Telegram initData exists, Telegram is the sole identity authority.
 * The browser's previous Supabase account is never reused or merged.
 */
export default function TelegramMiniAppAuth() {
  const router = useRouter()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    let timer: number | undefined
    let script: HTMLScriptElement | null = null

    const waitForTelegramWebApp = async (): Promise<TelegramWebApp | null> => {
      const immediate = window.Telegram?.WebApp
      if (immediate) return immediate

      const existingScript = document.querySelector('script[data-telegram-web-app]') as HTMLScriptElement | null

      if (existingScript) {
        await new Promise<void>((resolve) => {
          const onLoad = () => {
            existingScript.removeEventListener('load', onLoad)
            resolve()
          }
          existingScript.addEventListener('load', onLoad, { once: true })
          window.setTimeout(() => {
            existingScript.removeEventListener('load', onLoad)
            resolve()
          }, 5000)
        })
        return window.Telegram?.WebApp ?? null
      }

      script = document.createElement('script')
      script.src = 'https://telegram.org/js/telegram-web-app.js'
      script.async = true
      script.dataset.telegramWebApp = 'true'
      document.head.appendChild(script)

      await new Promise<void>((resolve) => {
        if (!script) return resolve()
        const currentScript = script
        const onLoad = () => {
          currentScript.removeEventListener('load', onLoad)
          resolve()
        }
        currentScript.addEventListener('load', onLoad, { once: true })
        window.setTimeout(() => {
          currentScript.removeEventListener('load', onLoad)
          resolve()
        }, 5000)
      })

      return window.Telegram?.WebApp ?? null
    }

    const run = async (): Promise<void> => {
      const supabase = createClient()
      const webApp = await waitForTelegramWebApp()

      if (cancelled) return

      // Telegram WebApp exists only when the SDK is available. If initData is
      // absent, this is a normal web/PWA session; do not destroy it.
      if (!webApp?.initData) {
        markAuthReady()
        return
      }

      webApp.ready()
      webApp.expand()

      const telegramId = webApp.initDataUnsafe?.user?.id != null
        ? String(webApp.initDataUnsafe.user.id)
        : null

      if (!telegramId) {
        // Never expose an old browser account if Telegram mode is active but
        // Telegram did not provide an identity.
        await hardResetSupabase(supabase)
        throw new Error('TELEGRAM_ID_MISSING')
      }

      // STRICT RULE: inside a Telegram Mini App, always discard the browser's
      // previous session before resolving the current Telegram identity. We do
      // not try to decide whether the old account "matches"; this prevents
      // contaminated legacy metadata from defeating account isolation.
      await hardResetSupabase(supabase)

      if (cancelled) return

      const controller = new AbortController()
      timer = window.setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: webApp.initData }),
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        const data = await response.json().catch(() => null) as TelegramAuthResponse | null
        if (!response.ok) {
          throw new Error(data?.error || `TELEGRAM_AUTH_FAILED_${response.status}`)
        }

        const accessToken = data?.session?.access_token
        const refreshToken = data?.session?.refresh_token
        if (!accessToken || !refreshToken) {
          throw new Error('TELEGRAM_SESSION_MISSING')
        }

        const { data: hydrated, error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (setSessionError) throw setSessionError
        if (!hydrated.user) throw new Error('TELEGRAM_USER_MISSING_AFTER_SESSION')

        const finalTelegramId = hydrated.user.user_metadata?.telegram_user_id != null
          ? String(hydrated.user.user_metadata.telegram_user_id)
          : hydrated.user.user_metadata?.telegram_id != null
            ? String(hydrated.user.user_metadata.telegram_id)
            : null

        if (finalTelegramId !== telegramId) {
          await hardResetSupabase(supabase)
          throw new Error('TELEGRAM_SESSION_IDENTITY_MISMATCH')
        }

        if (cancelled) return

        markAuthReady()
        router.refresh()
      } finally {
        if (timer) window.clearTimeout(timer)
      }
    }

    const promise = run().catch(async (error) => {
      console.error('[STRICT AUTH] Telegram authentication failed', error)
      // The hard reset happened before the request, so a failed Telegram auth
      // must leave the browser logged out rather than revealing account B.
      try {
        await hardResetSupabase(createClient())
      } catch (resetError) {
        console.error('[STRICT AUTH] final hard reset failed', resetError)
      }
      markAuthReady()
    })

    window.__royalHouseTelegramAuthPromise = promise

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      if (script) script.onload = null
    }
  }, [router])

  return null
}
