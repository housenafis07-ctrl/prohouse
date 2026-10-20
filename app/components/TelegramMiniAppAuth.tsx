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

function LoadingGate({ text }: { text: string }) {
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

function PhoneVerificationGate({
  phone,
  setPhone,
  code,
  setCode,
  sent,
  loading,
  message,
  onSend,
  onVerify,
}: {
  phone: string
  setPhone: (value: string) => void
  code: string
  setCode: (value: string) => void
  sent: boolean
  loading: boolean
  message: string
  onSend: () => void
  onVerify: () => void
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-5">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 font-black">✓</div>
        <p className="text-xl font-extrabold text-slate-900">Telegram akkauntini tasdiqlang</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Bu Telegram akkaunti Royalhouse profiliga hali xavfsiz tasdiqlanmagan. Telefon raqamingizni SMS kod orqali tekshiramiz. Bu boshqa foydalanuvchining profiliga kirib ketishning oldini oladi.
        </p>
        <div className="mt-5 space-y-3">
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+998 90 123 45 67"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            disabled={sent || loading}
          />
          {!sent ? (
            <button type="button" onClick={onSend} disabled={loading} className="w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-60">
              {loading ? 'Yuborilmoqda…' : 'SMS kod yuborish'}
            </button>
          ) : (
            <>
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 xonali kod"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
                disabled={loading}
              />
              <button type="button" onClick={onVerify} disabled={loading || code.length !== 6} className="w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-60">
                {loading ? 'Tekshirilmoqda…' : 'Telefonni tasdiqlash'}
              </button>
            </>
          )}
        </div>
        {message && <p className="mt-4 text-sm leading-5 text-rose-600">{message}</p>}
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
  const [telegramContext, setTelegramContext] = useState<boolean | null>(null)
  const [verificationRequired, setVerificationRequired] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState('')

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

        if (response.status === 428 && data?.error === 'TELEGRAM_PHONE_VERIFICATION_REQUIRED') {
          window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'blocked'
          if (!cancelled) {
            setVerificationRequired(true)
            setActive(false)
          }
          return
        }

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
        if (!data?.session?.access_token || !data?.session?.refresh_token || !data?.profile?.id) throw new Error('TELEGRAM_SESSION_MISSING')

        const supabase = createClient()
        await supabase.auth.signOut({ scope: 'local' })
        const { error: sessionError } = await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
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

    if (tryStart()) {
      return () => { cancelled = true; finish() }
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

    // Keep ordinary royalhouse.uz visits fast. Telegram normally exposes
    // WebApp immediately; this is only a short browser fallback, not 1.5s.
    timeoutTimer = window.setTimeout(() => {
      finish()
      if (!cancelled && !window.Telegram?.WebApp?.initData) {
        setTelegramContext(false)
        window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'idle'
      }
    }, 150)

    return () => { cancelled = true; finish() }
  }, [pathname])

  const verifyTelegramWithPhone = async () => {
    setVerificationLoading(true)
    setVerificationMessage('')
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
      if (!completeResponse.ok || !completeData?.session?.access_token) throw new Error(completeData?.error || 'Telegramni profilga ulab bo‘lmadi.')

      const supabase = createClient()
      await supabase.auth.signOut({ scope: 'local' })
      const { error: sessionError } = await supabase.auth.setSession({ access_token: completeData.session.access_token, refresh_token: completeData.session.refresh_token })
      if (sessionError) throw sessionError
      const { data: verified } = await supabase.auth.getUser()
      if (!verified.user || verified.user.id !== completeData.profile.id) throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')

      window.__ROYALHOUSE_TELEGRAM_AUTH_STATE__ = 'ready'
      window.location.replace(new URLSearchParams(window.location.search).get('next') || pathname || '/')
    } catch (error) {
      console.error('[telegram-miniapp-phone-verification]', error)
      setVerificationMessage(error instanceof Error ? error.message : 'Tasdiqlash amalga oshmadi.')
    } finally {
      setVerificationLoading(false)
    }
  }

  const startLinking = async () => {
    setVerificationLoading(true)
    try {
      const response = await fetch('/api/account/telegram/link', { method: 'POST', credentials: 'include', cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.url) throw new Error(data?.error || 'LINK_FAILED')
      window.location.href = data.url
    } catch (error) {
      console.error('[telegram-miniapp-auth] link failed', error)
      setVerificationLoading(false)
    }
  }

  if (telegramContext === null || telegramContext === true) {
    if (verificationRequired) {
      return <PhoneVerificationGate phone={phone} setPhone={setPhone} code={code} setCode={setCode} sent={sent} loading={verificationLoading} message={verificationMessage} onSend={verifyTelegramWithPhone} onVerify={verifyTelegramWithPhone} />
    }

    if (conflict) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 px-6">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-slate-200">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-xl">⚠️</div>
            <p className="text-lg font-extrabold text-slate-900">Telegram akkaunti tekshirildi</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{conflict === 'already-linked' ? 'Bu Telegram akkaunti boshqa Royalhouse profiliga ulangan. Hozirgi profilni almashtirmaymiz.' : 'Siz hozir Royalhouse akkauntiga telefon orqali kirgansiz. Telegramni shu profilga ulash uchun tasdiqlang.'}</p>
            {conflict === 'link' ? <button type="button" onClick={startLinking} disabled={verificationLoading} className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-60">Telegramni ulash</button> : <button type="button" onClick={() => router.replace('/account')} className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white">Hozirgi profilga qaytish</button>}
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
            <p className="mt-2 text-sm leading-6 text-slate-600">Telegram orqali ochilgan oynani qayta oching. Eski Royalhouse profiliga avtomatik o‘tmaymiz.</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 font-bold text-white">Qayta tekshirish</button>
          </div>
        </div>
      )
    }

    return <LoadingGate text={active ? 'Telegram profilingiz tekshirilmoqda...' : 'Royalhouse xavfsiz kirishni tekshirmoqda...'} />
  }

  return <>{children}</>
}
