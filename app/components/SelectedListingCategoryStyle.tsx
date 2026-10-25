'use client'

import { useEffect } from 'react'

/** Makes the currently selected listing/service category unmistakably visible. */
export default function SelectedListingCategoryStyle() {
  useEffect(() => {
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
    return () => style.remove()
  }, [])

  return null
}
