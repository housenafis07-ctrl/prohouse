'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Props = { children?: ReactNode }
type WebApp = { initData: string; ready: () => void; expand: () => void }

declare global { interface Window { Telegram?: { WebApp?: WebApp }; TelegramWebviewProxy?: unknown } }

function inTelegram() {
  if (typeof window === 'undefined') return false
  return Boolean(window.Telegram?.WebApp?.initData || window.TelegramWebviewProxy || /[?&#]tgWebApp/i.test(window.location.href))
}

export default function TelegramMiniAppAuthCanonical({ children }: Props) {
  const started = useRef(false)
  const [active, setActive] = useState(() => inTelegram())
  const [pending, setPending] = useState(() => inTelegram())
  const [phoneRequired, setPhoneRequired] = useState(false)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (started.current || !inTelegram()) { if (!inTelegram()) { setActive(false); setPending(false) } return }
    started.current = true
    let timer: ReturnType<typeof setInterval> | undefined
    let attempts = 0
    const run = async () => {
      const webApp = window.Telegram?.WebApp
      if (!webApp?.initData) return
      if (timer) clearInterval(timer)
      webApp.ready(); webApp.expand()
      const supabase = createClient()
      await supabase.auth.signOut({ scope: 'local' })
      try {
        const r = await fetch('/api/auth/telegram/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', cache: 'no-store', body: JSON.stringify({ initData: webApp.initData }) })
        const d = await r.json().catch(() => null)
        if (r.status === 428) { setPhoneRequired(true); setPending(false); return }
        if (!r.ok || !d?.session?.access_token || !d?.profile?.id) throw new Error(d?.error || 'TELEGRAM_AUTH_FAILED')
        const { error: sessionError } = await supabase.auth.setSession({ access_token: d.session.access_token, refresh_token: d.session.refresh_token })
        if (sessionError) throw sessionError
        const { data: userData } = await supabase.auth.getUser()
        if (userData.user?.id !== d.profile.id) { await supabase.auth.signOut({ scope: 'local' }); throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH') }
        setPending(false)
      } catch (e) { setError(e instanceof Error ? e.message : 'TELEGRAM_AUTH_FAILED'); setPending(false) }
    }
    const poll = () => { if (window.Telegram?.WebApp?.initData) void run(); else if (++attempts >= 50) { if (timer) clearInterval(timer); setError('Telegram sessiyasi topilmadi. Mini Appni qayta oching.'); setPending(false) } }
    if (window.Telegram?.WebApp?.initData) void run(); else { const existing = document.querySelector('script[data-royalhouse-telegram-webapp]'); if (!existing) { const script = document.createElement('script'); script.src = 'https://telegram.org/js/telegram-web-app.js'; script.async = true; script.dataset.royalhouseTelegramWebapp = 'true'; script.onload = poll; document.head.appendChild(script) } else timer = setInterval(poll, 100) }
    return () => { if (timer) clearInterval(timer) }
  }, [])

  const verifyPhone = async () => {
    setLoading(true); setError('')
    try {
      const normalized = phone.replace(/\D/g, '').replace(/^998/, '+998')
      if (!/^\+998\d{9}$/.test(normalized)) throw new Error('Telefon raqamini to‘g‘ri kiriting.')
      if (!sent) {
        const r = await fetch('/api/auth/send-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalized }), cache: 'no-store' })
        const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error || 'SMS yuborilmadi.')
        setPhone(normalized); setSent(true); return
      }
      const r = await fetch('/api/auth/verify-code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalized, code }), cache: 'no-store' })
      const d = await r.json().catch(() => null); if (!r.ok || !d?.session?.access_token) throw new Error(d?.error || 'Telefon tasdiqlanmadi.')
      const initData = window.Telegram?.WebApp?.initData; if (!initData) throw new Error('Telegram sessiyasi topilmadi.')
      const link = await fetch('/api/auth/telegram/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData, accessToken: d.session.access_token }), cache: 'no-store' })
      const linked = await link.json().catch(() => null); if (!link.ok || !linked?.session?.access_token) throw new Error(linked?.error || 'Telegramni profilga ulab bo‘lmadi.')
      const supabase = createClient(); await supabase.auth.signOut({ scope: 'local' }); const { error: sessionError } = await supabase.auth.setSession({ access_token: linked.session.access_token, refresh_token: linked.session.refresh_token }); if (sessionError) throw sessionError
      const { data: userData } = await supabase.auth.getUser(); if (userData.user?.id !== linked.profile.id) throw new Error('TELEGRAM_PROFILE_SESSION_MISMATCH')
      setPhoneRequired(false); setPending(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Tasdiqlash amalga oshmadi.') } finally { setLoading(false) }
  }

  if (!active) return <>{children}</>
  if (pending) return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"><div className="rounded-3xl bg-white p-7 text-center shadow-xl ring-1 ring-slate-200"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600"/><b>Royalhouse</b><p className="mt-2 text-sm text-slate-500">Telegram profilingiz tekshirilmoqda…</p></div></div>
  if (phoneRequired) return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white px-5"><div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200"><b className="text-xl">Telegram profil topilmadi</b><p className="mt-2 text-sm text-slate-600">Telegram profilingizga bog‘langan Royalhouse akkaunt topilmadi. Telefon raqamingizni tasdiqlang.</p><input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="+998 90 123 45 67" className="mt-5 w-full rounded-2xl border px-4 py-3" disabled={sent || loading}/>{sent && <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0,6))} inputMode="numeric" placeholder="SMS kod" className="mt-3 w-full rounded-2xl border px-4 py-3" disabled={loading}/>}<button onClick={verifyPhone} disabled={loading || (sent && code.length !== 6)} className="mt-3 w-full rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white">{loading ? 'Tekshirilmoqda…' : sent ? 'Tasdiqlash' : 'SMS kod yuborish'}</button>{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}</div></div>
  if (error) return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white"><div className="rounded-3xl p-7 text-center shadow-xl ring-1 ring-slate-200"><b>Telegram tekshiruvi bajarilmadi</b><p className="mt-2 text-sm text-slate-600">{error}</p></div></div>
  return <>{children}</>
}
