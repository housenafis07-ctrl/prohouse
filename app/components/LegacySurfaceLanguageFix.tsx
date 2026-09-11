'use client'

import { useEffect } from 'react'

type Lang = 'uz' | 'ru'
type Pair = [string, string]

// A compatibility layer for legacy/static surfaces that still contain literal
// UI copy. It deliberately translates only known platform phrases; listing
// titles, descriptions, addresses and user-entered text are never translated.
const PAIRS: Pair[] = [
  // Trusted profile
  ['Prohouse xavfsizlik tizimi', 'Система безопасности Prohouse'],
  ['Ishonchli profil', 'Надёжный профиль'],
  ['Ixtiyoriy tasdiqlash orqali foydalanuvchining haqiqiyligini kuchaytirish va e’lonlarda ishonchli sotuvchini ajratib ko‘rsatish.', 'Система помогает подтвердить подлинность пользователя и выделить надёжного продавца в объявлениях.'],
  ['Ulanilmagan', 'Не подключено'],
  ['Ishonchli profil dasturiga qo‘shilish hali boshlanmagan.', 'Подключение к программе надёжного профиля ещё не началось.'],
  ['Holat', 'Статус'],
  ['So‘rov yuborildi', 'Запрос отправлен'],
  ['Profilingiz tekshiruv navbatiga qo‘yildi.', 'Ваш профиль поставлен в очередь на проверку.'],
  ['Tasdiqlash jarayonida', 'На проверке'],
  ['MyID va boshqa zarur tekshiruvlar yakunlanmoqda.', 'Завершаются проверки MyID и другие необходимые проверки.'],
  ['Profilingiz ishonchli sifatida tasdiqlangan.', 'Ваш профиль подтверждён как надёжный.'],
  ['Tasdiqlanmadi', 'Не подтверждено'],
  ['Tekshiruv natijasida qo‘shimcha ma’lumot talab qilinishi mumkin.', 'По результатам проверки может потребоваться дополнительная информация.'],
  ['Tasdiqlangan', 'Подтверждено'],
  ['Tasdiqlanmagan', 'Не подтверждено'],
  ['Kutilmoqda', 'Ожидается'],
  ['MyID', 'MyID'],
  ['Shaxsni biometrik identifikatsiya qilish orqali profilni tasdiqlash.', 'Подтверждение профиля с помощью биометрической идентификации.'],
  ['MyID orqali tasdiqlash', 'Подтвердить через MyID'],
  ['To‘lov hisobi', 'Платёжный счёт'],
  ['Ishonchli profilni kuchaytirish uchun bog‘langan to‘lov hisobining tasdiqlangan holati.', 'Подтверждённый статус привязанного платёжного счёта для усиления надёжности профиля.'],
  ['Ixtiyoriy dastur', 'Добровольная программа'],
  ['Qo‘shilish majburiy emas.', 'Участие не обязательно.'],
  ['So‘rov yuborgach, MyID tasdig‘i va mavjud xavfsizlik tekshiruvlari asosida profilga yashil belgi beriladi.', 'После отправки запроса и подтверждения MyID профиль получает зелёную отметку на основании необходимых проверок безопасности.'],
  ['Tekshiruv kutilmoqda', 'Проверка ожидается'],
  ['Ishonchli profilga qo‘shilish', 'Присоединиться к программе надёжного профиля'],
  ['Belgi qayerda ko‘rinadi?', 'Где отображается значок?'],
  ['✓ Shaxsiy kabinetdagi profil holatida', '✓ В статусе профиля в личном кабинете'],
  ['✓ Hamkorning e’lonlarida “Ishonchli profil” belgisi sifatida', '✓ В объявлениях партнёра как отметка «Надёжный профиль»'],
  ['✓ E’lon tafsilotlarida sotuvchi/beruvchi ma’lumotlari yonida', '✓ В деталях объявления рядом с данными продавца/арендодателя'],
  ['✓ Keyingi bosqichda Rieltorlar profilida ham', '✓ На следующем этапе также в профилях риелторов'],
  ['Ishonchli profil allaqachon tasdiqlangan.', 'Надёжный профиль уже подтверждён.'],
  ['Ishonchli profil uchun so‘rovingiz qabul qilindi.', 'Ваш запрос на надёжный профиль принят.'],
  ['So‘rov yuborishda xatolik', 'Ошибка при отправке запроса'],
  ['MyID tekshiruvini boshlashda xatolik', 'Ошибка при запуске проверки MyID'],
  ['MyID integratsiyasi konfiguratsiya qilinmagan.', 'Интеграция MyID не настроена.'],
  ['Shaxsiy kabinet', 'Личный кабинет'],
  ['← Shaxsiy kabinet', '← Личный кабинет'],
  ['Yuklanmoqda...', 'Загрузка...'],

  // Mortgage modal / home surface
  ['Ipoteka', 'Ипотека'],
  ['Ipoteka ikkilamchi bozorda', 'Ипотека на вторичном рынке'],
  ['Ipoteka kalkulyatori', 'Калькулятор ипотеки'],
  ['Barcha ipoteka kreditlari', 'Все ипотечные кредиты'],
  ['Ipoteka imkoniyatlari', 'Ипотечный потенциал'],
  ['Ipoteka yangi qurilishga', 'Ипотека на новостройку'],
  ['Ipotekani xizmat ko‘rsatish', 'Обслуживание ипотеки'],
  ['Garov evaziga kredit', 'Кредит под залог'],
  ['Qayta moliyalash', 'Рефинансирование'],
  ['Ipotekaga mumkin', 'Подходит для ипотеки'],
  ['Sug‘urta', 'Страхование'],
  ['Huquqiy tekshiruv', 'Юридическая проверка'],
  ['Kadastr', 'Кадастр'],
  ['Uy xizmatlari', 'Услуги по дому'],

  // Construction / Uy qurish
  ['PROHOUSE CONSTRUCTION', 'PROHOUSE CONSTRUCTION'],
  ['Uy qurish', 'Построить дом'],
  ['Orzuyingizdagi uyni biz bilan birga quring. Loyiha, yer, pudratchi va xarajatlar — barchasi bir joyda.', 'Постройте дом своей мечты вместе с нами. Проект, участок, подрядчик и расходы — всё в одном месте.'],
  ['Loyihani tanlash →', 'Выбрать проект →'],
  ['O‘zingizga mos uy', 'Дом, который подходит вам'],
  ['Loyihadan kalitgacha', 'От проекта до ключей'],
  ['Uy qurish xizmatlari', 'Услуги по строительству дома'],
  ['Kerakli bosqichni tanlang', 'Выберите нужный этап'],
  ['Loyiha tanlash', 'Выбор проекта'],
  ['Tayyor uy loyihalari', 'Готовые проекты домов'],
  ['Loyihalar katalogi', 'Каталог проектов'],
  ['1000+ tayyor loyiha', '1000+ готовых проектов'],
  ['Pudratchi tanlash', 'Выбор подрядчика'],
  ['Ishonchli pudratchilar', 'Проверенные подрядчики'],
  ['Yer uchastkasini topish', 'Найти участок'],
  ['Qurilish uchun yerlar', 'Участки для строительства'],
  ['Hisob-kitob qilish', 'Рассчитать стоимость'],
  ['Taxminiy xarajatlar', 'Ориентировочные расходы'],
  ['Tayyor uy loyihalari', 'Готовые проекты домов'],
  ['Turli uslub va maydondagi loyihalar', 'Проекты разных стилей и площадей'],
  ['Barchasini ko‘rish →', 'Смотреть все →'],
  ['Shaxsiy kabinet', 'Личный кабинет'],
  ['Sotib olish', 'Купить'],
  ['Ijara', 'Аренда'],
  ['Yangi uylar', 'Новостройки'],
  ['Xizmatlar', 'Услуги'],
  ['Rieltorlar', 'Риелторы'],

  // Common legacy navigation/actions
  ['Kabinet', 'Кабинет'],
  ['E’lon joylashtirish', 'Разместить объявление'],
  ['Mening e’lonlarim', 'Мои объявления'],
  ['Xabarlar', 'Сообщения'],
  ['Saqlanganlar', 'Избранное'],
  ['Saqlangan qidiruvlar', 'Сохранённые поиски'],
  ['Hisob va tranzaksiyalar', 'Счёт и транзакции'],
  ['Promotion', 'Promotion'],
  ['E’lonlar', 'Объявления'],
  ['Bosh sahifa', 'Главная'],
  ['Chiqish', 'Выйти'],
  ['Kirish', 'Войти'],
  ['Ro‘yxatdan o‘tish', 'Регистрация'],
  ['Qidirish', 'Поиск'],
  ['Filtrlar', 'Фильтры'],
  ['Barchasi', 'Все'],
  ['Ko‘rish', 'Просмотр'],
  ['Tahrirlash', 'Редактировать'],
  ['Yopish', 'Закрыть'],
  ['Saqlash', 'Сохранить'],
  ['O‘chirish', 'Удалить'],
  ['Ochish', 'Открыть'],
  ['Yoqish', 'Включить'],
  ['Bekor qilish', 'Отменить'],
  ['Davom etish', 'Продолжить'],
  ['Orqaga', 'Назад'],
  ['Keyingi bosqich', 'Следующий шаг'],
  ['Ma’lumotlar', 'Данные'],
  ['Narx', 'Цена'],
  ['Manzil', 'Адрес'],
  ['Xona', 'Комната'],
  ['xona', 'комн.'],
  ['kun', 'день'],
  ['oy', 'месяц'],
  ['so‘m', 'сум'],
]

