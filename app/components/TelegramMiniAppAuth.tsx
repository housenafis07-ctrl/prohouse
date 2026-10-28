'use client'

import { useEffect } from 'react'

type TelegramWebApp = {
  ready: () => void
  expand: () => void
}

declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp } }
}

/**
 * Telegram WebApp is presentation/navigation only. It never creates,
 * authenticates, links, or upgrades a RoyalHouse account.
 */
export default function TelegramMiniAppAuth() {
  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return
    webApp.ready()
    webApp.expand()
  }, [])

  return null
}
