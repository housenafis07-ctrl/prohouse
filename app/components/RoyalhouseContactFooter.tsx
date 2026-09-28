'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function RoyalhouseContactFooter() {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  useEffect(() => {
    const find = () => {
      const footer = document.querySelector('main > footer')
      if (!footer) return false
      let target = footer.querySelector<HTMLElement>('[data-royalhouse-contact]')
      if (!target) {
        target = document.createElement('div')
        target.dataset.royalhouseContact = 'true'
        target.style.display = 'block'
        target.style.width = '100%'
        footer.insertBefore(target, footer.firstElementChild)
      }
      setHost(target)
      return true
    }

    if (find()) return
    const observer = new MutationObserver(() => {
      if (find()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!message.trim() || busy) return
    setBusy(true)
    setResult('')
    try {
      const response = await fetch('/api/support/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, message }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Xabar yuborilmadi.')
      setName('')
      setPhone('')
      setEmail('')
      setMessage('')
      setResult('Xabaringiz yuborildi. Tez orada siz bilan bog‘lanamiz.')
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Xatolik yuz berdi.')
    } finally {
      setBusy(false)
    }
  }

  if (!host) return null

  return createPortal(
    <section className="border-b border-white/10 px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
          <div className="min-w-0 lg:flex-1">
            <button
              type="button"
              onClick={() => setOpen(value => !value)}
              aria-expanded={open}
              className="group inline-flex appearance-none items-center gap-2 border-0 bg-transparent p-0 text-left text-white outline-none"
            >
              <span className="text-xl font-black transition-colors group-hover:text-emerald-400">
                Qayta aloqa
              </span>
              <span
                className="text-sm text-slate-400 transition-transform duration-200 group-hover:text-emerald-400"
                style={{ transform: open ? 'rotate(180deg)' : undefined }}
              >
                ▾
              </span>
            </button>
            <p className="mt-1 text-sm text-slate-300">Shikoyat va takliflar</p>
          </div>

          <div className="min-w-0 lg:flex-1">
            <a
              href="tel:+998998244494"
              className="block text-lg font-extrabold text-white hover:text-emerald-400"
            >
              +998 99 824 44 94
            </a>
            <p className="mt-1 text-xs text-slate-400">Har kuni 09:00 dan 18:00 gacha</p>
          </div>

          <div className="min-w-0 lg:flex-1">
            <a
              href="https://t.me/RoyalHouseUz_bot?start=support"
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-400"
            >
              Telegram orqali qo‘llab-quvvatlash
            </a>
          </div>
        </div>

        {open && (
          <form
            onSubmit={submit}
            className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ismingiz"
                className="min-w-0 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-emerald-400"
              />
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Telefon raqamingiz"
                className="min-w-0 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-emerald-400"
              />
            </div>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              placeholder="Email (ixtiyoriy)"
              className="mt-3 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-emerald-400"
            />
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
              rows={4}
              placeholder="Xabaringizni yozing..."
              className="mt-3 w-full resize-none rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-emerald-400"
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-400">{result}</span>
              <button
                disabled={busy || !message.trim()}
                className="w-full rounded-xl bg-white px-5 py-2.5 text-sm font-black text-slate-900 disabled:opacity-50 sm:w-auto"
              >
                {busy ? 'Yuborilmoqda...' : 'Yuborish'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>,
    host
  )
}
