'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

export default function PushRegistration() {
  useEffect(() => {
    let cancelled = false
    const setup = async () => {
      if (cancelled || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || Notification.permission === 'denied') return

      const keyResponse = await fetch('/api/push/vapid-public-key', { cache: 'no-store' })
      if (!keyResponse.ok) return
      const { publicKey } = await keyResponse.json()
      if (!publicKey || cancelled) return

      const registration = await navigator.serviceWorker.register('/sw.js')
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted' || cancelled) return
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
      }

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
    }
    void setup().catch(() => {})
    return () => { cancelled = true }
  }, [])

  return null
}
