'use client'

import { useEffect } from 'react'

type Pair = [string, string]

const PAIRS: Pair[] = [
  ['Bo‘lim va turini tanlang.', 'Выберите раздел и тип.'],
  ['Bo‘limni tanlang', 'Выберите раздел'],
  ['Turini tanlang', 'Выберите тип'],
  ['Joylashuvni to‘liq tanlang.', 'Полностью выберите расположение.'],
  ['Xaritadan joylashuvni belgilang.', 'Укажите расположение на карте.'],
  ['E’lon sarlavhasini kiriting.', 'Введите заголовок объявления.'],
  ['To‘g‘ri narx kiriting.', 'Введите корректную цену.'],
  ['E’lonni yuklashda xatolik', 'Ошибка загрузки объявления'],
  ['Kategoriya ma’lumotlari yuklanmadi.', 'Не удалось загрузить данные категорий.'],
  ['E’lon topilmadi', 'Объявление не найдено'],
  ['E’lonni saqlashda xatolik yuz berdi.', 'Произошла ошибка при сохранении объявления.'],
  ['O‘zgarishlar saqlandi va e’lon qayta moderatsiyaga yuborildi.', 'Изменения сохранены, объявление повторно отправлено на модерацию.'],
  ['Qoralama saqlandi.', 'Черновик сохранён.'],
  ['E’lon joylashtirishdagi kabi 7 bosqichda tahrirlang.', 'Редактируйте объявление в тех же 7 шагах, что и при размещении.'],
  ['Tanlovdan so‘ng “Davom etish” tugmasini bosing.', 'После выбора нажмите «Продолжить».'],
  ['Shahar/viloyat', 'Город/область'],
  ['Tuman/shahar', 'Район/город'],
  ['Tanlang', 'Выберите'],
  ['Ko‘cha, uy raqami (ixtiyoriy)', 'Улица, номер дома (необязательно)'],
  ['Mulk egasi', 'Собственник'],
  ['Men ushbu ko‘chmas mulkning egasiman.', 'Я являюсь собственником этой недвижимости.'],
  ['Qavat', 'Этаж'],
  ['Qavatlar soni', 'Количество этажей'],
  ['E’lon sarlavhasi', 'Заголовок объявления'],
  ['Tavsif', 'Описание'],
  ['Narx va shartlar', 'Цена и условия'],
  ['Asosiy kunlik narx', 'Основная цена за сутки'],
  ['Bron avansi: 15%', 'Аванс за бронь: 15%'],
  ['Kalendar kunlari uchun alohida narxlar 4-bosqichda belgilanadi.', 'Отдельные цены по дням календаря задаются на 4-м шаге.'],
  ['Ipotekaga mumkin', 'Подходит для ипотеки'],
  ['Xaridor uchun ipoteka imkoniyati mavjud.', 'Для покупателя доступна ипотека.'],
  ['Mavjud rasmlarni shu yerda boshqaring.', 'Управляйте существующими фотографиями здесь.'],
  ['Rasmlar', 'Фото'],
  ['Tekshirish', 'Проверка'],
  ['Bo‘lim', 'Раздел'],
  ['Joylashuv', 'Расположение'],
  ['Manzil', 'Адрес'],
  ['Mulk egasi', 'Собственник'],
  ['Sarlavha', 'Заголовок'],
  ['O‘zgarishlar “Saqlash va yuborish” bilan saqlanadi', 'Изменения сохраняются кнопкой «Сохранить и отправить»'],
  ['Ijara bron', 'Бронь аренды'],
  ['15% avans, mavjudlik kalendari va bron ma’lumotlari saqlanadi', 'Сохраняются аванс 15%, календарь доступности и данные бронирования'],
  ['“Saqlash va yuborish” bosilganda e’lon va rasmlar o‘zgarishlari saqlanib, e’lon qayta moderatsiyaga yuboriladi.', 'После нажатия «Сохранить и отправить» изменения объявления и фотографий сохраняются, а объявление повторно отправляется на модерацию.'],
  ['Saqlash va yuborish', 'Сохранить и отправить'],
  ['Saqlanmoqda...', 'Сохранение...'],
  ['Yuklanmoqda...', 'Загрузка...'],
  ['Mening e’lonlarim', 'Мои объявления'],
  ['Shaxsiy kabinet', 'Личный кабинет'],
  ['7 bosqichda', 'в 7 шагах'],
]

function translateText(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let current: Node | null = walker.nextNode()
  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }
  for (const node of nodes) {
    const value = node.nodeValue || ''
    const trimmed = value.trim()
    if (!trimmed) continue
    const pair = PAIRS.find(([uz]) => uz === trimmed)
    if (pair) node.nodeValue = value.replace(trimmed, pair[1])
  }
}

export default function EditListingLanguageFix() {
  useEffect(() => {
    const isRussian = () => window.localStorage.getItem('prohouse-lang') === 'ru'
    const run = () => { if (isRussian()) translateText(document.body) }
    run()
    const observer = new MutationObserver(() => run())
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])
  return null
}
