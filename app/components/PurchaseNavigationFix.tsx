'use client'

import { useEffect } from 'react'

export default function PurchaseNavigationFix() {
  useEffect(() => {
    let overlay: HTMLDivElement | null = null

    const isRussian = () => {
      const text = document.body?.innerText || ''
      return text.includes('Купить') || text.includes('Недвижимость') || text.includes('Найдите дом мечты')
    }

    const close = () => {
      overlay?.remove()
      overlay = null
      document.body.style.overflow = ''
    }

    const go = (href: string) => {
      close()
      window.location.assign(href)
    }

    const open = () => {
      if (overlay) return
      const ru = isRussian()

      overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.58);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;padding:84px 20px 30px;overflow-y:auto;'
      overlay.addEventListener('click', close)

      const modal = document.createElement('div')
      modal.style.cssText = 'position:relative;width:min(1180px,100%);background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:32px;box-sizing:border-box;'
      modal.addEventListener('click', (e) => e.stopPropagation())

      const closeButton = document.createElement('button')
      closeButton.type = 'button'
      closeButton.textContent = '×'
      closeButton.setAttribute('aria-label', ru ? 'Закрыть' : 'Yopish')
      closeButton.style.cssText = 'position:absolute;right:14px;top:10px;width:38px;height:38px;border:0;border-radius:50%;background:#f1f5f9;color:#64748b;font-size:28px;line-height:1;cursor:pointer;'
      closeButton.onclick = close

      const title = document.createElement('h2')
      title.textContent = ru ? 'Покупка' : 'Sotib olish'
      title.style.cssText = 'margin:0 0 26px;font-size:28px;line-height:1.2;font-weight:900;color:#0f172a;'

      const subtitle = document.createElement('p')
      subtitle.textContent = ru ? 'Найдите недвижимость в Узбекистане' : 'O‘zbekistonda o‘zingizga mos ko‘chmas mulkni toping'
      subtitle.style.cssText = 'margin:-14px 0 24px;color:#64748b;font-size:14px;'

      const grid = document.createElement('div')
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;'

      const cards = ru
        ? [
            ['🏢','Квартиры','На вторичном рынке','/listings?tab=sale&type=apartment'],
            ['🏗️','Новостройки','Квартиры от застройщиков','/listings?tab=sale&type=new_building'],
            ['🏠','Дома','Частные дома и коттеджи','/listings?tab=sale&type=house'],
            ['🌿','Дачи','Дачи и загородные дома','/listings?tab=sale&type=house&country_house=true'],
            ['🏦','Ипотека','Недвижимость для покупки в ипотеку','/listings?tab=sale&mortgage=true'],
            ['🌳','Земельные участки','Участки под дом и строительство','/listings?tab=sale&type=land'],
            ['🏢','Коммерческая недвижимость','Офисы, магазины и другие объекты','/listings?tab=sale&type=commercial'],
            ['📈','Для инвестиций','Объекты с инвестиционным потенциалом','/listings?tab=sale&investment=true'],
          ]
        : [
            ['🏢','Kvartiralar','Ikkilamchi bozordagi kvartiralar','/listings?tab=sale&type=apartment'],
            ['🏗️','Yangi uylar','Quruvchilardan yangi xonadonlar','/listings?tab=sale&type=new_building'],
            ['🏠','Xususiy uylar','Hovli uylar va kottejlar','/listings?tab=sale&type=house'],
            ['🌿','Dacha','Dacha va dala hovlilar','/listings?tab=sale&type=house&country_house=true'],
            ['🏦','Ipoteka uchun uylar','Ipoteka orqali sotib olish mumkin bo‘lgan uylar','/listings?tab=sale&mortgage=true'],
            ['🌳','Yer uchastkalari','Uy qurish va boshqa maqsadlar uchun yerlar','/listings?tab=sale&type=land'],
            ['🏢','Tijorat ko‘chmas mulki','Ofis, do‘kon va boshqa tijorat obyektlari','/listings?tab=sale&type=commercial'],
            ['📈','Investitsiya uchun','Daromad olish imkoniyati yuqori obyektlar','/listings?tab=sale&investment=true'],
          ]

      cards.forEach(([icon, name, sub, href]) => {
        const card = document.createElement('button')
        card.type = 'button'
        card.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;min-height:148px;padding:20px;border:1px solid #dbe3ea;border-radius:12px;background:#fff;text-align:left;color:#0f172a;cursor:pointer;box-sizing:border-box;transition:.15s;'
        card.onmouseenter = () => { card.style.borderColor = '#10b981'; card.style.background = '#f8fffb'; card.style.transform = 'translateY(-1px)' }
        card.onmouseleave = () => { card.style.borderColor = '#dbe3ea'; card.style.background = '#fff'; card.style.transform = 'translateY(0)' }
        card.onclick = () => go(href)

        const iconEl = document.createElement('span')
        iconEl.textContent = icon
        iconEl.style.cssText = 'display:flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:50%;background:#ecfdf5;font-size:25px;flex:none;margin-bottom:15px;'

        const nameEl = document.createElement('strong')
        nameEl.textContent = name
        nameEl.style.cssText = 'display:block;font-size:15px;font-weight:900;line-height:1.3;'

        const subEl = document.createElement('span')
        subEl.textContent = sub
        subEl.style.cssText = 'display:block;margin-top:6px;color:#64748b;font-size:12px;line-height:1.4;'

        card.appendChild(iconEl)
        card.appendChild(nameEl)
        card.appendChild(subEl)
        grid.appendChild(card)
      })

      const note = document.createElement('div')
      note.textContent = ru
        ? 'Все разделы ориентированы на рынок недвижимости Узбекистана.'
        : 'Barcha bo‘limlar O‘zbekiston ko‘chmas mulk bozori uchun moslashtirilgan.'
      note.style.cssText = 'margin-top:20px;padding:14px 16px;border-radius:12px;background:#f8fafc;color:#64748b;font-size:13px;line-height:1.4;'

      modal.appendChild(closeButton)
      modal.appendChild(title)
      modal.appendChild(subtitle)
      modal.appendChild(grid)
      modal.appendChild(note)
      overlay.appendChild(modal)
      document.body.appendChild(overlay)
      document.body.style.overflow = 'hidden'
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const link = target?.closest('a') as HTMLAnchorElement | null
      if (!link) return
      const text = link.textContent?.trim() || ''
      if (text === 'Sotib olish' || text === 'Купить') {
        event.preventDefault()
        event.stopPropagation()
        open()
      }
    }

    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      close()
    }
  }, [])

  return null
}
