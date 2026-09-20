export type Lang = 'uz' | 'ru'

export const DEFAULT_LANG: Lang = 'uz'
export const LANG_STORAGE_KEY = 'prohouse-lang'
export const LANG_EVENT = 'prohouse-language-change'

const dictionary = {
  uz: {
    backToMonetization: '← Monetizatsiya',
    checkout: 'Checkout',
    promoteListing: 'E’lonni ilgari surish',
    checkoutDescription: 'Mahsulotni va e’lonni tanlang. Hozircha real to‘lov yechib olinmaydi — payment provider ulanganda shu buyurtma to‘lov oynasiga ulanadi.',
    product: 'Mahsulot',
    listing: 'E’lon',
    order: 'Buyurtma',
    total: 'Jami',
    paymentMethod: 'To‘lov usulini tanlang',
    payWithClick: 'Click orqali to‘lash',
    payWithPayme: 'Payme orqali to‘lash',
    redirectingPayment: 'To‘lov sahifasiga yo‘naltirilmoqda…',
    selectProduct: 'Mahsulot tanlang.',
    selectListing: 'E’lonni tanlang...',
    listingNotSelected: 'Tanlanmagan',
    noName: 'Nomsiz e’lon',
    loading: 'Yuklanmoqda...',
    createOrder: 'Buyurtma yaratish',
    creatingOrder: 'Buyurtma yaratilmoqda...',
    orderCreated: 'Buyurtma yaratildi',
    status: 'Holat',
    paymentPendingProvider: 'To‘lov provayderi ulanmaguncha to‘lov oynasi ko‘rsatilmaydi.',
    chooseListingFirst: 'Avval ilgari suriladigan e’lonni tanlang.',
    noProducts: 'Hozircha sotuvga yoqilgan mahsulot yo‘q. Admin katalogda mahsulotni faollashtirgach checkout ishlaydi.',
    noListings: 'Ilgari surish uchun faol yoki moderatsiyadagi e’loningiz bo‘lishi kerak.',
    day: 'kun',
    sum: 'so‘m',
    buy: 'Sotib olish',
    account: 'Shaxsiy kabinet',
    monetization: 'Monetizatsiya',
    error: 'Xatolik',
  },
  ru: {
    backToMonetization: '← Монетизация',
    checkout: 'Оформление заказа',
    promoteListing: 'Продвижение объявления',
    checkoutDescription: 'Выберите продукт и объявление. Сейчас реальные деньги не списываются — после подключения платёжного провайдера заказ будет передан в окно оплаты.',
    product: 'Продукт',
    listing: 'Объявление',
    order: 'Заказ',
    total: 'Итого',
    paymentMethod: 'Выберите способ оплаты',
    payWithClick: 'Оплата через приложение Click или банковскую карту',
    payWithPayme: 'Оплата через приложение Payme или банковскую карту',
    redirectingPayment: 'Переход на страницу оплаты…',
    selectProduct: 'Выберите продукт.',
    selectListing: 'Выберите объявление...',
    listingNotSelected: 'Не выбрано',
    noName: 'Объявление без названия',
    loading: 'Загрузка...',
    createOrder: 'Создать заказ',
    creatingOrder: 'Создание заказа...',
    orderCreated: 'Заказ создан',
    status: 'Статус',
    paymentPendingProvider: 'Окно оплаты не будет показано, пока платёжный провайдер не подключён.',
    chooseListingFirst: 'Сначала выберите объявление для продвижения.',
    noProducts: 'Сейчас нет доступных для продажи продуктов. Checkout заработает после активации продукта в каталоге администратором.',
    noListings: 'Для продвижения нужно активное объявление или объявление на модерации.',
    day: 'дн.',
    sum: 'сум',
    buy: 'Купить',
    account: 'Личный кабинет',
    monetization: 'Монетизация',
    error: 'Ошибка',
  },
} as const

export type I18nKey = keyof typeof dictionary.uz

export function translate(lang: Lang, key: I18nKey): string {
  return dictionary[lang][key]
}

export function pickLocalized<T extends string | null | undefined>(lang: Lang, uz: T, ru: T): T {
  if (lang === 'ru') return ru || uz
  return uz || ru
}

export function getStoredLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG
  return window.localStorage.getItem(LANG_STORAGE_KEY) === 'ru' ? 'ru' : DEFAULT_LANG
}
