'use client'

import { useEffect } from 'react'

/**
 * Presentation-only enhancement for listing cards.
 * It deliberately targets existing card markup with CSS, so listing data,
 * routing, actions and business logic remain untouched.
 */
export default function ListingCardIconStyle() {
  useEffect(() => {
    const id = 'prohouse-listing-card-outline-icons'
    if (document.getElementById(id)) return

    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      /* Listing grid/list metadata: thin, consistent outline icon treatment. */
      a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding-left: 9px;
        color: #52667a;
      }

      a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span::before {
        content: "";
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
        background-repeat: no-repeat;
        background-position: center;
        background-size: 18px 18px;
        opacity: .9;
      }

      /* property type / service */
      a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span:nth-child(1)::before {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2362788f' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 10.5 12 3l9 7.5'/%3E%3Cpath d='M5 9.5V21h14V9.5'/%3E%3Cpath d='M9 21v-6h6v6'/%3E%3C/svg%3E");
      }

      /* area */
      a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span:nth-child(2)::before {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2362788f' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9V4h5'/%3E%3Cpath d='M20 15v5h-5'/%3E%3Cpath d='M4 4l6 6'/%3E%3Cpath d='M20 20l-6-6'/%3E%3Cpath d='M20 9V4h-5'/%3E%3Cpath d='M4 15v5h5'/%3E%3Cpath d='m20 4-6 6'/%3E%3Cpath d='m4 20 6-6'/%3E%3C/svg%3E");
      }

      /* rooms */
      a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span:nth-child(3)::before {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2362788f' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 18v-6h16v6'/%3E%3Cpath d='M6 12V9h12v3'/%3E%3Cpath d='M4 18v2M20 18v2'/%3E%3C/svg%3E");
      }

      /* floor */
      a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span:nth-child(4)::before {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2362788f' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 20h4v-4h4v-4h4V8h4'/%3E%3Cpath d='M4 20h16'/%3E%3C/svg%3E");
      }

      /* Do not give verification/owner badges an artificial property icon. */
      a[href^="/listings/"] [class*="mt-3"][class*="flex-wrap"][class*="text-xs"] > span[class*="text-emerald"]::before {
        display: none;
      }

      /* Existing location glyph: keep it thin and visually aligned with the set. */
      a[href^="/listings/"] p[class*="text-slate-500"] {
        color: #62788f;
        font-size: .78rem;
      }
    `
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  return null
}
