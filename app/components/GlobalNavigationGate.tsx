'use client'

import { usePathname } from 'next/navigation'
import GlobalNavigationFix from './GlobalNavigationFix'

export default function GlobalNavigationGate() {
  const pathname = usePathname()

  // Account sahifasining "Keyingi qadamlar" blokini GlobalNavigationFix
  // DOM orqali o'zgartirmasligi kerak. Account sahifasi o'z navigatsiyasini
  // o'zi boshqaradi; shu sababli global DOM-fix bu route'da ishlamaydi.
  if (pathname === '/account') return null

  return <GlobalNavigationFix />
}
