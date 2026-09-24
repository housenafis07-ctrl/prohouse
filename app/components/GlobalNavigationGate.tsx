'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import GlobalNavigationFix from './GlobalNavigationFix'

export default function GlobalNavigationGate() {
  const pathname = usePathname()

  useEffect(() => {
    // Services havolasi ko‘pincha Next/React navigatsiyasi bilan birga
    // ishlaydi. GlobalNavigationFix esa click'ni document bubble bosqichida
    // ushlaydi; React Router undan oldin route'ni /listings ga almashtirib
    // yuborishi mumkin. Capture bosqichida original navigatsiyani to‘xtatib,
    // GlobalNavigationFix'ning mavjud handleriga sintetik click yuboramiz.
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

      replaying = true
      link.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }))
      replaying = false
    }

    document.addEventListener('click', handleServicesCapture, true)
    return () => document.removeEventListener('click', handleServicesCapture, true)
  }, [])

  // Account sahifasining "Keyingi qadamlar" blokini GlobalNavigationFix
  // DOM orqali o‘zgartirmasligi kerak. Account sahifasi o‘z navigatsiyasini
  // o‘zi boshqaradi; shu sababli global DOM-fix bu route’da ishlamaydi.
  if (pathname === '/account') return null

  return <GlobalNavigationFix />
}
