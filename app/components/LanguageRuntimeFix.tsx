'use client'

import { useLayoutEffect } from 'react'

type Lang = 'uz' | 'ru'

const TOGGLE_LABELS = new Set(['O‘z / Ru', 'Ru / O‘z'])
const PRICE_RE = /^\s*[\d\s.,]+(?:\s*(?:mln|mlrd|ming|млн|млрд|тыс|тысяч))?\s*(so[‘']m|сум)\s*$/i
const RENT_PRICE_RE = /^\s*[\d\s.,]+(?:\s*(?:mln|mlrd|ming|млн|млрд|тыс|тысяч))?\s*(so[‘']m|сум)\s*\/\s*(oy|мес\.)\s*$/i
const RENT_PERIOD_RE = /^\s*\/\s*(oy|мес\.)\s*$/i
const UI_PAIRS: Array<[string, string]> = [
  ['Izoh', 'Комментарий'],
  ['Izoh:', 'Комментарий:'],
  ['Dacha ijarasida bevosita telefon va chat yopiq.', 'При аренде дачи прямой телефон и чат закрыты.'],
  ['Bronni RoyalHouse orqali rasmiylashtirib, avans to‘langandan so‘ng lokatsiya va aloqa ma’lumotlari bron tafsilotlarida ochiladi.', 'Оформите бронирование через RoyalHouse; после внесения предоплаты местоположение и контактные данные будут доступны в деталях бронирования.'],
  ['🔒', '🔒'],
]

function getLang(): Lang {
  if (typeof window === 'undefined') return 'uz'
  const royalhouseLang = window.localStorage.getItem('royalhouse-lang')
  if (royalhouseLang === 'ru' || royalhouseLang === 'uz') return royalhouseLang
  return window.localStorage.getItem('prohouse-lang') === 'ru' ? 'ru' : 'uz'
}

function protectLanguageToggles() {
  document.querySelectorAll<HTMLElement>('button').forEach((button) => {
    const text = (button.textContent ?? '').trim()
    if (TOGGLE_LABELS.has(text)) button.setAttribute('data-no-global-i18n', 'true')
  })
}

function translatePriceText(value: string, lang: Lang) {
  if (RENT_PRICE_RE.test(value)) {
    return value.replace(/(so[‘']m|сум)\s*\/\s*(oy|мес\.)\s*$/i, lang === 'ru' ? 'сум / мес.' : 'so‘m / oy')
  }
  if (!PRICE_RE.test(value)) return value
  return value.replace(/(so[‘']m|сум)\s*$/i, lang === 'ru' ? 'сум' : 'so‘m')
}

function translateRentalPeriod(value: string, lang: Lang) {
  if (!RENT_PERIOD_RE.test(value)) return value
  return lang === 'ru' ? ' / мес.' : ' / oy'
}

function translateUiText(value: string, lang: Lang) {
  const pairs = lang === 'ru' ? UI_PAIRS : UI_PAIRS.map(([uz, ru]) => [ru, uz] as [string, string])
  const exact = pairs.find(([from]) => value.trim() === from)
  if (!exact) return value
  const leading = value.match(/^\s*/)?.[0] ?? ''
  const trailing = value.match(/\s*$/)?.[0] ?? ''
  return `${leading}${exact[1]}${trailing}`
}

function translatePrices() {
  const lang = getLang()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node as Text
    const parent = text.parentElement
    if (!parent || parent.closest('[data-no-global-i18n]')) continue
    const value = text.nodeValue ?? ''
    if (PRICE_RE.test(value) || RENT_PRICE_RE.test(value) || RENT_PERIOD_RE.test(value) || UI_PAIRS.some(([uz, ru]) => value.trim() === uz || value.trim() === ru)) nodes.push(text)
  }
  nodes.forEach((text) => {
    const current = text.nodeValue ?? ''
    let next = current
    if (RENT_PERIOD_RE.test(current)) next = translateRentalPeriod(current, lang)
    else if (RENT_PRICE_RE.test(current) || PRICE_RE.test(current)) next = translatePriceText(current, lang)
    else next = translateUiText(current, lang)
    if (next !== current) text.nodeValue = next
  })
}

export default function LanguageRuntimeFix() {
  useLayoutEffect(() => {
    protectLanguageToggles()
    translatePrices()

    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        protectLanguageToggles()
        translatePrices()
      })
    }

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    window.addEventListener('prohouse-language-change', schedule)
    window.addEventListener('royalhouse-language-change', schedule)
    window.addEventListener('storage', schedule)

    return () => {
      observer.disconnect()
      window.removeEventListener('prohouse-language-change', schedule)
      window.removeEventListener('royalhouse-language-change', schedule)
      window.removeEventListener('storage', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
