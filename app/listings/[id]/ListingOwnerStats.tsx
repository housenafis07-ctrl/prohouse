'use client'

import { useEffect, useState } from 'react'

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
  initialStats,
}: {
  listingId: string
  initialStats?: ListingOwnerStatsData | null
}) {
  const [stats, setStats] = useState<ListingOwnerStatsData | null>(initialStats ?? null)
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')

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

  const shareListing = async () => {
    const url = window.location.href
    const title = document.title

    try {
      if (navigator.share) {
        await navigator.share({ title, url })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        setShareState('copied')
        window.setTimeout(() => setShareState('idle'), 1800)
      } else {
        const input = document.createElement('input')
        input.value = url
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
        setShareState('copied')
        window.setTimeout(() => setShareState('idle'), 1800)
      }

      void fetch('/api/listings/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, action: 'share' }),
        keepalive: true,
      }).catch(() => {})

      setStats(current => current ? { ...current, shares: current.shares + 1 } : current)
    } catch {
      // The native share sheet can be dismissed by the user; do not show an error.
    }
  }

  if (!stats) return null

  return (
    <section className="mx-auto mt-5 w-full max-w-[1200px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">E’lon statistikasi</h2>
          <p className="mt-1 text-xs text-slate-500">Foydalanuvchilar e’loningiz bilan qanday tanishayotganini ko‘ring.</p>
        </div>
        <button
          type="button"
          onClick={shareListing}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-extrabold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 active:scale-[.98]"
        >
          <span aria-hidden="true">↗</span>
          {shareState === 'copied' ? 'Havola nusxalandi' : 'Ulashish'}
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
