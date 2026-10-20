'use client'

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Props = { children?: ReactNode }
type WebApp = { initData: string; ready: () => void; expand: () => void }

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp }
    TelegramWebviewProxy?: unknown
  }
}

function hasTelegramContext() {
  if (typeof window === 'undefined') return false
  return Boolean(
    window.Telegram?.WebApp?.initData ||
    window.TelegramWebviewProxy ||
    /[?&#]tgWebApp(?:Data|Version|Platform|StartParam)?/i.test(window.location.href),
  )
}

function getTelegramInitData() {
  if (typeof window === 'undefined') return ''
  return window.Telegram?.WebApp?.initData || ''
}

export default function TelegramMiniAppAuthCanonical({ children }: Props) {
  const pathname = usePathname()
  const [active, setActive] = useState(false)
  const [pending, setPending] = useState(false)
  const [phoneRequired, setPhoneRequired] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const authInFlight = useRef(false)
  const lastAuthenticatedPath = useRef('')
  const telegramInitDataRef = useRef('')

  const resolveTelegramIdentity = useCallback(async (force = false) => {
    const initData = getTelegramInitData()
    if (!initData || authInFlight.current) return false
    if (!force && telegramInitDataRef.current === initData && lastAuthenticatedPath.current === pathname) return true

    authInFlight.current = true
    setActive(true)
    setPending(true)
    setPhoneRequired(false)
    setError('')

    const supabase = createClient()
    try {
      // A Telegram Mini App must never inherit the previous browser account.
      // Clear the old RoyalHouse session BEFORE resolving Telegram identity.
      await supabase.auth.signOut({ scope: 'local' })

      const response = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ initData }),
      })
      const data = await response.json().catch(() => null)

      if (response.status === 428) {
        setPhoneRequired(true)
        setPending(false)
        telegramInitDataRef.current = initData
        lastAuthenticatedPath.current = pathname
        return true
      }

      if (!response.ok || !data?.session?.access_token || !data?.profile?.id) {
        throw new Error(data?.error || 'TELEGRAM_AUTH_FAILED')
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
      if (sessionError) throw sessionError

      // Critical invariant: the browser session MUST be the exact profile
      // resolved by the verified Telegram initData. Never accept the previous
      // browser session as a fallback.
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user?.id !== data.profile.id) {
        await supabase.auth.signOut({ scope: 'local' })
        throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')
      }

      telegramInitDataRef.current = initData
      lastAuthenticatedPath.current = pathname
      setPending(false)
      return true
    } catch (e) {
      await supabase.auth.signOut({ scope: 'local' })
      setError(e instanceof Error ? e.message : 'TELEGRAM_AUTH_FAILED')
      setPending(false)
      return true
    } finally {
      authInFlight.current = false
    }
  }, [pathname])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    let attempts = 0

    const poll = () => {
      const initData = getTelegramInitData()
      if (initData) {
        if (timer) clearInterval(timer)
        void resolveTelegramIdentity(true)
        return
      }

      attempts += 1
      if (attempts >= 100) {
        if (timer) clearInterval(timer)
        if (hasTelegramContext()) {
          setActive(true)
          setPending(false)
          setError('Telegram sessiyasi topilmadi. Mini Appni qayta oching.')
        } else {
          setActive(false)
          setPending(false)
        }
      }
    }

    if (getTelegramInitData()) {
      void resolveTelegramIdentity(true)
    } else if (hasTelegramContext()) {
      setActive(true)
      setPending(true)
      timer = setInterval(poll, 100)
    } else {
      const existing = document.querySelector('script[data-royalhouse-telegram-webapp]')
      if (!existing) {
        const script = document.createElement('script')
        script.src = 'https://telegram.org/js/telegram-web-app.js'
        script.async = true
        script.dataset.royalhouseTelegramWebapp = 'true'
        script.onload = poll
        document.head.appendChild(script)
        timer = setInterval(poll, 100)
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible' && getTelegramInitData()) {
        void resolveTelegramIdentity(true)
      }
    }
    const onFocus = () => {
      if (getTelegramInitData()) void resolveTelegramIdentity(true)
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [pathname, resolveTelegramIdentity])

  // Important: Next.js client navigation does NOT remount the root layout.
  // Re-resolve Telegram identity when entering the listing flow, otherwise a
  // stale account can survive from the page that was open before the Mini App.
  useEffect(() => {
    if (pathname.startsWith('/listings/new') && getTelegramInitData()) {
      void resolveTelegramIdentity(true)
    }
  }, [pathname, resolveTelegramIdentity])

  const verifyPhone = async () => {
    setLoading(true)
    setError('')
    try {
      const normalized = phone.replace(/\D/g, '').replace(/^998/, '+998')
      if (!/^\+998\d{9}$/.test(normalized)) throw new Error('Telefon raqamini to‘g‘ri kiriting.')

      if (!sent) {
        const response = await fetch('/api/auth/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: normalized }),
          cache: 'no-store',
        })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || 'SMS yuborilmadi.')
        setPhone(normalized)
        setSent(true)
        return
      }

      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized, code }),
        cache: 'no-store',
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.session?.access_token) throw new Error(data?.error || 'Telefon tasdiqlanmadi.')

      const initData = getTelegramInitData()
      if (!initData) throw new Error('Telegram sessiyasi topilmadi.')

      const link = await fetch('/api/auth/telegram/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, accessToken: data.session.access_token }),
        cache: 'no-store',
      })
      const linked = await link.json().catch(() => null)
      if (!link.ok || !linked?.session?.access_token) throw new Error(linked?.error || 'Telegramni profilga ulab bo‘lmadi.')

      const supabase = createClient()
      await supabase.auth.signOut({ scope: 'local' })
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: linked.session.access_token,
        refresh_token: linked.session.refresh_token,
      })
      if (sessionError) throw sessionError

      const { data: userData } = await supabase.auth.getUser()
      if (userData.user?.id !== linked.profile.id) {
        await supabase.auth.signOut({ scope: 'local' })
        throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')
      }

      setPhoneRequired(false)
      setPending(false)
      telegramInitDataRef.current = initData
      lastAuthenticatedPath.current = pathname
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tasdiqlash amalga oshmadi.')
    } finally {
      setLoading(false)
    }
  }

  if (!active) return <>{children}</>

  if (pending) {
    return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"><div className="rounded-3xl bg-white p-7 text-center shadow-xl ring-1 ring-slate-200"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600"/><b>Royalhouse</b><p className="mt-2 text-sm text-slate-500">Telegram profilingiz tekshirilmoqda…</p></div></div>
  }

  if (phoneRequired) {
    return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-5"><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200"><b className="text-xl">Telegram profil topilmadi</b><p className="mt-2 text-sm text-slate-600">Telegram profilingizga bog‘langan Royalhouse akkaunt topilmadi. Telefon raqamingizni tasdiqlang.</p><input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="+998 90 123 45 67" className="mt-5 w-full rounded-2xl border px-4 py-3" disabled={sent || loading}/>{sent && <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0,6))} inputMode="numeric" placeholder="SMS kod" className="mt-3 w-full rounded-2xl border px-4 py-3" disabled={loading}/>}<button onClick={verifyPhone} disabled={loading || (sent && code.length !== 6)} className="mt-3 w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white">{loading ? 'Tekshirilmoqda…' : sent ? 'Tasdiqlash' : 'SMS kod yuborish'}</button>{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}</div></div>
  }

  if (error) {
    return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"><div className="rounded-3xl p-7 text-center shadow-xl ring-1 ring-slate-200"><b>Telegram tekshiruvi bajarilmadi</b><p className="mt-2 text-sm text-slate-600">{error}</p></div></div>
  }

  return <>{children}</>
}
