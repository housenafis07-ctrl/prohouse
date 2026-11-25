'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/app/components/I18nProvider'

const PREF = 'royalhouse-alerts-enabled'

function decodeVapidKey(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  const raw = window.atob(padded)
  return Uint8Array.from(raw, char => char.charCodeAt(0))
}

export default function SavedSearchAlertControls() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    setEnabled(localStorage.getItem(PREF) === '1')
  }, [])

  const enable = async () => {
    setBusy(true)
    setStatus('')
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setStatus(ru ? 'Браузер не поддерживает push-уведомления.' : 'Brauzer push-xabarnomalarni qo‘llab-quvvatlamaydi.')
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(ru ? 'Разрешение на уведомления не предоставлено.' : 'Bildirishnomalarga ruxsat berilmadi.')
        return
      }

      const registration = await navigator.serviceWorker.register('/royalhouse-sw.js', { scope: '/' })
      const keyResponse = await fetch('/api/push/vapid-public-key', { cache: 'no-store' })
      if (!keyResponse.ok) throw new Error(ru ? 'Push-сервис пока не настроен.' : 'Push xizmati hozircha sozlanmagan.')
      const keyData = await keyResponse.json()
      if (!keyData.publicKey) throw new Error('VAPID public key is missing')

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(String(keyData.publicKey)),
        })
      }

      const saveResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!saveResponse.ok) {
        const result = await saveResponse.json().catch(() => null)
        throw new Error(result?.error || 'Push subscription could not be saved')
      }

      localStorage.setItem(PREF, '1')
      setEnabled(true)
      setStatus(ru
        ? 'Push включён. Telegram также будет получать уведомления, если бот привязан к аккаунту.'
        : 'Push yoqildi. Telegram bot akkauntingizga bog‘langan bo‘lsa, xabarlar u yerga ham yuboriladi.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : (ru ? 'Не удалось включить уведомления.' : 'Bildirishnomalarni yoqib bo‘lmadi.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <b className="text-sm">{enabled
          ? (ru ? '🔔 Push-уведомления включены' : '🔔 Push-xabarnomalar yoqilgan')
          : (ru ? '🔔 Уведомления о новых объектах' : '🔔 Yangi mos e’lonlar haqida xabar')}</b>
        <p className="mt-1 text-xs text-slate-600">{ru
          ? 'Новые объявления по сохранённым поискам будут приходить push-сообщением. Если Telegram-бот привязан к аккаунту, уведомление придёт и туда.'
          : 'Saqlangan qidiruvga mos yangi e’lonlar push orqali yuboriladi. Telegram bot akkauntingizga bog‘langan bo‘lsa, xabar Telegram’ga ham boradi.'}</p>
        {status && <p className="mt-1 text-xs font-bold text-emerald-700">{status}</p>}
      </div>
      {!enabled && <button type="button" disabled={busy} onClick={() => void enable()} className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
        {busy ? '...' : ru ? 'Включить уведомления' : 'Xabarnomani yoqish'}
      </button>}
    </div>
  )
}
