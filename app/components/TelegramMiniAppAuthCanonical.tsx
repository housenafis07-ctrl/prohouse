'use client'

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Props = { children?: ReactNode }
type WebApp = { initData: string; ready: () => void; expand: () => void }
type AuthState = 'pending' | 'ready' | 'blocked' | 'failed'

declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp }
    TelegramWebviewProxy?: unknown
    __ROYALHOUSE_TELEGRAM_AUTH_STATE__?: AuthState
  }
}

const telegramContext = () => typeof window !== 'undefined' && Boolean(
  window.Telegram?.WebApp?.initData || window.TelegramWebviewProxy ||
  /[?&#]tgWebApp(?:Data|Version|Platform|StartParam)?/i.test(window.location.href),
)
const initData = () => typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData || '' : ''

function clearSupabaseBrowserState() {
  if (typeof window === 'undefined') return
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') || key.includes('supabase.auth.token')) localStorage.removeItem(key)
    }
  } catch {}
  try { sessionStorage.clear() } catch {}
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
  const inFlight = useRef(false)
  const authenticatedInitData = useRef('')

  const state = useCallback((value: AuthState) => { window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = value }, [])

  const authenticate = useCallback(async (force = false) => {
    const data = initData()
    if (!data || inFlight.current) return false
    if (!force && authenticatedInitData.current === data) return true

    inFlight.current = true
    setActive(true); setPending(true); setPhoneRequired(false); setError(''); state('pending')
    const supabase = createClient()

    try {
      // Telegram Mini App is an isolated auth boundary.
      await supabase.auth.signOut({ scope: 'local' })
      clearSupabaseBrowserState()

      const response = await fetch('/api/auth/telegram', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', cache: 'no-store', body: JSON.stringify({ initData: data }),
      })
      const result = await response.json().catch(() => null)

      if (response.status === 428) {
        setPhoneRequired(true); setPending(false); authenticatedInitData.current = data; state('blocked'); return true
      }
      if (!response.ok || !result?.session?.access_token || !result?.session?.refresh_token || !result?.profile?.id) {
        throw new Error(result?.error || 'TELEGRAM_AUTH_FAILED')
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token, refresh_token: result.session.refresh_token,
      })
      if (sessionError) throw sessionError

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || userData.user?.id !== result.profile.id ||
          String(userData.user?.user_metadata?.telegram_user_id ?? '') !== String(result.telegramUserId ?? '')) {
        await supabase.auth.signOut({ scope: 'local' }); clearSupabaseBrowserState()
        throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')
      }

      authenticatedInitData.current = data
      setPending(false); state('ready')
      return true
    } catch (e) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
      clearSupabaseBrowserState()
      setError(e instanceof Error ? e.message : 'TELEGRAM_AUTH_FAILED')
      setPending(false); state('failed')
      return true
    } finally { inFlight.current = false }
  }, [state])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    let attempts = 0
    const poll = () => {
      if (initData()) { if (timer) clearInterval(timer); void authenticate(true); return }
      attempts++
      if (attempts >= 100) {
        if (timer) clearInterval(timer)
        if (telegramContext()) { setActive(true); setPending(false); setError('Telegram sessiyasi topilmadi. Mini Appni qayta oching.'); state('failed') }
        else { setActive(false); setPending(false) }
      }
    }

    if (initData()) void authenticate(true)
    else if (telegramContext()) { setActive(true); setPending(true); state('pending'); timer = setInterval(poll, 100) }
    else {
      const existing = document.querySelector('script[data-royalhouse-telegram-webapp]')
      if (!existing) {
        const script = document.createElement('script')
        script.src = 'https://telegram.org/js/telegram-web-app.js'; script.async = true
        script.dataset.royalhouseTelegramWebapp = 'true'; script.onload = poll
        document.head.appendChild(script); timer = setInterval(poll, 100)
      }
    }

    return () => { if (timer) clearInterval(timer) }
  }, [authenticate, state])

  const verifyPhone = async () => {
    setLoading(true); setError('')
    try {
      const normalized = phone.replace(/\D/g, '').replace(/^998/, '+998')
      if (!/^\+998\d{9}$/.test(normalized)) throw new Error('Telefon raqamini to‘g‘ri kiriting.')
      if (!sent) {
        const response = await fetch('/api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalized }), cache: 'no-store' })
        const result = await response.json().catch(() => null)
        if (!response.ok) throw new Error(result?.error || 'SMS yuborilmadi.')
        setPhone(normalized); setSent(true); return
      }

      const response = await fetch('/api/auth/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalized, code }), cache: 'no-store' })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.session?.access_token) throw new Error(result?.error || 'Telefon tasdiqlanmadi.')

      const telegramData = initData()
      if (!telegramData) throw new Error('Telegram sessiyasi topilmadi.')
      const linkResponse = await fetch('/api/auth/telegram/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: telegramData, accessToken: result.session.access_token }), cache: 'no-store' })
      const linked = await linkResponse.json().catch(() => null)
      if (!linkResponse.ok || !linked?.session?.access_token || !linked?.session?.refresh_token || !linked?.profile?.id) throw new Error(linked?.error || 'Telegramni profilga ulab bo‘lmadi.')

      const supabase = createClient(); await supabase.auth.signOut({ scope: 'local' }); clearSupabaseBrowserState()
      const { error: sessionError } = await supabase.auth.setSession({ access_token: linked.session.access_token, refresh_token: linked.session.refresh_token })
      if (sessionError) throw sessionError
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user?.id !== linked.profile.id || String(userData.user.user_metadata?.telegram_user_id ?? '') !== String(linked.telegramUserId ?? '')) throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')
      setPhoneRequired(false); setPending(false); authenticatedInitData.current = telegramData; state('ready')
    } catch (e) { setError(e instanceof Error ? e.message : 'Tasdiqlash amalga oshmadi.') }
    finally { setLoading(false) }
  }

  if (!active) return <>{children}</>
  if (pending) return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"><div className="rounded-3xl bg-white p-7 text-center shadow-xl ring-1 ring-slate-200"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600"/><b>Royalhouse</b><p className="mt-2 text-sm text-slate-500">Telegram profilingiz tekshirilmoqda…</p></div></div>
  if (phoneRequired) return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-5"><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200"><b className="text-xl">Telegram profil topilmadi</b><p className="mt-2 text-sm text-slate-600">Telegram profilingizga bog‘langan Royalhouse akkaunt topilmadi. Telefon raqamingizni tasdiqlang.</p><input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="+998 90 123 45 67" className="mt-5 w-full rounded-2xl border px-4 py-3" disabled={sent || loading}/>{sent && <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0,6))} inputMode="numeric" placeholder="SMS kod" className="mt-3 w-full rounded-2xl border px-4 py-3" disabled={loading}/>}<button onClick={verifyPhone} disabled={loading || (sent && code.length !== 6)} className="mt-3 w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white">{loading ? 'Tekshirilmoqda…' : sent ? 'Tasdiqlash' : 'Tasdiqlash'}</button>{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}</div></div>
  if (error) return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"><div className="rounded-3xl p-7 text-center shadow-xl ring-1 ring-slate-200"><b>Telegram tekshiruvi bajarilmadi</b><p className="mt-2 text-sm text-slate-600">{error}</p></div></div>
  return <>{children}</>
}
