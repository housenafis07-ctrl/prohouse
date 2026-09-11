'use client'

import { useEffect } from 'react'

type Lang = 'uz' | 'ru'

type Pair = [string, string]

// This is a compatibility bridge for legacy pages that still render literal UI
// strings instead of consuming a shared i18n dictionary. It is intentionally
// limited to exact UI phrases so listing titles, descriptions, addresses and
// user-entered content are never translated.
const PAIRS: Pair[] = [
  ['Kabinet', 'Кабинет'],
  ['Shaxsiy kabinet', 'Личный кабинет'],
  ['Saqlanganlar', 'Избранное'],
  ['Saqlangan qidiruvlar', 'Сохранённые поиски'],
  ['E’lon joylashtirish', 'Разместить объявление'],
  ['Mening e’lonlarim', 'Мои объявления'],
  ['Xabarlar', 'Сообщения'],
  ['Ishonchli profil', 'Надёжный профиль'],
  ['Hisob va tranzaksiyalar', 'Счёт и транзакции'],
  ['E’lonlarni ko‘rish', 'Смотреть объявления'],
  ['E’lonlarim', 'Мои объявления'],
  ['E’lonlar', 'Объявления'],
  ['Bosh sahifa', 'Главная'],
  ['Chiqish', 'Выйти'],
  ['Kirish', 'Войти'],
  ['Ro‘yxatdan o‘tish', 'Регистрация'],
  ['Qidirish', 'Поиск'],
  ['Filtrlar', 'Фильтры'],
  ['Filtrni tozalash', 'Сбросить фильтры'],
  ['Barchasi', 'Все'],
  ['Sotib olish', 'Купить'],
  ['Ijara', 'Аренда'],
  ['Kunlik', 'Посуточно'],
  ['Yangi binolar', 'Новостройки'],
  ['Yangi bino', 'Новостройка'],
  ['Xususiy uy', 'Частный дом'],
  ['Kvartira', 'Квартира'],
  ['Yer', 'Земля'],
  ['Tijorat', 'Коммерческая недвижимость'],
  ['Egadan', 'От собственника'],
  ['Tasdiqlangan', 'Подтверждено'],
  ['Ipotekaga mumkin', 'Подходит для ипотеки'],
  ['Faol', 'Активно'],
  ['O‘chiq', 'Выключено'],
  ['Qoralama', 'Черновик'],
  ['Moderatsiyada', 'На модерации'],
  ['Rad etilgan', 'Отклонено'],
  ['Sotilgan', 'Продано'],
  ['Ijaraga berilgan', 'Сдано в аренду'],
  ['Arxiv', 'Архив'],
  ['Ko‘rish', 'Просмотр'],
  ['Tahrirlash', 'Редактировать'],
  ['Yopish', 'Закрыть'],
  ['Yuklanmoqda...', 'Загрузка...'],
  ['Xatolik', 'Ошибка'],
  ['Saqlash', 'Сохранить'],
  ['Saqlangan', 'Сохранено'],
  ['O‘chirish', 'Удалить'],
  ['Ochish', 'Открыть'],
  ['Yoqish', 'Включить'],
  ['Pauza', 'Пауза'],
  ['Bekor qilish', 'Отменить'],
  ['Davom etish', 'Продолжить'],
  ['Orqaga', 'Назад'],
  ['Keyingi bosqich', 'Следующий шаг'],
  ['Holat', 'Статус'],
  ['Ma’lumotlar', 'Данные'],
  ['Shaxsiy ma’lumotlar', 'Личные данные'],
  ['Tahrirlash', 'Редактировать'],
  ['Profil ma’lumotlari saqlandi.', 'Данные профиля сохранены.'],
  ['F.I.O. ni kiriting.', 'Введите Ф.И.О.'],
  ['INN ni kiriting.', 'Введите ИНН.'],
  ['Profilni to‘ldirish', 'Заполнить профиль'],
  ['Akkount holati', 'Состояние аккаунта'],
  ['Akkaunt faol', 'Аккаунт активен'],
  ['Telefon raqami tasdiqlangan', 'Номер телефона подтверждён'],
  ['Profil to‘liqligi', 'Заполненность профиля'],
  ['Keyingi qadamlar', 'Следующие шаги'],
  ['Uy topishni boshlash', 'Начать поиск жилья'],
  ['Profilni to‘ldirish', 'Заполнить профиль'],
  ['Yordam kerakmi?', 'Нужна помощь?'],
  ['Bosh sahifaga qaytish', 'Вернуться на главную'],
  ['Saqlangan e’lonlar', 'Сохранённые объявления'],
  ['Sizga yoqqan uylar va boshqa ko‘chmas mulklarni bir joyda saqlang.', 'Сохраняйте понравившиеся дома и другую недвижимость в одном месте.'],
  ['Hali saqlangan e’lon yo‘q', 'Сохранённых объявлений пока нет'],
  ['E’lon kartasidagi yurak tugmasi orqali qiziqqan variantlaringizni saqlang.', 'Сохраняйте интересующие варианты кнопкой с сердцем на карточке объявления.'],
  ['Saqlanganlardan olib tashlash', 'Удалить из сохранённых'],
  ['Rasm yo‘q', 'Нет изображения'],
  ['Saqlangan qidiruvlar', 'Сохранённые поиски'],
  ['Muhim filtrlarni saqlang. Keyin bir bosishda aynan shu qidiruvni qayta ochishingiz mumkin.', 'Сохраняйте важные фильтры и открывайте этот поиск снова одним нажатием.'],
  ['Hali saqlangan qidiruv yo‘q', 'Сохранённых поисков пока нет'],
  ['Qidirishni boshlash', 'Начать поиск'],
  ['Monetizatsiya', 'Монетизация'],
  ['Mahsulot katalogi', 'Каталог продуктов'],
  ['Entitlementlar', 'Доступы'],
  ['Individual bepul limit', 'Бесплатный лимит для физлица'],
  ['Faol entitlement', 'Активные доступы'],
  ['Provider tayyorlanmoqda', 'Провайдер готовится'],
  ['Hozircha sotuvga yoqilgan monetizatsiya mahsuloti yo‘q.', 'Пока нет доступных для продажи продуктов монетизации.'],
  ['Qoldiq:', 'Остаток:'],
  ['ProHouse hisob raqami', 'Номер счёта ProHouse'],
  ['Balansni to‘ldirish', 'Пополнение баланса'],
  ['Tranzaksiyalar tarixi', 'История транзакций'],
  ['Balansdagi barcha moliyaviy operatsiyalar.', 'Все финансовые операции по балансу.'],
  ['Hozircha tranzaksiyalar mavjud emas.', 'Пока транзакций нет.'],
  ['Ishonchli profil dasturiga qo‘shilish hali boshlanmagan.', 'Подключение к программе надёжного профиля ещё не началось.'],
  ['So‘rov yuborildi', 'Запрос отправлен'],
  ['Profilingiz tekshiruv navbatiga qo‘yildi.', 'Ваш профиль поставлен в очередь на проверку.'],
  ['Tasdiqlash jarayonida', 'На проверке'],
  ['MyID va boshqa zarur tekshiruvlar yakunlanmoqda.', 'Завершаются проверки MyID и другие необходимые проверки.'],
  ['Profilingiz ishonchli sifatida tasdiqlangan.', 'Ваш профиль подтверждён как надёжный.'],
  ['Tasdiqlanmadi', 'Не подтверждено'],
  ['Tekshiruv natijasida qo‘shimcha ma’lumot talab qilinishi mumkin.', 'По результатам проверки может потребоваться дополнительная информация.'],
  ['MyID orqali tasdiqlash', 'Подтвердить через MyID'],
  ['Tasdiqlanmagan', 'Не подтверждено'],
  ['Kutilmoqda', 'Ожидается'],
  ['Ixtiyoriy dastur', 'Добровольная программа'],
  ['Tekshiruv kutilmoqda', 'Проверка ожидается'],
  ['Ishonchli profilga qo‘shilish', 'Присоединиться к программе надёжного профиля'],
  ['Belgi qayerda ko‘rinadi?', 'Где отображается значок?'],
  ['Xizmatlar', 'Услуги'],
  ['Kerakli xizmat yo‘nalishini tanlang', 'Выберите нужную услугу'],
  ['Xizmat', 'Услуга'],
  ['Xizmatlarga qaytish', 'Вернуться к услугам'],
  ['Murojaat yuborish', 'Отправить заявку'],
  ['Telefon', 'Телефон'],
  ['Email', 'Электронная почта'],
  ['Manzil', 'Адрес'],
  ['Narx', 'Цена'],
  ['Xona', 'Комната'],
  ['xona', 'комн.'],
  ['kun', 'день'],
  ['oy', 'месяц'],
  ['so‘m', 'сум'],
  ['O‘z / Ru', 'Ru / O‘z'],
  ['Ru / O‘z', 'O‘z / Ru'],
]

