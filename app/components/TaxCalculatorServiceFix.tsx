'use client'

import { useEffect } from 'react'

export default function TaxCalculatorServiceFix() {
  useEffect(() => {
    const addTaxCalculator = () => {
      const overlay = document.querySelector('.prohouse-services-overlay')
      if (!overlay) return

      const activeTab = overlay.querySelector('.prohouse-services-tab.active')?.textContent?.toLowerCase() || ''
      const isInteractive = activeTab.includes('interaktiv') || activeTab.includes('интерактив')
      if (!isInteractive) return

      const grid = overlay.querySelector('.prohouse-services-grid')
      if (!grid || grid.querySelector('[data-royalhouse-tax-calculator="true"]')) return

      const card = document.createElement('a')
      card.href = 'https://my.soliq.uz/remotes-services/tax-calculator/'
      card.target = '_blank'
      card.rel = 'noopener noreferrer'
      card.className = 'prohouse-service-card'
      card.dataset.royalhouseTaxCalculator = 'true'

      const icon = document.createElement('span')
      icon.className = 'prohouse-service-icon'
      icon.textContent = '🧮'

      const content = document.createElement('span')
      content.className = 'prohouse-service-content'

      const name = document.createElement('span')
      name.className = 'prohouse-service-name'
      const ru = window.localStorage.getItem('royalhouse-lang') === 'ru'
      name.textContent = ru ? 'Налоговый калькулятор' : 'Soliq kalkulyatori'

      const sub = document.createElement('span')
      sub.className = 'prohouse-service-sub'
      sub.textContent = ru
        ? 'Онлайн-расчёт налогов на официальном сервисе Soliq'
        : 'Soliq bo‘yicha hisob-kitoblarni rasmiy xizmatda amalga oshiring'

      const arrow = document.createElement('span')
      arrow.className = 'prohouse-service-arrow'
      arrow.textContent = '›'

      content.append(name, sub)
      card.append(icon, content, arrow)
      grid.appendChild(card)
    }

    const observer = new MutationObserver(addTaxCalculator)
    observer.observe(document.body, { childList: true, subtree: true })
    addTaxCalculator()

    return () => observer.disconnect()
  }, [])

  return null
}