const normalize = (value: string) => value
  .replace(/[’ʻʼ`]/g, "'")
  .replace(/\s+/g, ' ')
  .trim()

function regexFor(value: string) {
  return normalize(value)
    .split(' ')
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’ʻʼ`]") )
    .join('\\s+')
}

function translate(value: string, lang: Lang) {
  const pairs = lang === 'ru' ? PAIRS : PAIRS.map(([uz, ru]) => [ru, uz] as Pair)
  const exact = pairs.find(([from]) => normalize(from) === normalize(value))
  if (exact) {
    const leading = value.match(/^\s*/)?.[0] ?? ''
    const trailing = value.match(/\s*$/)?.[0] ?? ''
    return `${leading}${exact[1]}${trailing}`
  }

  let next = value
  // Longest phrases first prevents a short phrase from consuming part of a
  // longer sentence before the sentence-level translation can run.
  for (const [from, to] of [...pairs].sort((a, b) => b[0].length - a[0].length)) {
    const pattern = regexFor(from)
    next = next.replace(new RegExp(pattern, 'g'), to)
  }
  return next
}

function shouldSkip(node: Node) {
  const parent = node.parentElement
  if (!parent) return true
  return ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(parent.tagName) || Boolean(parent.closest('[data-no-global-i18n]'))
}

