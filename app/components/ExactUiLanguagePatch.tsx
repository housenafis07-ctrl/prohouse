'use client'

import { useEffect } from 'react'

type Lang = 'uz' | 'ru'
type Pair = [string, string]

// Exact-match patch for static UI phrases that were missing from the legacy
// compatibility dictionaries. Exact matching is intentional: listing titles,
// descriptions, addresses, names and other user-entered content must never be
// translated just because they contain a short word such as "oy".
const PAIRS: Pair[] = [
  ['Tasdiqlangan ko‘chmas mulk mutaxassislarini toping.', 'Найдите подтверждённых специалистов по недвижимости.'],
  ['Hozircha tasdiqlangan professional rieltorlar yo‘q.', 'Пока нет подтверждённых профессиональных риелторов.'],
  ['Professional rieltor', 'Профессиональный риелтор'],
  ['Ko‘chmas mulk bo‘yicha professional xizmat.', 'Профессиональные услуги по недвижимости.'],
  ['✓ Tasdiqlangan', '✓ Подтверждено'],
  ['Kabinet', 'Кабинет'],
  ['Shaxsiy kabinet', 'Личный кабинет'],
  ['Telefonni ko‘rsatish', 'Показать телефон'],
  ['☎ Telefonni ko‘rsatish', '☎ Показать телефон'],
  ['Chatga yozish', 'Написать в чат'],
  ['💬 Chatga yozish', '💬 Написать в чат'],
  ['Chat ochilmoqda...', 'Открытие чата...'],
  ['Sotuvchi', 'Продавец'],
  ['Ijaraga beruvchi', 'Арендодатель'],
  ['Tavsif', 'Описание'],
  ['Tavsif kiritilmagan.', 'Описание не указано.'],
  ['Joylashuv', 'Местоположение'],
  ['Xaritani katta ko‘rish →', 'Открыть карту →'],
  ['Rasm mavjud emas', 'Изображение отсутствует'],
  ['Maydon', 'Площадь'],
  ['Xonalar', 'Комнаты'],
  ['Qavat', 'Этаж'],
  ['Mulk turi', 'Тип недвижимости'],
  ['Tasdiqlangan profil', 'Подтверждённый профиль'],
  ['Ishonchli profil', 'Надёжный профиль'],
  ['E’lonlar', 'Объявления'],
  ['E’lonlarga qaytish', 'Вернуться к объявлениям'],
  ['E’lon topilmadi', 'Объявление не найдено'],
  ['E’lon topilmadi yoki hozir faol emas', 'Объявление не найдено или сейчас неактивно'],
  ['E’lonni yuklashda xatolik yuz berdi.', 'Ошибка при загрузке объявления.'],
  ['Murojaatni yuborib bo‘lmadi.', 'Не удалось отправить обращение.'],
  ['Sotuvchi telefon raqami kiritilmagan.', 'Номер телефона продавца не указан.'],
  ['Xatolik yuz berdi.', 'Произошла ошибка.'],
]

const normalize = (value: string) => value.replace(/[’ʻʼ`]/g, "'").replace(/\s+/g, ' ').trim()

function translateExact(value: string, lang: Lang) {
  const pairs = lang === 'ru' ? PAIRS : PAIRS.map(([uz, ru]) => [ru, uz] as Pair)
  const match = pairs.find(([from]) => normalize(from) === normalize(value))
  if (!match) return value
  const leading = value.match(/^\s*/)?.[0] ?? ''
  const trailing = value.match(/\s*$/)?.[0] ?? ''
  return `${leading}${match[1]}${trailing}`
}

function shouldSkip(node: Node) {
  const parent = node.parentElement
  if (!parent) return true
  return ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(parent.tagName) || Boolean(parent.closest('[data-no-global-i18n]'))
}

function apply(lang: Lang) {
  document.documentElement.lang = lang
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    if (shouldSkip(node)) continue
    const current = node.nodeValue ?? ''
    const next = translateExact(current, lang)
    if (next !== current) node.nodeValue = next
  }

  document.querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]').forEach(el => {
    for (const attr of ['placeholder', 'title', 'aria-label']) {
      const value = el.getAttribute(attr)
      if (!value) continue
      const next = translateExact(value, lang)
      if (next !== value) el.setAttribute(attr, next)
    }
  })
}

export default function ExactUiLanguagePatch() {
  useEffect(() => {
    let running = false
    let queued = false
    const getLang = (): Lang => window.localStorage.getItem('prohouse-lang') === 'ru' ? 'ru' : 'uz'
    const run = () => {
      if (running) return
      running = true
      apply(getLang())
      running = false
    }
    const schedule = () => {
      if (queued) return
      queued = true
      window.requestAnimationFrame(() => { queued = false; run() })
    }

    run()
    window.addEventListener('prohouse-language-change', run)
    window.addEventListener('storage', schedule)
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('prohouse-language-change', run)
      window.removeEventListener('storage', schedule)
    }
  }, [])

  return null
}
