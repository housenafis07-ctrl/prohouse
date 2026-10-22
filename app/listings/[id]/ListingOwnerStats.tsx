'use client'

import { useEffect, useState } from 'react'

interface Stats {
  views: number
  uniqueViews: number
  todayViews: number
  shares: number
  phoneClicks: number
  chatStarts: number
}

export default function ListingOwnerStats({ listingId }: { listingId: string }) {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/listings/events?listingId=${encodeURIComponent(listingId)}&stats=1`)
      .then(async response => response.ok ? response.json() : null)
      .then(data => { if (!cancelled && data) setStats(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [listingId])

  if (!stats) return null

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">E’lon statistikasi</h2>
          <p className="mt-1 text-xs text-slate-500">Foydalanuvchilar e’loningiz bilan qanday tanishayotganini ko‘ring.</p>
        </div>
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