const UZ_TO_RU = new Map(PAIRS)
const RU_TO_UZ = new Map(PAIRS.map(([uz, ru]) => [ru, uz]))

function translateText(value: string, lang: Lang) {
  const map = lang === 'ru' ? UZ_TO_RU : RU_TO_UZ
  const exact = map.get(value.trim())
  if (exact) {
    const leading = value.match(/^\s*/)?.[0] ?? ''
    const trailing = value.match(/\s*$/)?.[0] ?? ''
    return `${leading}${exact}${trailing}`
  }

  if (lang === 'ru') {
    return value
      .replace(/^(\d+) ta o‘qilmagan xabar$/, '$1 непрочитанных сообщений')
      .replace(/^(\d+) ta faol mahsulot$/, '$1 активных продуктов')
      .replace(/^(\d+) ta$/, '$1 шт.')
      .replace(/^(\d+) xona$/, '$1 комн.')
      .replace(/^dan (.+)$/, 'от $1')
      .replace(/^gacha (.+)$/, 'до $1')
  }

  return value
    .replace(/^(\d+) непрочитанных сообщений$/, '$1 ta o‘qilmagan xabar')
    .replace(/^(\d+) активных продуктов$/, '$1 ta faol mahsulot')
    .replace(/^(\d+) шт\.$/, '$1 ta')
    .replace(/^(\d+) комн\.$/, '$1 xona')
    .replace(/^от (.+)$/, 'dan $1')
    .replace(/^до (.+)$/, 'gacha $1')
}

function shouldSkip(node: Node) {
  const parent = node.parentElement
  if (!parent) return true
  return ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(parent.tagName) || Boolean(parent.closest('[data-no-global-i18n]'))
}

function applyLanguage(lang: Lang) {
  document.documentElement.lang = lang
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  for (const node of nodes) {
    if (shouldSkip(node)) continue
    const next = translateText(node.nodeValue ?? '', lang)
    if (next !== node.nodeValue) node.nodeValue = next
  }

  const elements = document.querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]')
  elements.forEach((el) => {
    for (const attr of ['placeholder', 'title', 'aria-label']) {
      const value = el.getAttribute(attr)
      if (!value) continue
      const next = translateText(value, lang)
      if (next !== value) el.setAttribute(attr, next)
    }
  })
}

export default function GlobalLanguageFix() {
  useEffect(() => {
    let applying = false
    let queued = false

    const getLang = (): Lang => window.localStorage.getItem('prohouse-lang') === 'ru' ? 'ru' : 'uz'
    const run = () => {
      if (applying) return
      applying = true
      applyLanguage(getLang())
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
