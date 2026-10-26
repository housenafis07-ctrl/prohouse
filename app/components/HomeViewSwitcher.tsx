'use client'

import { useState } from 'react'

const views = [
  { key: 'list', icon: 'list' },
  { key: 'grid', icon: 'grid' },
  { key: 'table', icon: 'table' },
] as const

type ViewKey = (typeof views)[number]['key'] | 'map'

function Icon({ type }: { type: (typeof views)[number]['icon'] }) {
  if (type === 'list') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
        <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeWidth="3" />
      </svg>
    )
  }

  if (type === 'grid') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16M15 4v16" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
      <path d="M12 21s7-6.1 7-12A7 7 0 1 0 5 9c0 5.9 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.2" />
    </svg>
  )
}

export default function HomeViewSwitcher({ lang = 'uz' }: { lang?: 'uz' | 'ru' }) {
  const [active, setActive] = useState<ViewKey>('grid')

  const selectView = (view: ViewKey) => {
    setActive(view)
    document.documentElement.dataset.royalhouseHomeView = view
    window.dispatchEvent(new CustomEvent('royalhouse-home-view-change', { detail: { view } }))
  }

  const label = (key: ViewKey) => {
    if (key === 'list') return lang === 'ru' ? 'Список' : 'Ro‘yxat'
    if (key === 'grid') return lang === 'ru' ? 'Сетка' : 'Znachki'
    if (key === 'table') return lang === 'ru' ? 'Таблица' : 'Jadval'
    return lang === 'ru' ? 'В карте' : 'Xaritada'
  }

  return (
    <>
      <style>{`
        /* The home view switcher is intentionally local to the home page.
           It never navigates to /listings and never opens the detailed filter. */
        html[data-royalhouse-home-view='list'] .rh-home-view-switcher + section > div:last-child {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        html[data-royalhouse-home-view='list'] .rh-home-view-switcher + section > div:last-child > a {
          display: grid !important;
          grid-template-columns: 150px minmax(0, 1fr) !important;
          min-height: 150px !important;
        }
        html[data-royalhouse-home-view='list'] .rh-home-view-switcher + section > div:last-child > a > div:first-child {
          aspect-ratio: auto !important;
          height: 100% !important;
        }
        html[data-royalhouse-home-view='table'] .rh-home-view-switcher + section > div:last-child {
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 0 !important;
          overflow: hidden !important;
          border: 1px solid rgb(226 232 240) !important;
          border-radius: 1rem !important;
        }
        html[data-royalhouse-home-view='table'] .rh-home-view-switcher + section > div:last-child > a {
          display: grid !important;
          grid-template-columns: 120px minmax(0, 1fr) !important;
          min-height: 120px !important;
          border-radius: 0 !important;
          border: 0 !important;
          border-bottom: 1px solid rgb(226 232 240) !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html[data-royalhouse-home-view='table'] .rh-home-view-switcher + section > div:last-child > a:last-child {
          border-bottom: 0 !important;
        }
        html[data-royalhouse-home-view='table'] .rh-home-view-switcher + section > div:last-child > a > div:first-child {
          aspect-ratio: auto !important;
          height: 100% !important;
        }
        html[data-royalhouse-home-view='map'] .rh-home-view-switcher + section > div:last-child {
          grid-template-columns: minmax(0, 1fr) !important;
        }
        html[data-royalhouse-home-view='map'] .rh-home-view-switcher + section > div:last-child > a {
          min-height: 0 !important;
        }
        @media (max-width: 767px), (pointer: coarse) {
          html[data-royalhouse-home-view='list'] .rh-home-view-switcher + section > div:last-child > a,
          html[data-royalhouse-home-view='table'] .rh-home-view-switcher + section > div:last-child > a {
            grid-template-columns: 108px minmax(0, 1fr) !important;
          }
        }
      `}</style>
      <div
        className="rh-home-view-switcher mx-auto max-w-[1400px] px-4 pt-7 sm:pt-8"
        data-home-view={active}
      >
        <div className="flex w-fit items-center rounded-2xl bg-[#ffd51a] p-1.5 shadow-sm sm:rounded-full">
          <div className="flex items-center gap-1">
            {views.map((view) => (
              <button
                key={view.key}
                type="button"
                onClick={() => selectView(view.key)}
                aria-label={label(view.key)}
                title={label(view.key)}
                aria-pressed={active === view.key}
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-slate-900/80 transition hover:bg-white/50 sm:h-10 sm:w-10 sm:rounded-full ${active === view.key ? 'bg-white/55' : ''}`}
              >
                <Icon type={view.icon} />
              </button>
            ))}
          </div>
          <div className="ml-1 border-l border-slate-900/20 pl-1">
            <button
              type="button"
              onClick={() => selectView('map')}
              aria-label={label('map')}
              title={label('map')}
              aria-pressed={active === 'map'}
              className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-slate-900 transition hover:bg-white/50 sm:h-10 sm:rounded-full sm:px-4 ${active === 'map' ? 'bg-white/55' : ''}`}
            >
              <MapIcon />
              <span>{label('map')}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
