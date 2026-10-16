'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PwaInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone) return
    if (localStorage.getItem('royalhouse-pwa-install-dismissed') === '1') return

    const handleBeforeInstall = (nextEvent: Event) => {
      nextEvent.preventDefault()
      setEvent(nextEvent as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  if (!visible || !event) return null

  const install = async () => {
    await event.prompt()
    await event.userChoice
    setVisible(false)
    setEvent(null)
  }

  const dismiss = () => {
    localStorage.setItem('royalhouse-pwa-install-dismissed', '1')
    setVisible(false)
    setEvent(null)
  }

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-[100] mx-auto max-w-md rounded-2xl border border-black/10 bg-white p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <img src="/royalhouse-icon.svg" alt="Royalhouse" className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">Royalhouse ilovasini o‘rnating</p>
          <p className="mt-1 text-sm leading-5 text-gray-500">Uylarni tezroq toping va saqlangan e’lonlaringizga tez kiring.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={install} className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white">
              O‘rnatish
            </button>
            <button type="button" onClick={dismiss} className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600">
              Keyinroq
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
