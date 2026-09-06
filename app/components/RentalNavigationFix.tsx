'use client'

import { useEffect } from 'react'

export default function RentalNavigationFix() {
  useEffect(() => {
    const close = () => {
      document.querySelector('.prohouse-rental-overlay')?.remove()
      document.body.style.overflow = ''
    }

    const open = (isRussian: boolean) => {
      if (document.querySelector('.prohouse-rental-overlay')) return

      const overlay = document.createElement('div')
      overlay.className = 'prohouse-rental-overlay'
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.58);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;padding:84px 20px 30px;overflow-y:auto;'
      overlay.addEventListener('click', close)

      const modal = document.createElement('div')
      modal.style.cssText = 'position:relative;width:min(1180px,100%);background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:32px;box-sizing:border-box;'
      modal.addEventListener('click', (event) => event.stopPropagation())

      const title = document.createElement('h2')
      title.textContent = isRussian ? 'Аренда' : 'Ijara'
      title.style.cssText = 'margin:0 0 8px;font-size:30px;line-height:1.2;font-weight:900;color:#0f172a;'

      const subtitle = document.createElement('p')
      subtitle.textContent = isRussian ? 'Выберите подходящий вариант аренды' : 'O‘zingizga mos ijara turini tanlang'
      subtitle.style.cssText = 'margin:0 0 26px;color:#64748b;font-size:14px;line-height:1.5;'

      const closeButton = document.createElement('button')
      closeButton.type = 'button'
      closeButton.textContent = '×'
      closeButton.setAttribute('aria-label', isRussian ? 'Закрыть' : 'Yopish')
      closeButton.style.cssText = 'position:absolute;right:14px;top:10px;border:0;background:transparent;color:#94a3b8;font-size:32px;line-height:1;cursor:pointer;padding:6px 10px;'
      closeButton.onclick = close

      const grid = document.createElement('div')
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;'

      const cards = isRussian
        ? [
            ['🏢','Снять долгосрочно','Квартиры и дома на длительный срок','/listings?tab=rent'],
            ['🗓️','Снять посуточно','Жильё на сутки и короткий срок','/listings?tab=daily'],
            ['🏬','Коммерческая недвижимость','Офисы, магазины и другие объекты','/listings?tab=rent&type=commercial'],
            ['🏡','Дачы','Дачи и загородные дома для отдыха','/listings?tab=rent&type=house'],
          ]
        : [
            ['🏢','Uzoq muddatga ijaraga','Kvartira va uylarni uzoq muddatga ijaraga oling','/listings?tab=rent'],
            ['🗓️','Kunlik ijaraga','Kunlik va qisqa muddatli ijara takliflari','/listings?tab=daily'],
            ['🏬','Tijorat ko‘chmas mulki','Ofis, do‘kon va boshqa tijorat obyektlari','/listings?tab=rent&type=commercial'],
            ['🏡','Dacha','Dam olish uchun uylar va hovlilar','/listings?tab=rent&type=house'],
          ]

      cards.forEach(([icon, name, sub, href]) => {
        const card = document.createElement('a')
        card.href = href
        card.style.cssText = 'display:flex;align-items:center;gap:16px;min-height:126px;padding:20px;border:1px solid #dbe3ea;border-radius:12px;background:#fff;text-align:left;text-decoration:none;color:#0f172a;cursor:pointer;box-sizing:border-box;transition:.15s;'
        card.onmouseenter = () => { card.style.borderColor = '#10b981'; card.style.background = '#f8fffb'; card.style.transform = 'translateY(-1px)' }
        card.onmouseleave = () => { card.style.borderColor = '#dbe3ea'; card.style.background = '#fff'; card.style.transform = 'translateY(0)' }

        const iconEl = document.createElement('span')
        iconEl.textContent = icon
        iconEl.style.cssText = 'display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:#ecfdf5;font-size:27px;flex:none;'

        const copy = document.createElement('span')
        const nameEl = document.createElement('strong')
        nameEl.textContent = name
        nameEl.style.cssText = 'display:block;font-size:16px;font-weight:900;line-height:1.3;'
        const subEl = document.createElement('span')
        subEl.textContent = sub
        subEl.style.cssText = 'display:block;margin-top:6px;color:#64748b;font-size:13px;line-height:1.4;'
        copy.appendChild(nameEl)
        copy.appendChild(subEl)
        card.appendChild(iconEl)
        card.appendChild(copy)
        grid.appendChild(card)
      })

      modal.appendChild(closeButton)
      modal.appendChild(title)
      modal.appendChild(subtitle)
      modal.appendChild(grid)
      overlay.appendChild(modal)
      document.body.appendChild(overlay)
      document.body.style.overflow = 'hidden'
    }

    const onClick = (event: MouseEvent) => {
      if (window.location.pathname !== '/') return
      const target = event.target as HTMLElement | null
      const link = target?.closest('a') as HTMLAnchorElement | null
      if (!link) return
      const label = link.textContent?.trim() || ''
      const isRental = label === 'Ijara' || label === 'Аренда'
      if (!isRental || !link.href.includes('tab=rent')) return

      event.preventDefault()
      event.stopPropagation()
      open(label === 'Аренда')
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
