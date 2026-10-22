'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/app/components/I18nProvider'

type Props = {
  listingId: string
  title: string
  priceLabel: string
  isTrusted: boolean
  isOwner: boolean
  variant?: 'mobile' | 'inline'
}

export default function ListingConversionBar({ listingId, title, priceLabel, isTrusted, isOwner, variant = 'mobile' }: Props) {
  const { lang } = useI18n()
  const [shared, setShared] = useState(false)
  const viewed = useRef(false)

  useEffect(() => {
    if (isOwner || viewed.current) return
    viewed.current = true
    const timer = window.setTimeout(() => {
      const payload = JSON.stringify({ listingId, action: 'view' })
      try {
        if (navigator.sendBeacon('/api/listings/interactions', new Blob([payload], { type: 'application/json' }))) return
      } catch {}
      void fetch('/api/listings/interactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {})
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [isOwner, listingId])

  const share = async () => {
    const url = window.location.href
    const text = `${title} — ${priceLabel}`
    try {
      if (navigator.share) await navigator.share({ title, text, url })
      else if (navigator.clipboard) await navigator.clipboard.writeText(url)
      else {
        const input = document.createElement('input')
        input.value = url
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
      }
      setShared(true)
      void fetch('/api/listings/interactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId, action: 'share' }), keepalive: true }).catch(() => {})
      window.setTimeout(() => setShared(false), 1800)
    } catch {}
  }

  if (isOwner) return null

  const copyText = lang === 'ru' ? 'Скопировано' : 'Havola nusxalandi'
  const shareText = lang === 'ru' ? 'Поделиться' : 'Ulashish'
  const telegramText = lang === 'ru' ? 'Поделиться через Telegram' : 'Telegram orqali ulashish'
  const trustText = lang === 'ru' ? 'Надёжный профиль' : 'Ishonchli profil'
  const telegramUrl = `https://t.me/RoyalHouseUz_bot?start=share_${encodeURIComponent(listingId)}`

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={share} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 active:scale-[.98]">
          <span aria-hidden="true">↗</span>
          <span>{shared ? copyText : shareText}</span>
        </button>
        <a href={telegramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-sky-600 active:scale-[.98]">
          <span aria-hidden="true">✈</span>
          <span>{telegramText}</span>
        </a>
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-3 py-2 shadow-[0_-8px_30px_rgba(15,23,42,0.10)] backdrop-blur md:inset-x-auto md:right-6 md:bottom-6 md:rounded-2xl md:border md:shadow-xl">
      <div className="mx-auto flex max-w-xl items-center gap-2 md:max-w-none">
        {isTrusted && <div className="hidden min-w-0 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700 sm:flex"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">✓</span><span className="truncate">{trustText}</span></div>}
        <button type="button" onClick={share} className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-extrabold text-slate-700 active:scale-[.98]"><span aria-hidden="true">↗</span><span>{shared ? copyText : shareText}</span></button>
        <a href={telegramUrl} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3 py-3 text-sm font-extrabold text-white active:scale-[.98]"><span aria-hidden="true">✈</span><span>Telegram</span></a>
      </div>
    </div>
  )
}
