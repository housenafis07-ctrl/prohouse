'use client'

import { useEffect } from 'react'

const ICONS = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8v8.7a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-8.7Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9 21v-6h6v6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="m16 16 5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  create: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 3v15M15 6v15" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M4.5 20c.8-3.4 3.3-5 7.5-5s6.7 1.6 7.5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
} as const

export default function MobileMainNavigation() {
  useEffect(() => {
    const existing = document.querySelector('.prohouse-mobile-main-nav')
    if (existing) return

    const style = document.createElement('style')
    style.textContent = `
      .prohouse-mobile-category-nav { display:none; }
      .prohouse-mobile-main-nav { display:none; }
      @media (max-width:767px) {
        .prohouse-mobile-category-nav {
          display:flex;
          position:relative;
          z-index:900;
          width:100%;
          box-sizing:border-box;
          overflow-x:auto;
          overscroll-behavior-x:contain;
          -webkit-overflow-scrolling:touch;
          scrollbar-width:none;
          padding:8px 12px;
          gap:7px;
          border-bottom:1px solid #e2e8f0;
          background:rgba(255,255,255,.98);
          box-shadow:0 3px 12px rgba(15,23,42,.05);
        }
        .prohouse-mobile-category-nav::-webkit-scrollbar { display:none; }
        .prohouse-mobile-category-nav a {
          display:inline-flex;
          flex:0 0 auto;
          align-items:center;
          min-height:38px;
          padding:0 14px;
          border:1px solid #e2e8f0;
          border-radius:999px;
          background:#fff;
          color:#334155;
          font:700 12px/1 Arial,sans-serif;
          text-decoration:none;
          white-space:nowrap;
          -webkit-tap-highlight-color:transparent;
        }
        .prohouse-mobile-category-nav a:active { transform:scale(.98); }
        .prohouse-mobile-category-nav a.active {
          border-color:#10b981;
          background:#ecfdf5;
          color:#047857;
        }
        .prohouse-mobile-category-nav a.primary { background:#059669; border-color:#059669; color:#fff; }
        .prohouse-mobile-main-nav {
          position:fixed;
          left:0;
          right:0;
          bottom:0;
          z-index:1000;
          display:grid;
          grid-template-columns:repeat(5,minmax(0,1fr));
          align-items:end;
          width:100%;
          box-sizing:border-box;
          padding:7px 8px max(8px, env(safe-area-inset-bottom));
          border-top:1px solid #e2e8f0;
          background:rgba(255,255,255,.97);
          box-shadow:0 -8px 28px rgba(15,23,42,.10);
          backdrop-filter:blur(14px);
          -webkit-backdrop-filter:blur(14px);
        }
        .prohouse-mobile-main-nav a {
          display:flex;
          min-width:0;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:3px;
          min-height:52px;
          border:0;
          border-radius:14px;
          background:transparent;
          color:#64748b;
          font:700 10px/1.1 Arial,sans-serif;
          text-decoration:none;
          white-space:nowrap;
          -webkit-tap-highlight-color:transparent;
        }
        .prohouse-mobile-main-nav a svg { width:22px; height:22px; flex:0 0 auto; }
        .prohouse-mobile-main-nav a.active { color:#059669; background:#ecfdf5; }
        .prohouse-mobile-main-nav a.create {
          margin:-14px 3px 0;
          min-height:62px;
          border:1px solid #10b981;
          border-radius:18px;
          background:#059669;
          color:#fff;
          box-shadow:0 8px 18px rgba(5,150,105,.24);
        }
        .prohouse-mobile-main-nav a.create svg { width:25px; height:25px; }
        .prohouse-mobile-main-nav a.create.active { background:#047857; color:#fff; }
        body { padding-bottom:76px; }
        [data-mobile-listing-actions] { bottom:76px !important; }
      }
      @media (min-width:768px) { body { padding-bottom:0 !important; } }
    `
    document.head.appendChild(style)

    const isRussian = /Купить|Аренда|Новостройки|Ипотека/.test(document.body?.innerText || '')
    const currentPath = window.location.pathname
    const currentSearch = window.location.search

    const categoryNav = document.createElement('nav')
    categoryNav.className = 'prohouse-mobile-category-nav'
    categoryNav.setAttribute('aria-label', isRussian ? 'Основные разделы' : 'Asosiy bo‘limlar')

    const categories = [
      { label: isRussian ? 'Купить' : 'Sotib olish', href: '/listings?tab=sale' },
      { label: isRussian ? 'Аренда' : 'Ijara', href: '/listings?tab=rent' },
      { label: isRussian ? 'Новостройки' : 'Yangi uylar', href: '/listings?tab=sale&type=new_building' },
      { label: isRussian ? 'Построить дом' : 'Uy qurish', href: '/uy-qurish' },
      { label: isRussian ? 'Ипотека' : 'Ipoteka', href: '/#mortgage' },
      { label: isRussian ? 'Услуги' : 'Xizmatlar', href: '#services' },
      { label: isRussian ? 'Риелторы' : 'Rieltorlar', href: '/realtors' },
    ] as const

    categories.forEach((item, index) => {
      const link = document.createElement('a')
      link.href = item.href
      link.textContent = item.label
      const isActive = (index === 0 && currentPath === '/listings' && currentSearch.includes('tab=sale') && !currentSearch.includes('type=new_building'))
        || (index === 1 && currentPath === '/listings' && currentSearch.includes('tab=rent'))
        || (index === 2 && currentPath === '/listings' && currentSearch.includes('type=new_building'))
        || (index === 3 && currentPath.startsWith('/uy-qurish'))
        || (index === 5 && currentPath === '/listings' && !currentSearch.includes('tab='))
        || (index === 6 && currentPath.startsWith('/realtors'))
      if (isActive) link.classList.add('active')
      if (index === 0 && currentPath === '/') link.classList.add('primary')
      categoryNav.appendChild(link)
    })

    const firstHeader = document.querySelector('body > div header, body > header, header')
    if (firstHeader?.parentElement) firstHeader.insertAdjacentElement('afterend', categoryNav)
    else document.body.prepend(categoryNav)

    const nav = document.createElement('nav')
    nav.className = 'prohouse-mobile-main-nav'
    nav.setAttribute('aria-label', 'Asosiy mobil menyu')

    const items = [
      { key: 'home', label: isRussian ? 'Главная' : 'Bosh sahifa', href: '/' },
      { key: 'search', label: isRussian ? 'Поиск' : 'Qidiruv', href: '/listings' },
      { key: 'create', label: isRussian ? 'Объявление' : 'E’lon berish', href: '/listings/new' },
      { key: 'map', label: isRussian ? 'Карта' : 'Xarita', href: '/listings?tab=sale&view=map' },
      { key: 'user', label: isRussian ? 'Профиль' : 'Profil', href: '/account' },
    ] as const

    items.forEach((item) => {
      const link = document.createElement('a')
      link.href = item.href
      link.innerHTML = `${ICONS[item.key]}<span>${item.label}</span>`
      link.setAttribute('aria-label', item.label)
      link.title = item.label

      const isActive = item.key === 'home'
        ? currentPath === '/'
        : item.key === 'search'
          ? currentPath === '/listings' && !currentSearch.includes('view=map')
          : item.key === 'map'
            ? currentPath === '/listings' && currentSearch.includes('view=map')
            : item.key === 'create'
              ? currentPath.startsWith('/listings/new')
              : currentPath.startsWith('/account')

      if (isActive) link.classList.add('active')
      if (item.key === 'create') link.classList.add('create')
      nav.appendChild(link)
    })

    document.body.appendChild(nav)

    return () => {
      categoryNav.remove()
      nav.remove()
      style.remove()
    }
  }, [])

  return null
}
