'use client'

import { useEffect } from 'react'

type Lang = 'uz' | 'ru'
type Pair = [string, string]

// Only exact UI labels and structured platform values are translated here.
// User-entered listing title, description, address and seller text are not translated.
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

const LOCATION_PAIRS: Pair[] = [
  ['Toshkent viloyati', 'Ташкентская область'],
  ['Toshkent shahri', 'г. Ташкент'],
  ['Toshkent shahar', 'г. Ташкент'],
  ["Bo'stonliq", 'Бостанлыкский район'],
  ['Bo‘stonliq', 'Бостанлыкский район'],
  ['Chilonzor', 'Чиланзар'],
  ['Yunusobod', 'Юнусабад'],
  ['Mirzo Ulug‘bek', 'Мирзо-Улугбекский район'],
  ["Mirzo Ulug'bek", 'Мирзо-Улугбекский район'],
  ['Shayxontohur', 'Шайхантахурский район'],
  ['Olmazor', 'Алмазарский район'],
  ['Yakkasaroy', 'Яккасарайский район'],
  ['Sergeli', 'Сергелийский район'],
  ['Bektemir', 'Бектемирский район'],
  ['Uchtepa', 'Учтепинский район'],
  ['Mirobod', 'Мирабадский район'],
  ['Yangihayot', 'Янгихаётский район'],
]

const SAFE_DEAL_UZ = 'RoyalHouse tasdiqlangan e’lonlar va sotuvchilarni ajratib ko‘rsatadi. To‘lov/escrow xizmatlari keyingi integratsiya bosqichida litsenziyalangan hamkor orqali amalga oshiriladi.'
const SAFE_DEAL_RU = 'RoyalHouse выделяет проверенные объявления и продавцов. Платёжные/escrow-услуги будут предоставляться через лицензированного партнёра на следующем этапе интеграции.'
const RENTAL_CONTACT_UZ = 'Dacha ijarasida bevosita telefon va chat yo‘q. Bronni RoyalHouse orqali rasmiylashtirib, avans to‘langandan so‘ng lokatsiya va aloqa ma’lumotlari bron tafsilotlarida ochiladi.'
const RENTAL_CONTACT_RU = 'При аренде дачи прямые телефонные звонки и чат недоступны. После оформления бронирования через RoyalHouse и оплаты аванса местоположение и контактные данные будут доступны в деталях бронирования.'

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

function translateStructuredText(value: string, lang: Lang) {
  let next = value
  const pairs = lang === 'ru' ? LOCATION_PAIRS : LOCATION_PAIRS.map(([uz, ru]) => [ru, uz] as Pair)
  for (const [from, to] of pairs) {
    next = next.replace(new RegExp(`(^|[\\s,⌖])${escapeRegExp(from)}(?=($|[\\s,])|$)`, 'g'), `$1${to}`)
  }
  return next
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function translateCurrencyAndPeriod(value: string, lang: Lang) {
  if (lang === 'ru') {
    return value
      .replace(/so[’ʻʼ`']m\b/gi, 'сум')
      .replace(/\s*\/\s*oy\b/gi, ' / мес.')
      .replace(/\s*\/\s*kun\b/gi, ' / сутки')
  }
  return value
    .replace(/\bсум\b/gi, 'so‘m')
    .replace(/\s*\/\s*мес\.\b/gi, ' / oy')
    .replace(/\s*\/\s*сутки\b/gi, ' / kun')
}

function translateNode(node: Text, lang: Lang) {
  const value = node.nodeValue ?? ''
  const trimmed = value.trim()
  if (!trimmed) return

  let next = translateExact(trimmed, lang)
  if (next === trimmed) next = translateStructuredText(trimmed, lang)
  next = translateCurrencyAndPeriod(next, lang)

  if (next !== trimmed) node.nodeValue = value.replace(trimmed, next)
}

function applyProtectedUi(lang: Lang) {
  const root = document.body
  if (!root) return

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) translateNode(node, lang)

  const safeDealPairs: Pair[] = [[SAFE_DEAL_UZ, SAFE_DEAL_RU], [RENTAL_CONTACT_UZ, RENTAL_CONTACT_RU]]
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

    const getLang = (): Lang => {
      const royalhouseLang = window.localStorage.getItem('royalhouse-lang')
      if (royalhouseLang === 'ru' || royalhouseLang === 'uz') return royalhouseLang
      return window.localStorage.getItem('prohouse-lang') === 'ru' ? 'ru' : 'uz'
    }

    const run = () => {
      if (applying) return
      applying = true
      try { applyProtectedUi(getLang()) } finally { applying = false }
    }

    const schedule = () => {
      if (queued) return
      queued = true
      window.requestAnimationFrame(() => { queued = false; run() })
    }

    run()
    window.addEventListener('royalhouse-language-change', schedule)
    window.addEventListener('prohouse-language-change', schedule)
    window.addEventListener('storage', schedule)

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    return () => {
      window.removeEventListener('royalhouse-language-change', schedule)
      window.removeEventListener('prohouse-language-change', schedule)
      window.removeEventListener('storage', schedule)
      observer.disconnect()
    }
  }, [])

  return null
}
