'use client'

import { useEffect } from 'react'

export default function MobileMainNavigation() {
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header || header.querySelector('.prohouse-mobile-main-nav')) return

    const style = document.createElement('style')
    style.textContent = `
      .prohouse-mobile-main-nav { display:none; }
      @media (max-width:1023px) {
        .prohouse-mobile-main-nav {
          display:flex;
          width:100%;
          box-sizing:border-box;
          overflow-x:auto;
          overscroll-behavior-x:contain;
          scrollbar-width:none;
          border-top:1px solid #eef2f5;
          background:#fff;
          padding:8px 12px 10px;
          gap:7px;
          -webkit-overflow-scrolling:touch;
        }
        .prohouse-mobile-main-nav::-webkit-scrollbar { display:none; }
        .prohouse-mobile-main-nav a,
        .prohouse-mobile-main-nav button {
          flex:0 0 auto;
          border:1px solid #e2e8f0;
          background:#fff;
          color:#0f172a;
          border-radius:999px;
          padding:9px 13px;
          font:700 13px/1.1 Arial,sans-serif;
          text-decoration:none;
          white-space:nowrap;
          cursor:pointer;
        }
        .prohouse-mobile-main-nav a:active,
        .prohouse-mobile-main-nav button:active { background:#ecfdf5; border-color:#10b981; color:#047857; }
      }
    `
    document.head.appendChild(style)

    const nav = document.createElement('nav')
    nav.className = 'prohouse-mobile-main-nav'
    nav.setAttribute('aria-label', 'Asosiy menyu')

    const isRussian = /Купить|Аренда|Новостройки|Ипотека/.test(document.body?.innerText || '')
    const items = [
      { label: isRussian ? 'Купить' : 'Sotib olish', href: '/listings?tab=sale' },
      { label: isRussian ? 'Аренда' : 'Ijara', href: '/listings?tab=rent' },
      { label: isRussian ? 'Новостройки' : 'Yangi uylar', href: '/listings?tab=sale&type=new_building' },
      { label: isRussian ? 'Построить дом' : 'Uy qurish', href: '/uy-qurish' },
      { label: isRussian ? 'Ипотека' : 'Ipoteka', actionText: isRussian ? 'Ипотека' : 'Ipoteka' },
      { label: isRussian ? 'Услуги' : 'Xizmatlar', actionText: isRussian ? 'Услуги' : 'Xizmatlar' },
      { label: isRussian ? 'Риелторы' : 'Rieltorlar', href: '/realtors' },
    ]

    items.forEach((item) => {
      if (item.href) {
        const link = document.createElement('a')
        link.href = item.href
        link.textContent = item.label
        nav.appendChild(link)
        return
      }

      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = item.label
      button.onclick = () => {
        const target = Array.from(document.querySelectorAll('button, a')).find((el) => {
          const text = el.textContent?.trim() || ''
          return text === item.actionText
        }) as HTMLElement | undefined
        target?.click()
      }
      nav.appendChild(button)
    })

    header.appendChild(nav)

    return () => {
      nav.remove()
      style.remove()
    }
  }, [])

  return null
}
