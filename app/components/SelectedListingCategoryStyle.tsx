'use client'

import { useEffect } from 'react'

/** Makes the currently selected listing/service category unmistakably visible. */
export default function SelectedListingCategoryStyle() {
  useEffect(() => {
    const markCategoryGrids = () => {
      document.querySelectorAll('div.grid.gap-3').forEach((grid) => {
        const buttons = Array.from(grid.children).filter(
          (node): node is HTMLElement => node instanceof HTMLElement && node.tagName === 'BUTTON',
        )
        if (buttons.length < 2) return
        if (!buttons.every((button) => button.querySelector(':scope > b'))) return
        grid.classList.add('rh-listing-wizard-category-grid')
      })
    }

    const style = document.createElement('style')
    style.id = 'rh-selected-listing-category-style'
    style.textContent = `
      .rh-listing-wizard-category-grid > button.border-slate-950.bg-slate-50 {
        background: linear-gradient(135deg, #08ad55 0%, #078b45 100%) !important;
        border-color: #078b45 !important;
        color: #fff !important;
        box-shadow: 0 8px 22px rgba(8, 173, 85, 0.20) !important;
        transform: translateY(-1px);
      }

      .rh-listing-wizard-category-grid > button.border-slate-950.bg-slate-50 b,
      .rh-listing-wizard-category-grid > button.border-slate-950.bg-slate-50 span {
        color: #fff !important;
      }

      .rh-listing-wizard-category-grid > button.border-slate-950.bg-slate-50::after {
        content: '✓';
        float: right;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        margin-top: -2px;
        border-radius: 999px;
        background: rgba(255,255,255,.18);
        color: #fff;
        font-weight: 900;
        font-size: 15px;
      }
    `
    document.head.appendChild(style)
    markCategoryGrids()

    const observer = new MutationObserver(markCategoryGrids)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      style.remove()
    }
  }, [])

  return null
}
