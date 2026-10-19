'use client'

import { useEffect } from 'react'
import { useI18n } from './I18nProvider'

type Pair = [string, string]
type OTPCredential = Credential & { code?: string }
type OTPOptions = CredentialRequestOptions & { otp: { transport: ['sms'] }; signal?: AbortSignal }

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
  ['Rahbar F.I.O.', 'Ф.И.О. руководителя'], ['Bank rekvizitlari', 'Банковские реквизиты'], ['Bank nomi', 'Название банка'], ['Hisob raqami', 'Номер счёta'],
  ['Saqlanmoqda...', 'Сохранение...'], ['Ro‘yxatdan o‘tish', 'Зарегистрироваться'],
  ['Ommaviy oferta yuklanmadi. Sahifani yangilang va qayta urinib ko‘ring.', 'Публичная оферта не загружan. Обновите страницу va qayta urinib ko‘ring.'],
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
    let otpController: AbortController | null = null
    let otpStarted = false

    const findOtpInputs = () => {
      const byAutocomplete = Array.from(document.querySelectorAll<HTMLInputElement>('input[autocomplete="one-time-code"]'))
      if (byAutocomplete.length) return byAutocomplete.slice(0, 6)

      const smsInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input')).filter((input) => {
        const label = input.getAttribute('aria-label')?.toLowerCase() || ''
        return label.includes('sms kodi') || label.includes('sms-код')
      })
      return smsInputs.slice(0, 6)
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
      if (!code) return
      const inputs = findOtpInputs().slice(0, 6)
      if (!inputs.length) return

      inputs.forEach((input, index) => {
        if (index === 0) makeOtpAutofillEligible(input)
        writeValue(input, code[index] || '')
      })

      const last = inputs[Math.min(code.length - 1, inputs.length - 1)]
      last?.focus()
    }

    const startNativeWebOtp = async () => {
      if (otpStarted) return
      if (!('OTPCredential' in window) || !navigator.credentials?.get) return

      const inputs = findOtpInputs()
      if (!inputs.length) return

      makeOtpAutofillEligible(inputs[0])
      otpController?.abort()
      otpController = new AbortController()
      otpStarted = true

      try {
        const credential = await navigator.credentials.get({
          otp: { transport: ['sms'] },
          signal: otpController.signal,
        } as OTPOptions) as OTPCredential | null

        const code = credential?.code
        if (code) applyOtpToSixInputs(code)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.debug('[otp-autofill] WebOTP unavailable', error)
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
      if (inputs.length) {
        makeOtpAutofillEligible(inputs[0])
        void startNativeWebOtp()
      }
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

    return () => {
      observer.disconnect()
      otpController?.abort()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [lang])

  return null
}
