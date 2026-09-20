'use client'

import { useState } from 'react'

export default function MobileListingActions({
  listingId,
  onCall,
  onChat,
}: {
  listingId: string
  onCall: () => void
  onChat: () => void
}) {
  const [busy, setBusy] = useState(false)

  const run = async (action: () => void) => {
    if (busy) return
    setBusy(true)
    try {
      action()
    } finally {
      window.setTimeout(() => setBusy(false), 700)
    }
  }

  return (
    <div
      data-mobile-listing-actions
      data-listing-id={listingId}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur supports-[backdrop-filter]:bg-white/85 md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto grid max-w-xl grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(onCall)}
          className="min-h-12 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
          aria-label="Sotuvchiga qo‘ng‘iroq qilish"
        >
          ☎ Telefon
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(onChat)}
          className="min-h-12 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-900 transition active:scale-[0.98] disabled:opacity-60"
          aria-label="Sotuvchiga xabar yuborish"
        >
          💬 Chat
        </button>
      </div>
    </div>
  )
}
