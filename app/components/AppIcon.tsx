import type { SVGProps, ReactNode } from 'react'

type IconName = 'check' | 'user' | 'home' | 'plus' | 'help' | 'building' | 'tools'

export default function AppIcon({ name, className = '', ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<IconName, ReactNode> = {
    check: <path {...common} d="m5 12 4 4L19 6" />,
    user: <><path {...common} d="M20 21a8 8 0 0 0-16 0" /><circle {...common} cx="12" cy="7" r="4" /></>,
    home: <path {...common} d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z" />,
    plus: <><path {...common} d="M12 5v14M5 12h14" /></>,
    help: <><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-1 .8-1.6 1.2-1.6 2.6M12 17h.01" /></>,
    building: <><path {...common} d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3" /></>,
    tools: <><path {...common} d="m14.7 6.3 3-3a4 4 0 0 0 0 5.7l-8.4 8.4a2 2 0 1 1-2.8-2.8l8.2-8.2Z" /><path {...common} d="m5 5 4 4M4 4l2-2 4 4-2 2-4-4Z" /></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...props}>{paths[name]}</svg>
}
