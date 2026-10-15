'use client'

import { useEffect } from 'react'

type Lang = 'uz' | 'ru'

const userIcon = `
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="19" height="19">
    <circle cx="12" cy="8" r="3.5"/>
    <path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5"/>
  </svg>`

export default function HeaderQuickContact({ lang }: { lang: Lang }) {
  useEffect(() => {
    const decorate = () => {
      const button = document.querySelector('.account-btn') as HTMLButtonElement | null
      if (button) {
        const currentLabel = button.querySelector('.rh-account-label')?.textContent?.trim()
        const rawText = button.textContent?.trim()
        const label = currentLabel || rawText || (lang === 'ru' ? 'Войти / Регистрация' : 'Kirish / Ro‘yxatdan o‘tish')
        button.setAttribute('aria-label', label)
        if (!button.querySelector('.rh-account-label')) {
          button.innerHTML = `${userIcon}<span class="rh-account-label">${label}</span>`
        }
      }

      // Keep the real Royalhouse brand mark and wordmark intact on mobile.
      const logo = document.querySelector('header > div:nth-child(2) > a:first-child') as HTMLAnchorElement | null
      if (logo && logo.dataset.royalhouseBrand !== 'true') {
        logo.dataset.royalhouseBrand = 'true'
        logo.setAttribute('aria-label', 'Royalhouse — bosh sahifa')
        logo.innerHTML = `
          <img src="/royalhouse-icon.svg" alt="Royalhouse" class="rh-brand-icon" />
          <span class="rh-brand-word">Royal<span>house</span></span>
        `
      }
    }

    decorate()
    const observer = new MutationObserver(decorate)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    const timer = window.setTimeout(decorate, 100)

    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [lang])

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          header > div.border-t.border-slate-100.bg-white.px-3.py-2 {
            display: none !important;
          }

          header > div:nth-child(2) {
            min-height: 58px !important;
            gap: 4px !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
          }

          header > div:nth-child(2) > a:first-child {
            min-width: 0 !important;
            flex: 1 1 auto !important;
            overflow: visible !important;
            font-size: 15px !important;
            white-space: nowrap !important;
            letter-spacing: -0.25px !important;
          }

          header > div:nth-child(2) > a:first-child .rh-brand-icon {
            width: 38px !important;
            height: 38px !important;
            min-width: 38px !important;
            flex: 0 0 38px !important;
            margin-right: 5px !important;
            border-radius: 10px !important;
            object-fit: cover !important;
          }

          header > div:nth-child(2) > a:first-child .rh-brand-word {
            display: inline-block !important;
            font-size: 19px !important;
            font-weight: 900 !important;
            letter-spacing: -0.7px !important;
            line-height: 1 !important;
            color: #0f172a !important;
          }

          header > div:nth-child(2) > a:first-child .rh-brand-word > span {
            color: #10b981 !important;
          }

          header .ml-auto {
            min-width: max-content !important;
            flex: 0 0 auto !important;
            gap: 4px !important;
          }

          header .ml-auto > button:first-of-type {
            width: 40px !important;
            height: 40px !important;
            min-width: 40px !important;
            padding: 0 !important;
            font-size: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          html[lang="uz"] header .ml-auto > button:first-of-type::after {
            content: "O‘z";
            font-size: 11px;
            font-weight: 800;
          }

          html[lang="ru"] header .ml-auto > button:first-of-type::after {
            content: "Ru";
            font-size: 11px;
            font-weight: 800;
          }

          header .account-btn {
            width: 40px !important;
            min-width: 40px !important;
            height: 40px !important;
            padding: 0 !important;
            border-radius: 12px !important;
            font-size: 0 !important;
            line-height: 1 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex: 0 0 40px !important;
          }

          header .account-btn .rh-account-label {
            display: none !important;
          }

          header .account-btn svg {
            display: block !important;
            width: 19px !important;
            height: 19px !important;
          }

          header a[href^="tel:"],
          header a[href*="t.me"] {
            width: 40px !important;
            min-width: 40px !important;
            height: 40px !important;
            padding: 0 !important;
            border-radius: 12px !important;
            flex: 0 0 40px !important;
          }

          header a[href^="tel:"] > span,
          header a[href*="t.me"] > span:not(:first-child) {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          header a[href^="tel:"] > span.rh-phone-icon {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          header a[href^="tel:"] > span > svg {
            display: block !important;
            width: 20px !important;
            height: 20px !important;
            color: #059669 !important;
            stroke: currentColor !important;
          }

          header a[href^="tel:"] > span:not(.rh-phone-icon),
          header a[href*="t.me"] > span:not(:first-child) {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <a
          href="tel:+998998244494"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-emerald-600 transition hover:border-emerald-300 hover:text-emerald-700 sm:h-10 sm:w-10 xl:h-auto xl:w-auto xl:gap-2 xl:px-3 xl:py-2 xl:text-xs xl:font-bold xl:text-slate-700"
          aria-label={lang === 'ru' ? 'Позвонить в Royalhouse' : 'Royalhouse’ga qo‘ng‘iroq qilish'}
        >
          <span className="rh-phone-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" />
            </svg>
          </span>
          <span className="hidden xl:inline">+998 99 824 44 94</span>
        </a>

        <a
          href="https://t.me/RoyalHouseUz_bot?start=support"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white transition hover:bg-sky-600 sm:h-10 sm:w-10 xl:h-auto xl:w-auto xl:gap-2 xl:px-3 xl:py-2 xl:text-xs xl:font-bold"
          aria-label={lang === 'ru' ? 'Написать в Telegram' : 'Telegram orqali yozish'}
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M21.7 3.3 2.9 10.55c-1.28.5-1.27 1.2-.23 1.5l4.82 1.5 1.85 5.77c.23.65.12.91.8.91.52 0 .75-.24 1.03-.52l2.5-2.43 5.2 3.84c.96.53 1.65.27 1.9-.89l3.42-16.14c.37-1.42-.54-2.06-1.48-1.79ZM8.23 13.17l10.8-6.81c.51-.31.98-.14.6.2l-8.75 7.9-.34 3.63-4.92-1.58-.49.77-.51Z"/>
          </svg>
          <span className="hidden xl:inline">Telegram</span>
        </a>
      </div>
    </>
  )
}
