'use client'

import { useEffect } from 'react'
import { useI18n } from './I18nProvider'

type Pair = [string, string]

const PAIRS: Pair[] = [
  ['Royalhouse’ga kirish', 'Вход в Royalhouse'],
  ['Royalhouse’ga kirish', 'Вход в Royalhouse'],
  ['Profilni to‘ldirish', 'Заполнить профиль'],
  ['Telefon raqamingiz orqali davom eting.', 'Продолжите с помощью номера телефона.'],
  ['Telefon raqamingiz tasdiqlandi.', 'Номер телефона подтверждён.'],
  ['Telefon raqami', 'Номер телефона'],
  ['SMS yuborish', 'Отправить SMS'],
  ['Qayta yuborish', 'Отправить повторно'],
  ['SMS kodi', 'SMS-код'],
  ['Kirish', 'Войти'],
  ['Продолжить orqali siz ', 'Продолжая, вы принимаете '],
  ['Davom etish orqali siz ', 'Продолжая, вы принимаете '],
  ['Ommaviy Oferta Shartlariga', 'условия Публичной оферты'],
  [' rozilik bildirasiz.', ' соглашаетесь.'],
  ['Telefon raqamini to‘liq kiriting.', 'Введите номер телефона полностью.'],
  ['SMS kodi yuborildi.', 'SMS-код отправлен.'],
  ['SMS yuborilmadi', 'Не удалось отправить SMS'],
  ['SMS yuborishda xatolik', 'Ошибка при отправке SMS'],
  ['SMS kodini kiriting.', 'Введите SMS-код.'],
  ['Kod noto‘g‘ri', 'Неверный код'],
  ['Tasdiqlashda xatolik', 'Ошибка подтверждения'],
  ['Telefon raqami tasdiqlandi. Endi profil ma’lumotlarini kiriting.', 'Номер телефона подтверждён. Теперь заполните данные профиля.'],
  ['Jismoniy shaxs', 'Физическое лицо'],
  ['Hamkor', 'Партнёр'],
  ['Hamkor turi', 'Тип партнёра'],
  ['O‘zini o‘zi band qilgan — O‘BQ', 'Самозанятый — O‘BQ'],
  ['Yakka tartibdagi tadbirkor — YaTT', 'Индивидуальный предприниматель — YaTT'],
  ['Mas’uliyati cheklangan jamiyat — MChJ', 'Общество с ограниченной ответственностью — MChJ'],
  ['Tashkilot nomi', 'Название организации'],
  ['Rahbar F.I.O.', 'Ф.И.О. руководителя'],
  ['Bank rekvizitlari', 'Банковские реквизиты'],
  ['Bank nomi', 'Название банка'],
  ['Hisob raqami', 'Номер счёта'],
  ['Saqlanmoqda...', 'Сохранение...'],
  ['Ro‘yxatdan o‘tish', 'Зарегистрироваться'],
  ['Ommaviy oferta yuklanmadi. Sahifani yangilang va qayta urinib ko‘ring.', 'Публичная оферта не загружена. Обновите страницу и попробуйте снова.'],
  ['Avval telefon raqamini tasdiqlang.', 'Сначала подтвердите номер телефона.'],
  ['Sessiya topilmadi. Qayta kirib ko‘ring.', 'Сессия не найдена. Войдите снова.'],
  ['Foydalanuvchi sessiyasi topilmadi.', 'Сессия пользователя не найдена.'],
  ['Sessiya ma’lumotlari qaytmadi.', 'Данные сессии не получены.'],
  ['Ro‘yxatdan o‘tishda xatolik', 'Ошибка регистрации'],
  ['Yopish', 'Закрыть'],
]

function translateText(value: string, lang: 'uz' | 'ru') {
  const normalized = value.trim()
  if (!normalized) return value
  const pair = PAIRS.find(([uz, ru]) => (lang === 'ru' ? ru : uz) === normalized)
  if (pair) return lang === 'ru' ? pair[1] : pair[0]

  for (const [uz, ru] of PAIRS) {
    if (lang === 'ru' && value.includes(uz)) return value.replace(uz, ru)
    if (lang === 'uz' && value.includes(ru)) return value.replace(ru, uz)
  }
  return value
}

export default function AuthLanguageFix() {
  const { lang } = useI18n()

  useEffect(() => {
    if (window.location.pathname !== '/register') return

    let frame = 0
    const apply = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const nodes: Text[] = []
      let node: Node | null
      while ((node = walker.nextNode())) {
        const text = node as Text
        if (text.parentElement?.closest('script,style')) continue
        nodes.push(text)
      }
      nodes.forEach((text) => {
        const current = text.nodeValue ?? ''
        const next = translateText(current, lang)
        if (next !== current) text.nodeValue = next
      })
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        apply()
      })
    }

    apply()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [lang])

  return null
}
