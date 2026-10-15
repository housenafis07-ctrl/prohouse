'use client'

import { useEffect } from 'react'

export default function RoyalhouseMobileHomePolish() {
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-royalhouse-mobile-polish', 'true')
    style.textContent = `
      @media (max-width: 767px) {
        [data-royalhouse-mobile-search] svg {
          width: 18px !important;
          height: 18px !important;
          min-width: 18px !important;
          min-height: 18px !important;
          max-width: 18px !important;
          max-height: 18px !important;
          flex: 0 0 18px !important;
        }

        [data-royalhouse-mobile-search] button[aria-label="Qidirish"],
        [data-royalhouse-mobile-search] button[aria-label="Найти"] {
          display: none !important;
        }

        [data-royalhouse-mobile-search] > div {
          padding-top: 4px !important;
          padding-bottom: 4px !important;
        }

        [data-royalhouse-mobile-search] > div > div {
          border-radius: 16px !important;
        }

        [data-royalhouse-mobile-search] input {
          min-width: 0 !important;
          width: 100% !important;
          font-size: 12px !important;
          line-height: 18px !important;
        }

        [data-royalhouse-mobile-search] button[aria-label="Batafsil filtr"],
        [data-royalhouse-mobile-search] button[aria-label="Подробный фильтр"] {
          width: 42px !important;
          height: 42px !important;
          min-width: 42px !important;
          padding: 0 !important;
          border-radius: 13px !important;
        }

        [data-royalhouse-mobile-search] button[aria-label="Batafsil filtr"] svg,
        [data-royalhouse-mobile-search] button[aria-label="Подробный фильтр"] svg {
          width: 19px !important;
          height: 19px !important;
          min-width: 19px !important;
          min-height: 19px !important;
          max-width: 19px !important;
          max-height: 19px !important;
        }

        [data-royalhouse-mobile-search] + * { margin-top: 0 !important; }

        [data-royalhouse-mobile-search] .fixed.inset-0 {
          padding: 0 !important;
          align-items: flex-end !important;
        }

        [data-royalhouse-mobile-search] .fixed.inset-0 > div {
          width: 100% !important;
          max-height: 78vh !important;
          overflow-y: auto !important;
          border-radius: 24px 24px 0 0 !important;
          padding: 16px !important;
        }

        [data-royalhouse-mobile-search] .fixed.inset-0 h2 {
          font-size: 18px !important;
          line-height: 24px !important;
        }

        [data-royalhouse-mobile-search] .fixed.inset-0 label {
          min-height: 64px !important;
          border-radius: 14px !important;
          padding: 10px 12px !important;
        }

        [data-royalhouse-mobile-search] .fixed.inset-0 select,
        [data-royalhouse-mobile-search] .fixed.inset-0 input {
          font-size: 12px !important;
        }

        [data-royalhouse-mobile-search] .fixed.inset-0 button {
          border-radius: 14px !important;
        }
      }
    `
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  return null
}
