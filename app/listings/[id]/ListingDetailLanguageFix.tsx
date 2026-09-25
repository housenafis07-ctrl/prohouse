'use client'

import { useEffect } from 'react'

type Lang = 'uz' | 'ru'
type Pair = [string, string]

// Only exact UI labels are translated here. User-entered listing text is not
// translated because longer/free-form text is never matched by these pairs.
const UI_PAIRS: Pair[] = [
  ['Xaritani katta ko‘rish →', 'Открыть карту крупнее →'],
  ['Xaritani katta ko‘rish', 'Открыть карту крупнее'],
  ['Xavfsiz bitim', 'Безопасная сделка'],
  ['Maydon', 'Площадь'],
  ['Xonalar', 'Комнаты'],
  ['Qavat', 'Этаж'],
  ['Mulk turi', 'Тип недвижимости'],
  ['Turar joy turi', 'Тип жилья'],
  ['Xususiy uy', 'Частный дом'],
  ['Kvartira', 'Квартира'],
  ['Yangi bino', 'Новостройка'],
  ['Tijorat', 'Коммерция'],
  ['Yer', 'Земля'],
  ['Joylashish shartlari', 'Условия размещения'],
  ['Sig‘im va qulayliklar', 'Вместимость и удобства'],
  ['Mehmonlar sharhlari', 'Отзывы гостей'],
  ['Ko‘p so‘raladigan savollar', 'Часто задаваемые вопросы'],
  ['Mumkin', 'Разрешено'],
  ['Mumkin emas', 'Не разрешено'],
  ['Korporativ', 'Корпоративные гости'],
  ['Korporativ mehmonlar', 'Корпоративные гости'],
  ['Spirtli ichimliklar', 'Алкоголь'],
  ['Uy hayvonlari', 'Домашние животные'],
  ['Nikoh guvohnomasi', 'Свидетельство о браке'],
  ['Mehmonlar', 'Гости'],
  ['Yotoqxonalar', 'Спальни'],
  ['Yotoqlar', 'Спальные места'],
  ['Hammom/WC', 'Санузлы'],
  ['Kirish', 'Заезд'],
  ['Chiqish', 'Выезд'],
  ['Sokin soatlar', 'Тихие часы'],
  ['Ochiq hovuz', 'Открытый бассейн'],
  ['Yopiq hovuz', 'Крытый бассейн'],
  ['Wi‑Fi', 'Wi‑Fi'],
  ['Avtoturargoh', 'Парковка'],
  ['Oshxona', 'Кухня'],
  ['Barbekyu', 'Барбекю'],
  ['Karaoke', 'Караоке'],
  ['Bilyard', 'Бильярд'],
  ['Stol tennisi', 'Настольный теннис'],
  ['Sauna', 'Сауна'],
  ['Bolalar maydonchasi', 'Детская площадка'],
  ['Jakuzi', 'Джакузи'],
  ['Ishonchli profil', 'Надёжный профиль'],
  ['Tasdiqlangan profil', 'Проверенный профиль'],
  ['Sotuvchi', 'Продавец'],
  ['Egadan', 'От владельца'],
  ['Tavsif', 'Описание'],
  ['Joylashuv', 'Расположение'],
  ['Narx', 'Цена'],
  ['So‘m', 'Сум'],
]

const SAFE_DEAL_UZ = 'RoyalHouse tasdiqlangan e’lonlar va sotuvchilarni ajratib ko‘rsatadi. To‘lov/escrow xizmatlari keyingi integratsiya bosqichida litsenziyalangan hamkor orqali amalga oshiriladi.'
const SAFE_DEAL_RU = 'RoyalHouse выделяет проверенные объявления и продавцов. Платёжные/escrow-услуги будут предоставляться через лицензированного партнёра на следующем этапе интеграции.'

const normalize = (value: string) => value
  .replace(/[’ʻʼ`]/g, "'")
  .replace(/\s+/g, ' ')
  .trim()

function translateExact(value: string, lang: Lang, pairs: Pair[] = UI_PAIRS) {
  const normalized = normalize(value)
  const source = lang === 'ru' ? pairs : pairs.map(([uz, ru]) => [ru, uz] as Pair)
  const found = source.find(([from]) => normalize(from) === normalized)
  return found ? found[1] : value
}

function translateCurrency(value: string, lang: Lang) {
  if (lang === 'ru') return value.replace(/so[’ʻʼ`']m\b/gi, 'сум')
  return value.replace(/\bсум\b/gi, 'so‘m')
}

function translateNode(node: Text, lang: Lang) {
  const value = node.nodeValue ?? ''
  const trimmed = value.trim()
  if (!trimmed) return

  let next = translateExact(trimmed, lang)
  if (next === trimmed) {
    next = translateCurrency(trimmed, lang)
  }
  if (next !== trimmed) {
    node.nodeValue = value.replace(trimmed, next)
  }
}

function applyProtectedUi(lang: Lang) {
  const root = document.body
  if (!root) return

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)

  for (const node of nodes) translateNode(node, lang)

  // Longer fixed platform text needs an exact match as well. Listing title,
  // description, address and seller-entered text are intentionally excluded.
  const safeDealPairs: Pair[] = [[SAFE_DEAL_UZ, SAFE_DEAL_RU]]
  const safeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const safeNodes: Text[] = []
  while (safeWalker.nextNode()) safeNodes.push(safeWalker.currentNode as Text)
  for (const node of safeNodes) {
    const value = node.nodeValue ?? ''
    const next = translateExact(value, lang, safeDealPairs)
    if (next !== value) node.nodeValue = next
  }
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
