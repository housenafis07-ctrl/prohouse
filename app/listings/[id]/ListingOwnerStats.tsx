'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/app/components/I18nProvider'
import { ShareSheet } from './ListingConversionBar'

export interface ListingOwnerStatsData {
  views: number
  uniqueViews: number
  todayViews: number
  shares: number
  phoneClicks: number
  chatStarts: number
}

export default function ListingOwnerStats({
  listingId,
  title,
  priceLabel,
  initialStats,
}: {
  listingId: string
  title?: string
  priceLabel?: string
  initialStats?: ListingOwnerStatsData | null
}) {
  const { lang } = useI18n()
  const [stats, setStats] = useState<ListingOwnerStatsData | null>(initialStats ?? null)
  const [shared, setShared] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/listings/interactions?listingId=${encodeURIComponent(listingId)}&stats=1`, {
      cache: 'no-store',
    })
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (!cancelled && data) setStats(data)
      })
      .catch(() => {
        // Keep server-provided stats visible if the client refresh request fails.
      })
    return () => { cancelled = true }
  }, [listingId])

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/listings/${encodeURIComponent(listingId)}`
    : `/listings/${encodeURIComponent(listingId)}`
  const shareTitle = title || (typeof document !== 'undefined' ? document.title.replace(/\s*\|\s*Royalhouse\s*$/i, '') : 'RoyalHouse e’loni')
  const sharePrice = priceLabel || ''
  const shareText = sharePrice ? `${shareTitle} — ${sharePrice}` : shareTitle
  const encodedUrl = encodeURIComponent(publicUrl)
  const encodedText = encodeURIComponent(shareText)
  const telegramShareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${publicUrl}`)}`
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
      if (navigator.clipboard) await navigator.clipboard.writeText(publicUrl)
      else {
        const input = document.createElement('input')
        input.value = publicUrl
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
      }
      setShared(true)
      trackShare()
      setStats(current => current ? { ...current, shares: current.shares + 1 } : current)
      window.setTimeout(() => setShared(false), 1800)
    } catch {}
  }

  const openNativeShare = async () => {
    try {
      if (!navigator.share) return
      await navigator.share({ title: shareTitle, text: shareText, url: publicUrl })
      trackShare()
      setStats(current => current ? { ...current, shares: current.shares + 1 } : current)
      setShareOpen(false)
    } catch {}
  }

  const openExternal = () => {
    trackShare()
    setStats(current => current ? { ...current, shares: current.shares + 1 } : current)
    setShareOpen(false)
  }

  if (!stats) return null

  return (
    <>
      <section className="mx-auto mt-5 w-full max-w-[1200px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">E’lon statistikasi</h2>
            <p className="mt-1 text-xs text-slate-500">Foydalanuvchilar e’loningiz bilan qanday tanishayotganini ko‘ring.</p>
          </div>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-extrabold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 active:scale-[.98]"
          >
            <span aria-hidden="true">↗</span>
            Ulashish
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Jami ko‘rish" value={stats.views} icon="👁" />
          <Stat label="Noyob ko‘rish" value={stats.uniqueViews} icon="👤" />
          <Stat label="Bugun" value={stats.todayViews} icon="📈" />
          <Stat label="Ulashish" value={stats.shares} icon="↗" />
          <Stat label="Telefon" value={stats.phoneClicks} icon="☎" />
          <Stat label="Chat" value={stats.chatStarts} icon="💬" />
        </div>
      </section>

      {shareOpen && (
        <ShareSheet
          lang={lang}
          telegramShareUrl={telegramShareUrl}
          whatsappUrl={whatsappUrl}
          facebookUrl={facebookUrl}
          xUrl={xUrl}
          shared={shared}
          onCopy={copyLink}
          onNativeShare={openNativeShare}
          onTrackShare={openExternal}
          onClose={() => setShareOpen(false)}
          telegramText="Telegram orqali ulashish"
          telegramMediaText="Rasm va video bilan yuborish"
        />
      )}
    </>
  )
}

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center gap-1 text-xs text-slate-400"><span>{icon}</span>{label}</div>
      <b className="mt-1 block text-xl font-black text-slate-900">{value.toLocaleString('uz-UZ')}</b>
    </div>
  )
}