function apply(lang: Lang) {
  document.documentElement.lang = lang
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    if (shouldSkip(node)) continue
    const next = translate(node.nodeValue ?? '', lang)
    if (next !== node.nodeValue) node.nodeValue = next
  }

  document.querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]').forEach(el => {
    for (const attr of ['placeholder', 'title', 'aria-label']) {
      const value = el.getAttribute(attr)
      if (!value) continue
      const next = translate(value, lang)
      if (next !== value) el.setAttribute(attr, next)
    }
  })
}

export default function LegacySurfaceLanguageFix() {
  useEffect(() => {
    let applying = false
    let queued = false
    const getLang = (): Lang => window.localStorage.getItem('prohouse-lang') === 'ru' ? 'ru' : 'uz'
    const run = () => {
      if (applying) return
      applying = true
      apply(getLang())
      applying = false
    }
    const schedule = () => {
      if (queued) return
      queued = true
      window.requestAnimationFrame(() => { queued = false; run() })
    }
    const onLanguageChange = () => run()
    const onStorage = (event: StorageEvent) => { if (event.key === 'prohouse-lang') run() }

    run()
    window.addEventListener('prohouse-language-change', onLanguageChange)
    window.addEventListener('storage', onStorage)
    const observer = new MutationObserver(() => schedule())
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('prohouse-language-change', onLanguageChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return null
}
