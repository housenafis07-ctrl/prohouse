'use client'

import { useEffect } from 'react'

type Lang = 'uz' | 'ru'
type Pair = [string, string]

// Detail-page-only compatibility layer.
// It intentionally touches only known platform UI strings. User-entered
// listing title, description, address, district and seller name are never
// translated here.
const UI_PAIRS: Pair[] = [
  ['Xaritani katta ko‘rish →', 'Открыть карту →'],
  ['Xaritani katta ko‘rish', 'Открыть карту'],
  ['Xavfsiz bitim', 'Безопасная сделка'],
  [
    'RoyalHouse tasdiqlangan e’lonlar va sotuvchilarni ajratib ko‘rsatadi. To‘lov/escrow xizmatlari keyingi integratsiya bosqichida litsenziyalangan hamkor orqali amalga oshiriladi.',
    'RoyalHouse выделяет проверенные объявления и продавцов. Платёжные/escrow-услуги будут предоставляться через лицензированного партнёра на следующем этапе интеграции.',
  ],
  ['Xaritada aniq joylashuv belgilanmagan.', 'Точное местоположение на карте не указано.'],
]

const normalize = (value: string) => value
  .replace(/[’ʻʼ`]/g, "'")
  .replace(/\s+/g, ' ')
  .trim()

function translateExact(value: string, lang: Lang) {
  const normalized = normalize(value)
  const pairs = lang === 'ru' ? UI_PAIRS : UI_PAIRS.map(([uz, ru]) => [ru, uz] as Pair)
  const found = pairs.find(([from]) => normalize(from) === normalized)
  return found ? found[1] : value
}

function translateCurrencySuffix(value: string, lang: Lang) {
  if (lang === 'ru') return value.replace(/so[’ʻʼ`']m\b/gi, 'сум')
  return value.replace(/\bсум\b/gi, 'so‘m')
}

function applyProtectedUi(lang: Lang) {
  document.querySelectorAll<HTMLElement>('[data-no-global-i18n] a').forEach((el) => {
    const value = el.textContent ?? ''
    const next = translateExact(value, lang)
    if (next !== value) el.textContent = next
  })

  // The listing price is platform-generated text (amount + currency), not
  // user-entered content. Translate only its currency suffix and nothing else.
  document.querySelectorAll<HTMLElement>('h1[data-no-global-i18n] + p').forEach((el) => {
    const value = el.textContent ?? ''
    const next = translateCurrencySuffix(value, lang)
    if (next !== value) el.textContent = next
  })

  document.querySelectorAll<HTMLElement>('section').forEach((section) => {
    const heading = section.querySelector('h2')
    if (!heading) return
    const headingText = normalize(heading.textContent ?? '')
    if (headingText !== normalize('Xavfsiz bitim') && headingText !== normalize('Безопасная сделка')) return

    const nextHeading = lang === 'ru' ? 'Безопасная сделка' : 'Xavfsiz bitim'
    if (heading.textContent !== nextHeading) heading.textContent = nextHeading

    const paragraph = section.querySelector('p')
    if (!paragraph) return
    const value = paragraph.textContent ?? ''
    const next = translateExact(value, lang)
    if (next !== value) paragraph.textContent = next
  })

  document.querySelectorAll<HTMLElement>('#listing-detail-map .leaflet-marker-icon').forEach((marker) => {
    const walker = document.createTreeWalker(marker, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    while (walker.nextNode()) nodes.push(walker.currentNode as Text)
    for (const node of nodes) {
      const value = node.nodeValue ?? ''
      const next = translateCurrencySuffix(value, lang)
      if (next !== value) node.nodeValue = next
    }
  })
}

export default function ListingDetailLanguageFix() {
  useEffect(() => {
    let applying = false
    let queued = false

    const getLang = (): Lang => window.localStorage.getItem('prohouse-lang') === 'ru' ? 'ru' : 'uz'

    const run = () => {
      if (applying) return
      applying = true
      try {
        applyProtectedUi(getLang())
      } finally {
        applying = false
      }
    }

    const schedule = () => {
      if (queued) return
      queued = true
      window.requestAnimationFrame(() => {
        queued = false
        run()
      })
    }

    run()
    window.addEventListener('prohouse-language-change', schedule)
    window.addEventListener('storage', schedule)

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => {
      window.removeEventListener('prohouse-language-change', schedule)
      window.removeEventListener('storage', schedule)
      observer.disconnect()
    }
  }, [])

  return null
}
