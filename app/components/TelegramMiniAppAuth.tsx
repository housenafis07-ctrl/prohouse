'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type TelegramWebAppUser = {
  id: number
  username?: string
  first_name?: string
  last_name?: string
}

type TelegramWebApp = {
  initData: string
  initDataUnsafe?: {
    user?: TelegramWebAppUser
  }
  ready: () => void
  expand: () => void
}

type TelegramAuthResponse = {
  ok?: boolean
  requiresPhone?: boolean
  telegramId?: string
  error?: string
  session?: {
    access_token: string
    refresh_token: string
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

/**
 * Strict Telegram Mini App authentication.
 *
 * Rules:
 * - Telegram initData is the only identity source.
 * - A mismatched/missing telegram_id in an existing Supabase session
 *   triggers an immediate hard reset.
 * - The server is always asked to authenticate the current Telegram identity.
 * - No old browser session is used as a profile fallback.
 */
export default function TelegramMiniAppAuth() {
  const router = useRouter()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    let timer: number | undefined

    const hardReset = async (supabase: ReturnType<typeof createClient>) => {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('[STRICT AUTH] signOut failed', error)
      }

      try {
        window.localStorage.clear()
      } catch (error) {
        console.error('[STRICT AUTH] localStorage.clear failed', error)
      }

      try {
        window.sessionStorage.clear()
      } catch (error) {
        console.error('[STRICT AUTH] sessionStorage.clear failed', error)
      }
    }

    const authenticate = async (webApp: TelegramWebApp) => {
      if (cancelled || !webApp.initData) return

      webApp.ready()
      webApp.expand()

      const supabase = createClient()
      const telegramId = webApp.initDataUnsafe?.user?.id
        ? String(webApp.initDataUnsafe.user.id)
        : null

      if (!telegramId) {
        console.error('[STRICT AUTH] Telegram user.id is missing')
        return
      }

      console.log('[STRICT AUTH] Current Telegram identity', {
        telegram_id: telegramId,
      })

      try {
        /*
         * Existing browser state is checked only to detect cross-account
         * contamination. It is NEVER used to choose the account on the server.
         */
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('[STRICT AUTH] getSession failed', sessionError)
        }

        const existingUser = session?.user ?? null
        const existingTelegramId = existingUser?.user_metadata?.telegram_id
          ? String(existingUser.user_metadata.telegram_id)
          : null

        const mismatch = Boolean(existingUser) && (
          !existingTelegramId ||
          existingTelegramId !== telegramId
        )

        if (mismatch) {
          console.error('[STRICT AUTH] IDENTITY MISMATCH - HARD RESET', {
            existing_supabase_user_id: existingUser?.id ?? null,
            existing_telegram_id: existingTelegramId,
            current_telegram_id: telegramId,
          })

          await hardReset(supabase)
        }

        if (cancelled) return

        const controller = new AbortController()
        timer = window.setTimeout(() => controller.abort(), 10000)

        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: webApp.initData }),
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        const data = (await response.json().catch(() => null)) as TelegramAuthResponse | null

        if (cancelled) return

        if (response.ok && data?.requiresPhone) {
          console.log('[STRICT AUTH] Telegram mapping not found', {
            telegram_id: data.telegramId ?? telegramId,
          })
          return
        }

        if (!response.ok) {
          console.error('[STRICT AUTH] server authentication failed', {
            status: response.status,
            error: data?.error ?? null,
          })
          return
        }

        if (!data?.session?.access_token || !data.session.refresh_token) {
          console.error('[STRICT AUTH] server returned no complete session')
          return
        }

        const {
          data: sessionResult,
          error: setSessionError,
        } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })

        if (setSessionError) {
          console.error('[STRICT AUTH] setSession failed', setSessionError)
          await hardReset(supabase)
          return
        }

        const authenticatedTelegramId = sessionResult.user?.user_metadata?.telegram_id
          ? String(sessionResult.user.user_metadata.telegram_id)
          : null

        if (
          !sessionResult.user ||
          !authenticatedTelegramId ||
          authenticatedTelegramId !== telegramId
        ) {
          console.error('[STRICT AUTH] FINAL IDENTITY CHECK FAILED', {
            expected_telegram_id: telegramId,
            actual_telegram_id: authenticatedTelegramId,
            supabase_user_id: sessionResult.user?.id ?? null,
          })

          await hardReset(supabase)
          return
        }

        console.log('[STRICT AUTH] AUTHENTICATION SUCCESS', {
          telegram_id: telegramId,
          supabase_user_id: sessionResult.user.id,
        })

        router.refresh()
      } catch (error) {
        console.error('[STRICT AUTH] authentication failed', error)
      } finally {
        if (timer) window.clearTimeout(timer)
      }
    }

    const start = () => {
      if (cancelled) return true

      const webApp = window.Telegram?.WebApp
      if (!webApp?.initData) return false

      void authenticate(webApp)
      return true
    }

    if (start()) {
      return () => {
        cancelled = true
        if (timer) window.clearTimeout(timer)
      }
    }

    const existing = document.querySelector(
      'script[data-telegram-web-app]'
    ) as HTMLScriptElement | null

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
  }, [router])

  return null
}
