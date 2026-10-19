'use client'

import { useEffect } from 'react'
import { useI18n } from './I18nProvider'

type Pair = [string, string]

const PAIRS: Pair[] = [
  ['Royalhouse’ga kirish', 'Вход в Royalhouse'], ['Royalhouse’ga kirish', 'Вход в Royalhouse'],
  ['Profilni to‘ldirish', 'Заполнить профиль'], ['Telefon raqamingiz orqali davom eting.', 'Продолжите с помощью номера телефона.'],
  ['Telefon raqamingiz tasdiqlandi.', 'Номер телефона подтверждён.'], ['Telefon raqami', 'Номер телефона'],
  ['SMS yuborish', 'Отправить SMS'], ['Qayta yuborish', 'Отправить повторно'], ['SMS kodi', 'SMS-код'], ['Kirish', 'Войти'],
  ['Davom etish orqali siz ', 'Продолжая, вы '], ['Ommaviy Oferta Shartlariga', 'условия Публичной оферты'], [' rozilik bildirasiz.', ' соглашаетесь.'],
  ['Telefon raqamini to‘liq kiriting.', 'Введите полный номер телефона.'], ['SMS kodi yuborildi.', 'SMS-код отправлен.'],
  ['SMS yuborilmadi', 'Не удалось отправить SMS'], ['SMS yuborishda xatolik', 'Ошибка при отправке SMS'], ['SMS kodini kiriting.', 'Введите SMS-код.'],
  ['Kod noto‘g‘ri', 'Неверный код'], ['Tasdiqlashda xatolik', 'Ошибка подтверждения'],
  ['Telefon raqami tasdiqlandi. Endi profil ma’lumotlarini kiriting.', 'Номер телефона подтверждён. Теперь заполните данные профиля.'],
  ['Jismoniy shaxs', 'Физическое лицо'], ['Hamkor', 'Партнёр'], ['Hamkor turi', 'Тип партнёра'],
  ['O‘zini o‘zi band qilgan — O‘BQ', 'Самозанятый — O‘BQ'], ['Yakka tartibdagi tadbirkor — YaTT', 'Индивидуальный предприниматель — ИП'],
  ['Mas’uliyati cheklangan jamiyat — MChJ', 'Общество с ограниченной ответственностью — ООО'], ['Tashkilot nomi', 'Название организации'],
  ['Rahbar F.I.O.', 'Ф.И.О. руководителя'], ['Bank rekvizitlari', 'Банковские реквизиты'], ['Bank nomi', 'Название банка'], ['Hisob raqami', 'Номер счёта'],
  ['Saqlanmoqda...', 'Сохранение...'], ['Ro‘yxatdan o‘tish', 'Зарегистрироваться'],
  ['Ommaviy oferta yuklanmadi. Sahifani yangilang va qayta urinib ko‘ring.', 'Публичная оферта не загружена. Обновите страницу и попробуйте снова.'],
  ['Avval telefon raqamini tasdiqlang.', 'Сначала подтвердите номер телефона.'], ['Sessiya topilmadi. Qayta kirib ko‘ring.', 'Сессия не найдена. Войдите снова.'],
  ['Foydalanuvchi sessiyasi topilmadi.', 'Сессия пользователя не найдена.'], ['Sessiya ma’lumotlari qaytmadi.', 'Данные сессии не получены.'],
  ['Ro‘yxatdan o‘tishda xatolik', 'Ошибка регистрации'], ['Yopish', 'Закрыть'],
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
    const path = window.location.pathname
    if (path !== '/register' && path !== '/realtors/cabinet') return

    let frame = 0
    let lastNativeOtp = ''

    const findOtpInputs = () => {
      const smsInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input')).filter((input) => {
        const label = input.getAttribute('aria-label')?.toLowerCase() || ''
        return label.includes('sms kodi') || label.includes('sms-код')
      })
      if (smsInputs.length) return smsInputs.slice(0, 6)

      return Array.from(document.querySelectorAll<HTMLInputElement>('input[autocomplete="one-time-code"]')).slice(0, 6)
    }

    const makeOtpAutofillEligible = (input: HTMLInputElement) => {
      input.setAttribute('autocomplete', 'one-time-code')
      input.setAttribute('name', 'one-time-code')
      input.setAttribute('aria-label', 'SMS kodi')
      input.setAttribute('enterkeyhint', 'done')
    }

    const writeValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, value)
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: value,
      }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }

    const applyOtpToSixInputs = (otp: string) => {
      const code = otp.replace(/\D/g, '').slice(0, 6)
      if (code.length !== 6) return
      const inputs = findOtpInputs().slice(0, 6)
      if (inputs.length < 6) return

      inputs.forEach((input, index) => {
        if (index === 0) makeOtpAutofillEligible(input)
        writeValue(input, code[index])
      })

      lastNativeOtp = code
      inputs[5]?.focus()
    }

    const syncNativeAutofill = () => {
      const inputs = findOtpInputs().slice(0, 6)
      if (inputs.length < 6) return

      const firstValue = inputs[0].value.replace(/\D/g, '').slice(0, 6)
      if (firstValue.length === 6 && firstValue !== lastNativeOtp) {
        applyOtpToSixInputs(firstValue)
      }
    }

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

      const inputs = findOtpInputs()
      if (inputs.length) makeOtpAutofillEligible(inputs[0])
    }

    apply()
    const observer = new MutationObserver(() => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        apply()
      })
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const nativeAutofillPoll = window.setInterval(syncNativeAutofill, 50)

    return () => {
      observer.disconnect()
      window.clearInterval(nativeAutofillPoll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [lang])

  return null
}
