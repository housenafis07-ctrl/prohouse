'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import GlobalNavigationFix from './GlobalNavigationFix'

export default function GlobalNavigationGate() {
  const pathname = usePathname()

  useEffect(() => {
    // E’lon joylashtirish wizardida global "Xizmatlar" click-interceptor
    // ishlamasligi kerak. Aks holda property listing oqimida xizmatlar
    // modaliga noto‘g‘ri tushib qolish mumkin.
    if (pathname.startsWith('/listings/new')) return

    // React/Next Link clicklari document bubble bosqichiga yetmasdan route'ni
    // o'zgartirishi mumkin. Shu sababli Xizmatlar navigatsiyasini capture
    // bosqichida to'xtatamiz va GlobalNavigationFix'ning mavjud handleriga
    // React Link'siz, vaqtinchalik oddiy <a> orqali click yuboramiz.
    let replaying = false

    const handleServicesCapture = (event: MouseEvent) => {
      if (replaying) return

      const target = event.target as HTMLElement | null
      const link = target?.closest('a') as HTMLAnchorElement | null
      if (!link) return

      const text = link.textContent?.trim() || ''
      if (text !== 'Xizmatlar' && text !== 'Услуги') return

      event.preventDefault()
      event.stopImmediatePropagation()

      const relay = document.createElement('a')
      relay.href = '#services'
      relay.textContent = text
      relay.style.display = 'none'
      document.body.appendChild(relay)

      replaying = true
      relay.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }))
      replaying = false
      relay.remove()
    }

    document.addEventListener('click', handleServicesCapture, true)
    return () => document.removeEventListener('click', handleServicesCapture, true)
  }, [pathname])

  // Account sahifasining "Keyingi qadamlar" blokini GlobalNavigationFix
  // DOM orqali o'zgartirmasligi kerak. Account sahifasi o'z navigatsiyasini
  // o'zi boshqaradi; shu sababli global DOM-fix bu route'da ishlamaydi.
  if (pathname === '/account') return null

  return <GlobalNavigationFix />
}
