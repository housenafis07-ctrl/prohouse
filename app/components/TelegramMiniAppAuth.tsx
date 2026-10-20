'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
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
  }
}

type Props = { children?: ReactNode }

function Gate({ text }: { text: string }) {
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

function PhoneGate({ phone, setPhone, code, setCode, sent, loading, message, onSubmit }: {
  phone: string
  setPhone: (v: string) => void
  code: string
  setCode: (v: string) => void
  sent: boolean
  loading: boolean
  message: string
  onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-5">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <p className="text-xl font-extrabold text-slate-900">Telegram akkauntini tasdiqlang</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">Bu Telegram akkauntiga bog‘langan Royalhouse profili topilmadi. Telefon raqamingizni SMS kod bilan tasdiqlang. Shundan keyin shu Telegram akkaunti faqat sizning profilingizga bog‘lanadi.</p>
        <div className="mt-5 space-y-3">
          <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="+998 90 123 45 67" disabled={sent || loading} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />
          {!sent ? null : <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="6 xonali kod" disabled={loading} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />}
          <button type="button" onClick={onSubmit} disabled={loading || (sent && code.length !== 6)} className="w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-60">{loading ? 'Tekshirilmoqda…' : sent ? 'Telefonni tasdiqlash' : 'SMS kod yuborish'}</button>
        </div>
        {message && <p className="mt-4 text-sm leading-5 text-rose-600">{message}</p>}
      </div>
    </div>
  )
}

export default function TelegramMiniAppAuth({ children }: Props) {
  const started = useRef(false)
  const [context, setContext] = useState<boolean | null>(null)
  const [status, setStatus] = useState<'checking' | 'ready' | 'phone' | 'conflict' | 'error'>('checking')
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    let poll: number | undefined
    let timeout: number | undefined

    const supabase = createClient()

    const isTelegramEnvironment = () => Boolean(window.TelegramWebviewProxy) || /Telegram/i.test(navigator.userAgent)

    const authenticate = async (webApp: TelegramWebApp) => {
      if (cancelled || !webApp.initData) return
      webApp.ready()
      webApp.expand()
      setContext(true)
      setStatus('checking')
      setMessage('Royalhouse xavfsiz kirishni tekshirmoqda…')

      try {
        // Never let an older browser session decide which Royalhouse profile
        // this Telegram user becomes. Clear only the Supabase auth session;
        // do not wipe application preferences from localStorage.
        await supabase.auth.signOut({ scope: 'local' })

        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: webApp.initData }),
          cache: 'no-store',
          credentials: 'include',
        })
        const data = await response.json().catch(() => null)

        if (response.status === 428 && data?.error === 'TELEGRAM_PHONE_VERIFICATION_REQUIRED') {
          if (!cancelled) { setStatus('phone'); setMessage('') }
          return
        }

        if (response.status === 409) {
          if (!cancelled) { setStatus('conflict'); setMessage('Bu Telegram akkaunti boshqa Royalhouse profiliga ulangan. Profil almashtirilmaydi.') }
          return
        }

        if (!response.ok) throw new Error(data?.error || 'TELEGRAM_AUTH_FAILED')
        if (!data?.session?.access_token || !data?.session?.refresh_token || !data?.profile?.id) throw new Error('TELEGRAM_SESSION_MISSING')

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
        if (sessionError) throw sessionError

        const { data: verified, error: userError } = await supabase.auth.getUser()
        if (userError || !verified.user || verified.user.id !== data.profile.id) {
          await supabase.auth.signOut({ scope: 'local' })
          throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')
        }

        if (!cancelled) {
          setStatus('ready')
          setMessage('')
          // Force a full request so Server Components and SSR cookies are read
          // from the newly established Telegram session, not a stale profile.
          window.location.replace(window.location.href)
        }
      } catch (error) {
        console.error('[telegram-miniapp-auth]', error)
        if (!cancelled) {
          setStatus('error')
          setMessage(error instanceof Error ? error.message : 'Telegram orqali kirish amalga oshmadi.')
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

    if (tryStart()) return () => { cancelled = true }

    // Telegram officially recommends loading telegram-web-app.js in <head>
    // before other scripts. layout.tsx does that now. This short poll is only
    // a race guard for slower Telegram clients; it must not silently fall back
    // to an old Royalhouse session inside Telegram.
    poll = window.setInterval(() => {
      if (tryStart()) {
        if (poll) window.clearInterval(poll)
        if (timeout) window.clearTimeout(timeout)
      }
    }, 50)

    timeout = window.setTimeout(() => {
      if (poll) window.clearInterval(poll)
      if (cancelled) return
      if (window.Telegram?.WebApp?.initData) {
        void authenticate(window.Telegram.WebApp)
        return
      }
      if (isTelegramEnvironment()) {
        setContext(true)
        setStatus('error')
        setMessage('Telegram sessiyasi topilmadi. Mini Appni Telegram ichidan qayta oching.')
      } else {
        // Ordinary royalhouse.uz visits stay fast and keep their normal session.
        setContext(false)
        setStatus('ready')
      }
    }, 2500)

    return () => {
      cancelled = true
      if (poll) window.clearInterval(poll)
      if (timeout) window.clearTimeout(timeout)
    }
  }, [])

  const submitPhone = async () => {
    setLoading(true)
    setMessage('')
    try {
      const normalizedPhone = phone.replace(/\D/g, '').replace(/^998/, '+998')
      if (!/^\+998\d{9}$/.test(normalizedPhone)) throw new Error('Telefon raqamini to‘g‘ri kiriting.')

      if (!sent) {
        const response = await fetch('/api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalizedPhone }), cache: 'no-store' })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || 'SMS yuborilmadi.')
        setPhone(normalizedPhone)
        setSent(true)
        return
      }

      const verifyResponse = await fetch('/api/auth/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalizedPhone, code }), cache: 'no-store' })
      const verifyData = await verifyResponse.json().catch(() => null)
      if (!verifyResponse.ok || !verifyData?.session?.access_token) throw new Error(verifyData?.error || 'Telefon tasdiqlanmadi.')

      const webApp = window.Telegram?.WebApp
      if (!webApp?.initData) throw new Error('Telegram sessiyasi topilmadi. Mini Appni qayta oching.')

      const completeResponse = await fetch('/api/auth/telegram/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: webApp.initData, accessToken: verifyData.session.access_token }),
        cache: 'no-store',
      })
      const completeData = await completeResponse.json().catch(() => null)
      if (!completeResponse.ok || !completeData?.session?.access_token || !completeData?.profile?.id) throw new Error(completeData?.error || 'Telegramni profilga ulab bo‘lmadi.')

      await supabase.auth.signOut({ scope: 'local' })
      const { error: sessionError } = await supabase.auth.setSession({ access_token: completeData.session.access_token, refresh_token: completeData.session.refresh_token })
      if (sessionError) throw sessionError
      const { data: verified } = await supabase.auth.getUser()
      if (!verified.user || verified.user.id !== completeData.profile.id) {
        await supabase.auth.signOut({ scope: 'local' })
        throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')
      }

      window.location.replace(window.location.href)
    } catch (error) {
      console.error('[telegram-miniapp-phone-verification]', error)
      setMessage(error instanceof Error ? error.message : 'Tasdiqlash amalga oshmadi.')
    } finally {
      setLoading(false)
    }
  }

  if (context === null || (context === true && status === 'checking')) return <Gate text="Royalhouse xavfsiz kirishni tekshirmoqda…" />

  if (context === true && status === 'phone') return <PhoneGate phone={phone} setPhone={setPhone} code={code} setCode={setCode} sent={sent} loading={loading} message={message} onSubmit={submitPhone} />

  if (context === true && status === 'conflict') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-slate-200">
          <p className="text-lg font-extrabold text-slate-900">Telegram akkaunti boshqa profilga ulangan</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Xavfsizlik sababli boshqa Royalhouse profiliga avtomatik o‘tmaymiz.</p>
        </div>
      </div>
    )
  }

  if (context === true && status === 'error') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-slate-200">
          <p className="text-lg font-extrabold text-slate-900">Telegram tekshiruvi bajarilmadi</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{message || 'Telegram Mini Appni qayta oching.'}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white">Qayta tekshirish</button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
