'use client'

import { useLayoutEffect } from 'react'

type Lang = 'uz' | 'ru'

const TOGGLE_LABELS = new Set(['O‘z / Ru', 'Ru / O‘z'])
const PRICE_RE = /^\s*[\d\s.,]+(?:\s*(?:mln|mlrd|ming|млн|млрд|тыс|тысяч))?\s*(so[‘']m|сум)\s*$/i
const RENT_PRICE_RE = /^\s*[\d\s.,]+(?:\s*(?:mln|mlrd|ming|млн|млрд|тыс|тысяч))?\s*(so[‘']m|сум)\s*\/\s*(oy|мес\.)\s*$/i
const RENT_PERIOD_RE = /^\s*\/\s*(oy|мес\.)\s*$/i

const RENTAL_NOTICE_TRANSLATIONS: Record<string, string> = {
  'Dacha ijarasida bevosita telefon va chat yopiq.': 'При аренде дачи прямой телефон и чат закрыты.',
  'Bronni RoyalHouse orqali rasmiylashtirib, avans to‘langandan so‘ng lokatsiya va aloqa ma’lumotlari bron tafsilotlarida ochiladi.': 'Забронируйте через RoyalHouse; после внесения предоплаты местоположение и контактные данные будут доступны в деталях бронирования.',
}

function getLang(): Lang {
  return typeof window !== 'undefined' && window.localStorage.getItem('prohouse-lang') === 'ru' ? 'ru' : 'uz'
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

function translateRentalNotice(value: string, lang: Lang) {
  if (lang === 'ru') return RENTAL_NOTICE_TRANSLATIONS[value] ?? value
  return Object.entries(RENTAL_NOTICE_TRANSLATIONS).find(([, ru]) => ru === value)?.[0] ?? value
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
    if (PRICE_RE.test(value) || RENT_PRICE_RE.test(value) || RENT_PERIOD_RE.test(value) || RENTAL_NOTICE_TRANSLATIONS[value]) nodes.push(text)
  }
  nodes.forEach((text) => {
    const current = text.nodeValue ?? ''
    const next = RENTAL_NOTICE_TRANSLATIONS[current] || Object.entries(RENTAL_NOTICE_TRANSLATIONS).find(([, ru]) => ru === current)?.[0] || (RENT_PERIOD_RE.test(current) ? translateRentalPeriod(current, lang) : translatePriceText(current, lang))
    const translated = lang === 'ru' ? translateRentalNotice(current, lang) : next
    if (translated !== current) text.nodeValue = translated
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
    window.addEventListener('storage', schedule)

    return () => {
      observer.disconnect()
      window.removeEventListener('prohouse-language-change', schedule)
      window.removeEventListener('storage', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
