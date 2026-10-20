'use client'

import { ReactNode, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type TelegramWebApp = { initData: string; ready: () => void; expand: () => void }

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
    TelegramWebviewProxy?: unknown
    __ROYALHOUSE_TELEGRAM_AUTH_STATE__?: 'idle' | 'pending' | 'ready' | 'blocked' | 'failed'
  }
}

type Props = { children?: ReactNode }

function Gate({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-5"><div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-slate-200">{children}</div></div>
}

function PhoneGate({ phone, setPhone, code, setCode, sent, loading, message, onSubmit }: {
  phone: string; setPhone: (v: string) => void; code: string; setCode: (v: string) => void; sent: boolean; loading: boolean; message: string; onSubmit: () => void
}) {
  return <Gate>
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 font-black">✓</div>
    <p className="text-xl font-extrabold text-slate-900">Telegram akkauntini tasdiqlang</p>
    <p className="mt-2 text-sm leading-6 text-slate-600">Bu Telegram akkaunti Royalhouse profiliga hali xavfsiz tasdiqlanmagan. Telefon raqamingizni SMS kod orqali tekshiramiz.</p>
    <div className="mt-5 space-y-3">
      <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="+998 90 123 45 67" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" disabled={sent || loading}/>
      {sent && <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="6 xonali kod" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" disabled={loading}/>}      
      <button type="button" onClick={onSubmit} disabled={loading || (sent && code.length !== 6)} className="w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-60">{loading ? 'Tekshirilmoqda…' : sent ? 'Telefonni tasdiqlash' : 'SMS kod yuborish'}</button>
    </div>
    {message && <p className="mt-4 text-sm leading-5 text-rose-600">{message}</p>}
  </Gate>
}

export default function TelegramMiniAppAuth({ children }: Props) {
  const pathname = usePathname()
  const [telegramContext, setTelegramContext] = useState<boolean>(() => typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp?.initData || window.TelegramWebviewProxy))
  const [state, setState] = useState<'idle' | 'pending' | 'ready' | 'blocked' | 'failed'>(() => typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp?.initData || window.TelegramWebviewProxy) ? 'pending' : 'idle')
  const [verificationRequired, setVerificationRequired] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    const inTelegram = Boolean(webApp?.initData || window.TelegramWebviewProxy)
    if (!inTelegram) {
      setTelegramContext(false)
      setState('idle')
      return
    }
    setTelegramContext(true)
    if (!webApp?.initData) {
      setState('failed')
      window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'failed'
      return
    }

    let cancelled = false
    const authenticate = async () => {
      window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'pending'
      setState('pending')
      webApp.ready()
      webApp.expand()

      // Mini App login is a new authentication context. Never let an old
      // browser session choose the RoyalHouse account.
      const supabase = createClient()
      await supabase.auth.signOut({ scope: 'local' })
      if (cancelled) return

      try {
        const response = await fetch('/api/auth/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: webApp.initData }), credentials: 'include', cache: 'no-store' })
        const data = await response.json().catch(() => null)
        if (response.status === 428 && data?.error === 'TELEGRAM_PHONE_VERIFICATION_REQUIRED') {
          setVerificationRequired(true)
          setState('blocked')
          window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'blocked'
          return
        }
        if (!response.ok) throw new Error(data?.error || 'TELEGRAM_AUTH_FAILED')
        if (!data?.session?.access_token || !data?.session?.refresh_token || !data?.profile?.id) throw new Error('TELEGRAM_SESSION_MISSING')
        const { error } = await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
        if (error) throw error
        const { data: verified } = await supabase.auth.getUser()
        if (!verified.user || verified.user.id !== data.profile.id) {
          await supabase.auth.signOut({ scope: 'local' })
          throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')
        }
        window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'ready'
        setState('ready')
        const next = new URLSearchParams(window.location.search).get('next')
        const target = next && next.startsWith('/') ? next : pathname === '/register' ? '/account' : pathname
        if (!cancelled) window.location.replace(target || '/')
      } catch (error) {
        console.error('[telegram-miniapp-auth]', error)
        window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'failed'
        if (!cancelled) setState('failed')
      }
    }
    void authenticate()
    return () => { cancelled = true }
  }, [pathname])

  const verifyWithPhone = async () => {
    setLoading(true)
    setMessage('')
    try {
      const normalized = phone.replace(/\D/g, '').replace(/^998/, '+998')
      if (!/^\+998\d{9}$/.test(normalized)) throw new Error('Telefon raqamini to‘g‘ri kiriting.')
      if (!sent) {
        const r = await fetch('/api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalized }), cache: 'no-store' })
        const d = await r.json().catch(() => null)
        if (!r.ok) throw new Error(d?.error || 'SMS yuborilmadi.')
        setPhone(normalized)
        setSent(true)
        return
      }
      const r = await fetch('/api/auth/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalized, code }), cache: 'no-store' })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d?.session?.access_token) throw new Error(d?.error || 'Telefon tasdiqlanmadi.')
      const initData = window.Telegram?.WebApp?.initData
      if (!initData) throw new Error('Telegram sessiyasi topilmadi. Mini Appni qayta oching.')
      const r2 = await fetch('/api/auth/telegram/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, accessToken: d.session.access_token }), cache: 'no-store' })
      const d2 = await r2.json().catch(() => null)
      if (!r2.ok || !d2?.session?.access_token || !d2?.profile?.id) throw new Error(d2?.error || 'Telegramni profilga ulab bo‘lmadi.')
      const supabase = createClient()
      await supabase.auth.signOut({ scope: 'local' })
      const { error } = await supabase.auth.setSession({ access_token: d2.session.access_token, refresh_token: d2.session.refresh_token })
      if (error) throw error
      const { data: verified } = await supabase.auth.getUser()
      if (!verified.user || verified.user.id !== d2.profile.id) {
        await supabase.auth.signOut({ scope: 'local' })
        throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')
      }
      window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'ready'
      window.location.replace(new URLSearchParams(window.location.search).get('next') || pathname || '/')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Tasdiqlash amalga oshmadi.')
    } finally { setLoading(false) }
  }

  if (!telegramContext) return <>{children}</>
  if (verificationRequired) return <PhoneGate phone={phone} setPhone={setPhone} code={code} setCode={setCode} sent={sent} loading={loading} message={message} onSubmit={verifyWithPhone}/>
  if (state === 'pending') return <Gate><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600"/><p className="text-lg font-extrabold text-slate-900">Royalhouse</p><p className="mt-1 text-sm text-slate-500">Royalhouse xavfsiz kirishni tekshirmoqda…</p></Gate>
  if (state === 'failed') return <Gate><p className="text-lg font-extrabold text-slate-900">Telegram tekshiruvi bajarilmadi</p><p className="mt-2 text-sm leading-6 text-slate-600">Telegram Mini Appni qayta oching.</p><button type="button" onClick={() => window.location.reload()} className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white">Qayta tekshirish</button></Gate>
  return <>{children}</>
}
