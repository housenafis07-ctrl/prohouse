'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const views = [
  { key: 'list', href: '/listings?tab=sale&view=list', label: 'Ro‘yxat ko‘rinishi', icon: 'list' },
  { key: 'grid', href: '/listings?tab=sale&view=grid', label: 'Znachki ko‘rinishi', icon: 'grid' },
  { key: 'table', href: '/listings?tab=sale&view=table', label: 'Jadval ko‘rinishi', icon: 'table' },
  { key: 'map', href: '/listings?tab=sale&view=map', label: 'Xaritada ko‘rish', icon: 'map' },
] as const

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

  if (type === 'table') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M9 4v16M15 4v16" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
      <path d="M12 21s7-6.1 7-12A7 7 0 1 0 5 9c0 5.9 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.2" />
    </svg>
  )
}

export default function HomeViewSwitcher({ lang = 'uz' }: { lang?: 'uz' | 'ru' }) {
  const searchParams = useSearchParams()
  const currentView = searchParams.get('view') || 'grid'

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-7 sm:pt-8">
      <div className="flex w-full items-center justify-center rounded-2xl bg-[#ffd51a] p-1.5 shadow-sm sm:w-fit sm:justify-start sm:rounded-full">
        <div className="flex w-full items-center justify-between gap-1 sm:w-auto">
          {views.map((view) => {
            const active = currentView === view.key
            return (
              <Link
                key={view.key}
                href={view.href}
                aria-label={lang === 'ru' ? view.label : view.label}
                title={lang === 'ru' ? view.label : view.label}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition sm:h-10 sm:w-10 sm:rounded-full ${
                  active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-900/80 hover:bg-white/50'
                }`}
              >
                <Icon type={view.icon} />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
