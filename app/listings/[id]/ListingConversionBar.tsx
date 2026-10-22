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

export default function ListingConversionBar({ listingId, title, priceLabel, isOwner }: Props) {
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
  const telegramText = 'Telegram orqali ulashish'
  const telegramMediaText = 'Rasm va video bilan yuborish'
  const renderSheet = shareOpen ? <ShareSheet lang={lang} telegramShareUrl={telegramShareUrl} whatsappUrl={whatsappUrl} facebookUrl={facebookUrl} xUrl={xUrl} shared={shared} onCopy={copyLink} onNativeShare={openNativeShare} onTrackShare={trackShare} onClose={() => setShareOpen(false)} telegramText={telegramText} telegramMediaText={telegramMediaText} /> : null

  return (
    <>
      <button
        type="button"
        onClick={() => setShareOpen(true)}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 active:scale-[.97]"
        aria-label={shared ? copyText : shareText}
        title={shared ? copyText : shareText}
      >
        <ShareIcon className="h-5 w-5" />
      </button>
      {renderSheet}
    </>
  )
}

type ShareSheetProps = {
  lang: string
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

function TelegramIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor"><path d="M21.5 3.4 18.3 20c-.24 1.17-.9 1.46-1.82.91l-5.03-3.7-2.43 2.34c-.27.27-.5.5-1.03.5l.37-5.14 9.36-8.46c.41-.37-.09-.58-.64-.2L5.5 13.7.57 12.16c-1.07-.34-1.09-1.07.22-1.59L20.06 3.2c.9-.33 1.68.2 1.44.2Z" /></svg>
}

function WhatsAppIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M20.1 11.5a8.05 8.05 0 0 1-11.86 7.07L4 20l1.48-4.04A8.05 8.05 0 1 1 20.1 11.5Z" /><path d="M8.5 7.9c.18-.4.37-.41.68-.41h.56c.18 0 .36.04.47.32l.63 1.54c.09.23.07.4-.07.58l-.43.55c-.13.17-.2.28-.07.5.35.62.88 1.23 1.52 1.71.49.37 1.02.65 1.65.9.23.09.36.07.49-.09l.6-.71c.15-.18.31-.2.53-.11l1.48.7c.23.11.36.16.41.28.05.12.05.55-.13 1.04-.18.49-.98.92-1.36.97-.35.05-.8.07-1.29-.08-1.2-.42-2.1-.9-2.1-.9-2.1-.9-3.47-3.03-3.82-3.56-.35-.53-.91-1.4-.91-2.67 0-1.26.65-1.88.86-2.04Z" /></svg>
}

function FacebookIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor"><path d="M13.4 21v-8h2.7l.4-3h-3.1V8.08c0-.87.24-1.46 1.5-1.46h1.7V3.94c-.3-.04-1.35-.13-2.57-.13-2.55 0-4.3 1.56-4.3 4.43V10H7v3h2.73v8h3.67Z" /></svg>
}

function XIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor"><path d="M4.1 3h4.75l3.72 5.2L17.02 3h2.9l-5.99 6.86L20.2 21h-4.76l-4.03-5.65L6.9 21H4l6.08-6.98L4.1 3Zm4.3 1.86H7.02l8.83 14.28h1.38L8.4 4.86Z" /></svg>
}

function LinkIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.6 13.4a4 4 0 0 0 5.66.01l2.12-2.12a4 4 0 0 0-5.66-5.66l-1.22 1.22" /><path d="M13.4 10.6a4 4 0 0 0-5.66-.01l-2.12 2.12a4 4 0 0 0 5.66 5.66l1.22-1.22" /></svg>
}

function ShareIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 12v7h14v-7" /></svg>
}

function ShareSheet({ lang, telegramShareUrl, whatsappUrl, facebookUrl, xUrl, shared, onCopy, onNativeShare, onTrackShare, onClose, telegramText, telegramMediaText }: ShareSheetProps) {
  const title = lang === 'ru' ? 'Поделиться объявлением' : 'E’lonni ulashish'
  const description = lang === 'ru' ? 'E’lonni Telegram yoki boshqa ilova orqali yuboring.' : 'E’lonni do‘stlaringizga yuboring yoki boshqa ilovani tanlang.'
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
          <a href={telegramShareUrl} target="_blank" rel="noreferrer" onClick={openExternal} className="col-span-2 flex items-center gap-4 rounded-2xl bg-sky-500 px-5 py-4 text-white shadow-sm transition hover:bg-sky-600 active:scale-[.99]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15" aria-hidden="true"><TelegramIcon className="h-7 w-7" /></span>
            <span className="min-w-0 flex-1"><span className="block text-base font-black">{telegramText}</span><span className="mt-0.5 block text-xs text-white/90">{telegramMediaText}</span></span>
            <span className="text-2xl leading-none" aria-hidden="true">›</span>
          </a>

          <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={openExternal} className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 font-extrabold text-emerald-700 hover:bg-emerald-100"><WhatsAppIcon className="h-6 w-6" /><span>WhatsApp</span></a>
          <a href={facebookUrl} target="_blank" rel="noreferrer" onClick={openExternal} className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 font-extrabold text-blue-700 hover:bg-blue-100"><FacebookIcon className="h-6 w-6" /><span>Facebook</span></a>
          <a href={xUrl} target="_blank" rel="noreferrer" onClick={openExternal} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-extrabold text-slate-900 hover:bg-slate-100"><XIcon className="h-6 w-6" /><span>X</span></a>
          <button type="button" onClick={onCopy} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-extrabold text-slate-700 hover:bg-slate-50"><LinkIcon className="h-6 w-6" /><span>{shared ? (lang === 'ru' ? 'Скопировано' : 'Nusxalandi') : copy}</span></button>
          <button type="button" onClick={onNativeShare} className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 font-extrabold text-white hover:bg-slate-800"><ShareIcon className="h-5 w-5" />{other}</button>
        </div>
      </div>
    </div>
  )
}
