'use client'

export default function RoyalhousePwaAiSearchStyle() {
  return (
    <style dangerouslySetInnerHTML={{
      __html: `
        @media (min-width: 768px) and (display-mode: standalone) {
          [data-royalhouse-mobile-search] {
            display: block !important;
            position: relative !important;
            z-index: 40 !important;
          }
        }
      `,
    }} />
  )
}
