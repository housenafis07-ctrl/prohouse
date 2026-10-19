'use client'

import { useEffect } from 'react'
import { useI18n } from './I18nProvider'

type Pair = [string, string]

const PAIRS: Pair[] = [
  ['Royalhouse’ga kirish', 'Вход в Royalhouse'],
  ['Profilni to‘ldirish', 'Заполнить профиль'],
  ['Telefon raqamingiz orqali davom eting.', 'Продолжите с помощью номера телефона.'],
  ['Telefon raqamingiz tasdiqlandi.', 'Номер телефона подтверждён.'],
  ['Telefon raqami', 'Номер телефона'],
  ['SMS yuborish', 'Отправить SMS'],
  ['Qayta yuborish', 'Отправить повторно'],
  ['SMS kodi', 'SMS-код'],
  ['Kirish', 'Войти'],
  ['Davom etish orqali siz ', 'Продолжая, вы '],
  ['Ommaviy Oferta Shartlariga', 'условия Публичной оферты'],
  [' rozilik bildirasiz.', ' соглашаетесь.'],
  ['Telefon raqamini to‘liq kiriting.', 'Введите полный номер телефона.'],
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
  ['Yakka tartibdagi tadbirkor — YaTT', 'Индивидуальный предприниматель — ИП'],
  ['Mas’uliyati cheklangan jamiyat — MChJ', 'Общество с ограниченной ответственностью — ООО'],
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
    const path = window.location.pathname
    if (path !== '/register' && path !== '/realtors/cabinet') return

    let frame = 0
    let lastApplied = ''
    let webOtpAbort: AbortController | null = null
    let bridge: HTMLInputElement | null = null

    const findOtpInputs = () => {
      const labeled = Array.from(document.querySelectorAll<HTMLInputElement>('input')).filter((input) => {
        const label = (input.getAttribute('aria-label') || '').toLowerCase()
        return label.includes('sms kodi') || label.includes('sms-код')
      })
      if (labeled.length >= 6) return labeled.slice(0, 6)

      const otpInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[autocomplete="one-time-code"]'))
      return otpInputs.slice(0, 6)
    }

    const makeEligible = (input: HTMLInputElement) => {
      input.setAttribute('autocomplete', 'one-time-code')
      input.setAttribute('name', 'one-time-code')
      input.setAttribute('inputmode', 'numeric')
      input.setAttribute('pattern', '[0-9]*')
      input.setAttribute('enterkeyhint', 'done')
    }

    const setNativeValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, value)
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: value,
      }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }

    const applyCode = (raw: string) => {
      const code = raw.replace(/\D/g, '').slice(0, 6)
      if (code.length !== 6 || code === lastApplied) return

      const inputs = findOtpInputs()
      if (inputs.length < 6) return

      lastApplied = code
      makeEligible(inputs[0])
      setNativeValue(inputs[0], code)

      window.setTimeout(() => {
        const current = findOtpInputs()
        if (current.length < 6) return
        current.forEach((input, index) => {
          setNativeValue(input, code[index])
        })
        current[5]?.focus()
      }, 0)
    }

    const ensureBridge = () => {
      if (bridge?.isConnected) return bridge
      bridge = document.createElement('input')
      bridge.type = 'text'
      bridge.autocomplete = 'one-time-code'
      bridge.inputMode = 'numeric'
      bridge.name = 'one-time-code'
      bridge.setAttribute('aria-label', 'SMS kodi')
      bridge.setAttribute('data-royalhouse-otp-bridge', 'true')
      bridge.style.position = 'fixed'
      bridge.style.left = '-10000px'
      bridge.style.top = '0'
      bridge.style.width = '1px'
      bridge.style.height = '1px'
      bridge.style.opacity = '0.01'
      bridge.style.pointerEvents = 'none'
      document.body.appendChild(bridge)
      return bridge
    }

    const readNativeValues = () => {
      const inputs = findOtpInputs()
      if (inputs.length < 6) return

      const first = inputs[0].value.replace(/\D/g, '').slice(0, 6)
      if (first.length === 6) {
        applyCode(first)
        return
      }

      const bridgeValue = bridge?.value.replace(/\D/g, '').slice(0, 6) || ''
      if (bridgeValue.length === 6) applyCode(bridgeValue)
    }

    const onBridgeInput = () => readNativeValues()

    const startWebOtp = () => {
      if (!('OTPCredential' in window) || !navigator.credentials?.get) return
      webOtpAbort?.abort()
      webOtpAbort = new AbortController()

      const listen = async () => {
        try {
          const credential = await navigator.credentials.get({
            otp: { transport: ['sms'] },
            signal: webOtpAbort?.signal,
          } as CredentialRequestOptions & { otp: { transport: string[] } }) as (Credential & { code?: string }) | null
          if (credential?.code) applyCode(credential.code)
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
          console.debug('[otp-autofill] WebOTP unavailable', error)
        }
      }
      void listen()
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
        makeEligible(inputs[0])
        ensureBridge()
        startWebOtp()
      }
    }

    const bridgeInput = ensureBridge()
    bridgeInput.addEventListener('input', onBridgeInput)
    bridgeInput.addEventListener('change', onBridgeInput)
    document.addEventListener('input', readNativeValues, true)
    document.addEventListener('change', readNativeValues, true)

    apply()
    const observer = new MutationObserver(() => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        apply()
        readNativeValues()
      })
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const poll = window.setInterval(readNativeValues, 100)

    return () => {
      observer.disconnect()
      window.clearInterval(poll)
      document.removeEventListener('input', readNativeValues, true)
      document.removeEventListener('change', readNativeValues, true)
      bridgeInput.removeEventListener('input', onBridgeInput)
      bridgeInput.removeEventListener('change', onBridgeInput)
      webOtpAbort?.abort()
      bridge?.remove()
      bridge = null
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [lang])

  return null
}
