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
  const [shareOpen, setShareOpen] = useState(false)
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

  if (isOwner) return null

  const url = typeof window !== 'undefined' ? window.location.href : ''
  const text = `${title} — ${priceLabel}`
  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(text)
  const telegramBotUrl = `https://t.me/RoyalHouseUz_bot?start=share_${encodeURIComponent(listingId)}`
  const telegramShareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
  const xUrl = `https://x.com/intent/post?text=${encodedText}&url=${encodedUrl}`

  const trackShare = () => {
    void fetch('/api/listings/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, action: 'share' }),
      keepalive: true,
    }).catch(() => {})
  }

  const copyLink = async () => {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(url)
      else {
        const input = document.createElement('input')
        input.value = url
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
      }
      setShared(true)
      trackShare()
      window.setTimeout(() => setShared(false), 1800)
    } catch {}
  }

  const openNativeShare = async () => {
    try {
      if (!navigator.share) return
      await navigator.share({ title, text, url })
      trackShare()
      setShareOpen(false)
    } catch {}
  }

  const copyText = lang === 'ru' ? 'Скопировано' : 'Havola nusxalandi'
  const shareText = lang === 'ru' ? 'Поделиться' : 'Ulashish'
  const telegramText = lang === 'ru' ? 'Telegram orqali ulashish' : 'Telegram orqali ulashish'
  const telegramMediaText = lang === 'ru' ? 'Rasm va video bilan yuborish' : 'Rasm va video bilan yuborish'
  const trustText = lang === 'ru' ? 'Надёжный профиль' : 'Ishonchli profil'

  const openShare = () => setShareOpen(true)
  const renderSheet = shareOpen ? <ShareSheet lang={lang} telegramBotUrl={telegramBotUrl} telegramShareUrl={telegramShareUrl} whatsappUrl={whatsappUrl} facebookUrl={facebookUrl} xUrl={xUrl} shared={shared} onCopy={copyLink} onNativeShare={openNativeShare} onTrackShare={trackShare} onClose={() => setShareOpen(false)} telegramText={telegramText} telegramMediaText={telegramMediaText} /> : null

  if (variant === 'inline') {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openShare} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 active:scale-[.98]">
            <span aria-hidden="true">↗</span>
            <span>{shared ? copyText : shareText}</span>
          </button>
        </div>
        {renderSheet}
      </>
    )
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 px-3 py-2 shadow-[0_-8px_30px_rgba(15,23,42,0.10)] backdrop-blur md:inset-x-auto md:right-6 md:bottom-6 md:rounded-2xl md:border md:shadow-xl">
        <div className="mx-auto flex max-w-xl items-center gap-2 md:max-w-none">
          {isTrusted && <div className="hidden min-w-0 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700 sm:flex"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">✓</span><span className="truncate">{trustText}</span></div>}
          <button type="button" onClick={openShare} className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-extrabold text-slate-700 active:scale-[.98]"><span aria-hidden="true">↗</span><span>{shared ? copyText : shareText}</span></button>
        </div>
      </div>
      {renderSheet}
    </>
  )
}

type ShareSheetProps = {
  lang: string
  telegramBotUrl: string
  telegramShareUrl: string
  whatsappUrl: string
  facebookUrl: string
  xUrl: string
  shared: boolean
  onCopy: () => void
  onNativeShare: () => void
  onTrackShare: () => void
  onClose: () => void
  telegramText: string
  telegramMediaText: string
}

function ShareSheet({ lang, telegramBotUrl, telegramShareUrl, whatsappUrl, facebookUrl, xUrl, shared, onCopy, onNativeShare, onTrackShare, onClose, telegramText, telegramMediaText }: ShareSheetProps) {
  const title = lang === 'ru' ? 'Поделиться объявлением' : 'E’lonni ulashish'
  const description = lang === 'ru' ? 'Telegram orqali media bilan yuborish yoki boshqa ilovani tanlang.' : 'Telegram orqali rasm/video bilan yuboring yoki boshqa ilovani tanlang.'
  const directTelegram = 'Telegram'
  const copy = lang === 'ru' ? 'Скопировать ссылку' : 'Havolani nusxalash'
  const other = lang === 'ru' ? 'Другие приложения' : 'Boshqa ilovalar'
  const close = lang === 'ru' ? 'Закрыть' : 'Yopish'

  const openExternal = () => {
    onTrackShare()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl" onMouseDown={event => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={close} className="rounded-full px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4">
          <a href={telegramBotUrl} target="_blank" rel="noreferrer" onClick={openExternal} className="col-span-2 flex items-center gap-3 rounded-2xl bg-sky-500 px-4 py-3 text-white shadow-sm hover:bg-sky-600">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl" aria-hidden="true">✈</span>
            <span className="min-w-0"><span className="block font-black">{telegramText}</span><span className="mt-0.5 block text-xs text-white/85">{telegramMediaText}</span></span>
          </a>

          <a href={telegramShareUrl} target="_blank" rel="noreferrer" onClick={openExternal} className="flex items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-3 font-extrabold text-sky-700 hover:bg-sky-100"><span className="text-xl" aria-hidden="true">✈</span>{directTelegram}</a>
          <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={openExternal} className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3 font-extrabold text-emerald-700 hover:bg-emerald-100"><span className="text-xl" aria-hidden="true">◉</span>WhatsApp</a>
          <a href={facebookUrl} target="_blank" rel="noreferrer" onClick={openExternal} className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-3 font-extrabold text-blue-700 hover:bg-blue-100"><span className="text-xl" aria-hidden="true">f</span>Facebook</a>
          <a href={xUrl} target="_blank" rel="noreferrer" onClick={openExternal} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 font-extrabold text-slate-900 hover:bg-slate-100"><span className="text-xl" aria-hidden="true">𝕏</span>X</a>
          <button type="button" onClick={onCopy} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 font-extrabold text-slate-700 hover:bg-slate-50"><span className="text-xl" aria-hidden="true">🔗</span>{shared ? (lang === 'ru' ? 'Скопировано' : 'Nusxalandi') : copy}</button>
          <button type="button" onClick={onNativeShare} className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 font-extrabold text-white hover:bg-slate-800"><span aria-hidden="true">↗</span>{other}</button>
        </div>
      </div>
    </div>
  )
}
