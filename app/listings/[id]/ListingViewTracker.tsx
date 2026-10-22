'use client'

import { useEffect } from 'react'

function getSessionId() {
  const key = 'royalhouse-session-id'
  try {
    const existing = window.localStorage.getItem(key)
    if (existing) return existing
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(key, id)
    return id
  } catch {
    return null
  }
}

export default function ListingViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    const sessionId = getSessionId()
    if (!sessionId) return

    void fetch('/api/listings/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, action: 'view', sessionId }),
      keepalive: true,
    }).catch(() => {})
  }, [listingId])

  return null
}
