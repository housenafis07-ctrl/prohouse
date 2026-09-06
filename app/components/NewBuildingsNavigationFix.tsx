'use client'

import { useEffect } from 'react'

export default function NewBuildingsNavigationFix() {
  useEffect(() => {
    let overlay: HTMLDivElement | null = null

    const isRussian = () => {
      const text = document.body?.innerText || ''
      return text.includes('Новостройки') || text.includes('Купить') || text.includes('Риелторы')
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
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.58);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;padding:48px 20px 30px;overflow-y:auto;'
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
      title.textContent = ru ? 'Новостройки' : 'Yangi uylar'
      title.style.cssText = 'margin:0 0 26px;font-size:28px;line-height:1.2;font-weight:900;color:#0f172a;'

      const grid = document.createElement('div')
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:stretch;'

      const cards = ru
        ? [
            ['🏗️','Жилые комплексы','Новые жилые комплексы и дома от застройщиков','/listings?tab=sale&type=new_building'],
            ['🏷️','Скидки и акции на новостройки','Выгодные предложения от застройщиков','/listings?tab=sale&type=new_building&promotion=true'],
            ['🏢','Квартиры в новостройках','Квартиры в новых домах по всему Узбекистану','/listings?tab=sale&type=new_building'],
          ]
        : [
            ['🏗️','Yangi uy-joy majmualari','Quruvchilardan yangi turar joy majmualari va uylar','/listings?tab=sale&type=new_building'],
            ['🏷️','Yangi uylar chegirmalari','Quruvchilarning foydali chegirmalari va aksiyalari','/listings?tab=sale&type=new_building&promotion=true'],
            ['🏢','Yangi uylardagi kvartiralar','O‘zbekiston bo‘ylab yangi uylardagi xonadonlar','/listings?tab=sale&type=new_building'],
          ]

      cards.forEach(([icon, name, sub, href]) => {
        const card = document.createElement('button')
        card.type = 'button'
        card.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;min-height:190px;padding:24px;border:1px solid #dbe3ea;border-radius:12px;background:#fff;text-align:left;color:#0f172a;cursor:pointer;box-sizing:border-box;transition:.15s;'
        card.onmouseenter = () => { card.style.borderColor = '#10b981'; card.style.background = '#f8fffb'; card.style.transform = 'translateY(-1px)' }
        card.onmouseleave = () => { card.style.borderColor = '#dbe3ea'; card.style.background = '#fff'; card.style.transform = 'translateY(0)' }
        card.onclick = () => go(href)

        const iconEl = document.createElement('span')
        iconEl.textContent = icon
        iconEl.style.cssText = 'display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;background:#ecfdf5;font-size:26px;flex:none;margin-bottom:20px;'

        const nameEl = document.createElement('strong')
        nameEl.textContent = name
        nameEl.style.cssText = 'display:block;font-size:16px;font-weight:900;line-height:1.3;'

        const subEl = document.createElement('span')
        subEl.textContent = sub
        subEl.style.cssText = 'display:block;margin-top:7px;color:#64748b;font-size:13px;line-height:1.5;'

        card.appendChild(iconEl)
        card.appendChild(nameEl)
        card.appendChild(subEl)
        grid.appendChild(card)
      })

      const promo = document.createElement('div')
      promo.style.cssText = 'grid-column:span 3;position:relative;min-height:190px;overflow:hidden;border-radius:12px;background:#f1f7f9;box-sizing:border-box;padding:28px 310px 28px 28px;'

      const promoImage = document.createElement('div')
      promoImage.style.cssText = 'position:absolute;right:0;top:0;bottom:0;width:38%;background-image:linear-gradient(90deg,#f1f7f9 0%,rgba(241,247,249,.35) 25%,rgba(241,247,249,0) 55%),url(https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=900&q=85);background-size:cover;background-position:center;'

      const badge = document.createElement('span')
      badge.textContent = ru ? 'Prohouse' : 'Prohouse'
      badge.style.cssText = 'display:inline-flex;padding:7px 11px;border-radius:999px;background:#dcfce7;color:#059669;font-size:11px;font-weight:900;margin-bottom:12px;'

      const promoTitle = document.createElement('strong')
      promoTitle.textContent = ru ? 'Ипотека на новостройки' : 'Yangi uylar uchun ipoteka'
      promoTitle.style.cssText = 'display:block;max-width:520px;font-size:22px;line-height:1.2;font-weight:900;color:#0f172a;'

      const promoText = document.createElement('p')
      promoText.textContent = ru
        ? 'Выберите подходящую новостройку и рассчитайте комфортный платёж по ипотеке.'
        : 'O‘zingizga mos yangi uyni tanlang va ipoteka to‘lovini hisoblang.'
      promoText.style.cssText = 'margin:10px 0 18px;max-width:480px;color:#64748b;font-size:13px;line-height:1.5;'

      const promoButton = document.createElement('button')
      promoButton.type = 'button'
      promoButton.textContent = ru ? 'Смотреть новостройки' : 'Yangi uylarni ko‘rish'
      promoButton.style.cssText = 'border:0;border-radius:8px;background:#059669;color:#fff;padding:11px 17px;font-size:13px;font-weight:900;cursor:pointer;'
      promoButton.onclick = () => go('/listings?tab=sale&type=new_building&mortgage=true')

      promo.appendChild(promoImage)
      promo.appendChild(badge)
      promo.appendChild(promoTitle)
      promo.appendChild(promoText)
      promo.appendChild(promoButton)
      grid.appendChild(promo)

      const note = document.createElement('div')
      note.textContent = ru
        ? 'Раздел ориентирован на рынок новостроек Узбекистана.'
        : 'Ushbu bo‘lim O‘zbekiston yangi uylar bozori uchun moslashtirilgan.'
      note.style.cssText = 'margin-top:20px;padding:14px 16px;border-radius:12px;background:#f8fafc;color:#64748b;font-size:13px;line-height:1.4;'

      modal.appendChild(closeButton)
      modal.appendChild(title)
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
      if (text === 'Yangi uylar' || text === 'Новостройки') {
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
