'use client'

import { useLayoutEffect } from 'react'

type Lang = 'uz' | 'ru'

const TOGGLE_LABELS = new Set(['O‘z / Ru', 'Ru / O‘z'])
const PRICE_RE = /^\s*[\d\s.,]+(?:\s*(?:mln|mlrd|ming|млн|млрд|тыс|тысяч))?\s*(so[‘']m|сум)\s*$/i
const RENT_PRICE_RE = /^\s*[\d\s.,]+(?:\s*(?:mln|mlrd|ming|млн|млрд|тыс|тысяч))?\s*(so[‘']m|сум)\s*\/\s*(oy|мес\.)\s*$/i
const RENT_PERIOD_RE = /^\s*\/\s*(oy|мес\.)\s*$/i

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
    if (PRICE_RE.test(value) || RENT_PRICE_RE.test(value) || RENT_PERIOD_RE.test(value)) nodes.push(text)
  }
  nodes.forEach((text) => {
    const current = text.nodeValue ?? ''
    const next = RENT_PERIOD_RE.test(current) ? translateRentalPeriod(current, lang) : translatePriceText(current, lang)
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
