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

/**
 * Telegram is the authoritative identity for Mini Apps.
 *
 * Ordering is strict:
 * 1. Read Telegram identity.
 * 2. Compare it with the existing Supabase session.
 * 3. Hard-reset a mismatched session before any API call.
 * 4. Authenticate the current Telegram identity on the server.
 * 5. Hydrate this browser's Supabase client with the returned session.
 *
 * The readiness promise prevents pages such as /listings/new from reading
 * an old browser session while Telegram authentication is still in progress.
 */
export default function TelegramMiniAppAuth() {
  const router = useRouter()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    let timer: number | undefined

    const run = async (): Promise<void> => {
      const supabase = createClient()
      const webApp = window.Telegram?.WebApp

      // Normal web/PWA navigation is unaffected by the Telegram gate.
      if (!webApp?.initData) {
        window.__royalHouseTelegramAuthReady = true
        return
      }

      webApp.ready()
      webApp.expand()

      const telegramId = webApp.initDataUnsafe?.user?.id != null
        ? String(webApp.initDataUnsafe.user.id)
        : null

      if (!telegramId) {
        throw new Error('TELEGRAM_ID_MISSING')
      }

      const { data: currentSessionData } = await supabase.auth.getSession()
      const currentUser = currentSessionData.session?.user ?? null
      const currentTelegramId = currentUser?.user_metadata?.telegram_user_id != null
        ? String(currentUser.user_metadata.telegram_user_id)
        : currentUser?.user_metadata?.telegram_id != null
          ? String(currentUser.user_metadata.telegram_id)
          : null

      // Existing browser state is used only to detect contamination. It never
      // selects the account that the server will authenticate.
      const mismatch = Boolean(currentUser) && (
        !currentTelegramId || currentTelegramId !== telegramId
      )

      if (mismatch) {
        console.warn('[STRICT AUTH] stale Supabase session detected; hard reset', {
          oldUserId: currentUser?.id ?? null,
          oldTelegramId: currentTelegramId,
          currentTelegramId: telegramId,
        })

        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
        if (signOutError) {
          console.warn('[STRICT AUTH] signOut failed during hard reset', signOutError)
        }

        try { window.localStorage.clear() } catch (error) {
          console.warn('[STRICT AUTH] localStorage.clear failed', error)
        }

        try { window.sessionStorage.clear() } catch (error) {
          console.warn('[STRICT AUTH] sessionStorage.clear failed', error)
        }
      }

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
          await supabase.auth.signOut({ scope: 'local' })
          try { window.localStorage.clear() } catch {}
          try { window.sessionStorage.clear() } catch {}
          throw new Error('TELEGRAM_SESSION_IDENTITY_MISMATCH')
        }

        if (cancelled) return

        window.__royalHouseTelegramAuthReady = true
        window.dispatchEvent(new CustomEvent('royalhouse:telegram-auth-ready'))
        router.refresh()
      } finally {
        if (timer) window.clearTimeout(timer)
      }
    }

    const promise = run().catch((error) => {
      console.error('[STRICT AUTH] Telegram authentication failed', error)
      // A failed mismatch reset must never expose the previous account again.
      window.__royalHouseTelegramAuthReady = true
      window.dispatchEvent(new CustomEvent('royalhouse:telegram-auth-ready'))
    })

    window.__royalHouseTelegramAuthPromise = promise

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [router])

  return null
}
