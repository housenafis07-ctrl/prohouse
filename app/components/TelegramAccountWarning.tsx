'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function TelegramAccountWarning() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!pathname?.startsWith('/account')) return

    let active = true
    let timer: number | undefined

    const check = async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const response = await fetch('/api/account/telegram/link', {
            cache: 'no-store',
            credentials: 'include',
          })
          if (response.ok) {
            const data = await response.json()
            if (!active) return
            setVisible(data.mismatch === true || data.linked === false)
            setChecking(false)
            return
          }
        } catch {
          // Retry while the Telegram/Supabase session is hydrating.
        }
        await new Promise(resolve => { timer = window.setTimeout(resolve, 250) })
      }

      if (active) setChecking(false)
    }

    const onMismatch = () => {
      if (active) {
        setVisible(true)
        setChecking(false)
      }
    }

    window.addEventListener('royalhouse:telegram-mismatch', onMismatch)
    void check()

    return () => {
      active = false
      if (timer) window.clearTimeout(timer)
      window.removeEventListener('royalhouse:telegram-mismatch', onMismatch)
    }
  }, [pathname])

  if (!pathname?.startsWith('/account') || checking || !visible) return null

  async function connectTelegram() {
    setBusy(true)
    try {
      const response = await fetch('/api/account/telegram/link', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok || !data.url) throw new Error(data.error || 'Telegram ulash havolasini yaratib bo‘lmadi.')
      setUrl(data.url)
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch {
      setBusy(false)
      return
    }
    setBusy(false)
  }

  return (
    <div className="fixed left-1/2 top-3 z-[80] w-[calc(100%-24px)] max-w-lg -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">!</div>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-amber-900">Telegram akkauntingiz ulanmagan</p>
          <p className="mt-1 text-sm leading-5 text-amber-800">
            Bu RoyalHouse akkauntidagi telefon raqami hozirgi Telegram akkauntingizga ulanmagan. Bildirishnomalarni olish uchun Telegramni ulang.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={connectTelegram} disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60">
              {busy ? 'Ulanmoqda...' : 'Telegramni ulash'}
            </button>
            <button type="button" onClick={() => setVisible(false)} className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-bold text-amber-900">
              Keyinroq
            </button>
          </div>
          {url && <p className="mt-2 text-xs text-amber-700">Bot ochilsa, Start tugmasini bosing.</p>}
        </div>
      </div>
    </div>
  )
}
