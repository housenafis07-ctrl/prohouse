'use client'

import { useEffect } from 'react'

const mortgageIcons = [
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 30 32 12l22 18v22H10z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M24 52V37h16v15M18 31h28" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="47" cy="16" r="9" fill="currentColor"/><path d="M43 16h8M47 12v8" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="8" width="36" height="48" rx="7" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M22 17h20M22 25h20M22 35h6m4 0h4m4 0h4M22 43h6m4 0h4m4 0h4M22 51h6m4 0h4" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="9" width="40" height="46" rx="5" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M21 21h22M21 30h22M21 39h10M21 48h17" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="45" cy="47" r="10" fill="currentColor"/><path d="M40 47h10" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 45h48M14 38h10V18h10v20h10v-9h10v16H14z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><circle cx="19" cy="14" r="7" fill="currentColor"/><path d="M19 10v8M15 14h8" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M9 53h46M14 53V28l18-16 18 16v25" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M25 53V38h14v15M8 28h48" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="m43 14 5 5-10 10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 10h40v44H12z" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M21 21h22M21 30h22M21 39h10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="43" cy="44" r="9" fill="currentColor"/><path d="M39 44h8M43 40v8" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 53h44M16 53V31l16-15 16 15v22" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M26 53V40h12v13" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="47" cy="17" r="9" fill="currentColor"/><path d="M47 12v10M42 17h10" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>',
  '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M19 19a19 19 0 0 1 31 8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="m48 17 3 10-11-1" fill="currentColor"/><path d="M45 45a19 19 0 0 1-31-8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="m16 47-3-10 11 1" fill="currentColor"/></svg>',
]

function polishMortgageIcons() {
  const dialog = document.querySelector('[role="dialog"][aria-label]')
  if (!dialog) return
  const cards = Array.from(dialog.querySelectorAll(':scope .grid > a'))
  cards.slice(0, mortgageIcons.length).forEach((card, index) => {
    const icon = card.querySelector(':scope > div:first-child') as HTMLElement | null
    if (!icon) return
    icon.innerHTML = mortgageIcons[index]
    icon.style.color = '#059669'
    icon.style.background = 'linear-gradient(135deg,#ecfdf5,#eff6ff)'
    icon.style.border = '1px solid #d1fae5'
    icon.style.boxShadow = '0 8px 22px rgba(15,23,42,.08)'
    const svg = icon.querySelector('svg') as SVGElement | null
    if (svg) {
      svg.style.width = '34px'
      svg.style.height = '34px'
    }
  })
}

export default function HomeBuildingNavigationFix() {
  useEffect(() => {
    const polish = () => {
      const section = document.getElementById('home-building')
      if (section) section.style.display = 'none'
      polishMortgageIcons()
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a[href="#home-building"]') as HTMLAnchorElement | null
      if (!anchor) return
      event.preventDefault()
      window.location.assign('/uy-qurish')
    }

    document.addEventListener('click', handleClick)
    polish()
    const observer = new MutationObserver(polish)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      document.removeEventListener('click', handleClick)
      observer.disconnect()
    }
  }, [])

  return null
}
