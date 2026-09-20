'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function MobileListingActions() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const listingId = params.id
  const [busy, setBusy] = useState<'call' | 'chat' | null>(null)
  const [phone, setPhone] = useState<string | null>(null)

  const contact = async (type: 'call' | 'chat') => {
    if (!listingId || busy) return
    if (type === 'call' && phone) {
      window.location.href = `tel:${phone}`
      return
    }

    setBusy(type)
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, leadType: type }),
      })
      const result = await response.json().catch(() => ({}))

      if (response.status === 401) {
        router.push(`/register?redirect=/listings/${listingId}`)
        return
      }
      if (!response.ok) throw new Error(result.error || 'Murojaatni yuborib bo‘lmadi.')

      if (type === 'call') {
        if (!result.phone) throw new Error('Sotuvchi telefon raqami kiritilmagan.')
        setPhone(result.phone)
        window.location.href = `tel:${result.phone}`
        return
      }

      if (result.conversationId) {
        router.push(`/chat?listingId=${listingId}&conversationId=${result.conversationId}`)
      }
    } catch {
      // The existing desktop contact panel remains the detailed error surface.
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div aria-hidden="true" className="h-24 md:hidden" />
      <div
        data-mobile-listing-actions
        data-listing-id={listingId}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur supports-[backdrop-filter]:bg-white/85 md:hidden"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void contact('call')}
            className="min-h-12 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
            aria-label="Sotuvchiga qo‘ng‘iroq qilish"
          >
            {busy === 'call' ? 'Yuklanmoqda…' : phone ? '☎ Qo‘ng‘iroq' : '☎ Telefon'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void contact('chat')}
            className="min-h-12 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-900 transition active:scale-[0.98] disabled:opacity-60"
            aria-label="Sotuvchiga xabar yuborish"
          >
            {busy === 'chat' ? 'Yuklanmoqda…' : '💬 Chat'}
          </button>
        </div>
      </div>
    </>
  )
}
