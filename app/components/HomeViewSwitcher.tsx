import Link from 'next/link'

const views = [
  { key: 'list', href: '/listings?tab=sale&view=list', icon: 'list' },
  { key: 'grid', href: '/listings?tab=sale&view=grid', icon: 'grid' },
  { key: 'table', href: '/listings?tab=sale&view=table', icon: 'table' },
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
  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-7 sm:pt-8">
      <div className="flex w-fit items-center rounded-2xl bg-[#ffd51a] p-1.5 shadow-sm sm:rounded-full">
        <div className="flex items-center gap-1">
          {views.map((view) => (
            <Link
              key={view.key}
              href={view.href}
              aria-label={view.key === 'list' ? 'Ro‘yxat' : view.key === 'grid' ? 'Znachki' : 'Jadval'}
              title={view.key === 'list' ? 'Ro‘yxat' : view.key === 'grid' ? 'Znachki' : 'Jadval'}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-900/80 transition hover:bg-white/50 sm:h-10 sm:w-10 sm:rounded-full"
            >
              <Icon type={view.icon} />
            </Link>
          ))}
        </div>
        <div className="ml-1 border-l border-slate-900/20 pl-1">
          <Link
            href="/listings?tab=sale&view=map"
            aria-label={lang === 'ru' ? 'В карте' : 'Xaritada'}
            title={lang === 'ru' ? 'В карте' : 'Xaritada'}
            className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-black text-slate-900 transition hover:bg-white/50 sm:h-10 sm:rounded-full sm:px-4"
          >
            <MapIcon />
            <span>{lang === 'ru' ? 'В карте' : 'Xaritada'}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
