'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import GlobalNavigationFix from './GlobalNavigationFix'

export default function GlobalNavigationGate() {
  const pathname = usePathname()

  // Account sahifasining "Keyingi qadamlar" blokini GlobalNavigationFix
  // DOM orqali o'zgartirmasligi kerak. Account sahifasi o'z navigatsiyasini
  // o'zi boshqaradi; shu sababli global DOM-fix bu route'da ishlamaydi.
  if (pathname === '/account') return null

  useEffect(() => {
    const goHomeAfterServicesClose = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      const closeButton = target.closest('.prohouse-services-close')
      const clickedOverlay = target.classList.contains('prohouse-services-overlay')

      if (closeButton || clickedOverlay) {
        window.location.assign('/')
      }
    }

    document.addEventListener('click', goHomeAfterServicesClose)
    return () => document.removeEventListener('click', goHomeAfterServicesClose)
  }, [])

  return <GlobalNavigationFix />
}
