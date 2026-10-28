'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useI18n } from '@/app/components/I18nProvider'

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/account'
  return value
}

export default function AccountLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const next = safeNext(searchParams.get('next'))

  async function sendCode() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || (ru ? 'Не удалось отправить SMS.' : 'SMS yuborib bo‘lmadi.'))
      setStep('code')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ru ? 'Ошибка SMS.' : 'SMS xatosi.'))
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || (ru ? 'Не удалось подтвердить номер.' : 'Telefon raqamini tasdiqlab bo‘lmadi.'))
      if (!data.session) throw new Error(ru ? 'Сессия не создана.' : 'Sessiya yaratilmadi.')
      await createClient().auth.setSession(data.session)
      router.replace(next)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ru ? 'Ошибка подтверждения.' : 'Tasdiqlash xatosi.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-sm font-extrabold text-emerald-700">← {ru ? 'Главная' : 'Bosh sahifa'}</Link>
        <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">ROYALHOUSE</div>
          <h1 className="mt-2 text-3xl font-black text-slate-900">{ru ? 'Вход в личный кабинет' : 'Shaxsiy kabinetga kirish'}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{ru ? 'Введите номер телефона. Мы отправим SMS-код для безопасного входа.' : 'Telefon raqamingizni kiriting. Xavfsiz kirish uchun SMS kod yuboramiz.'}</p>

          <label className="mt-7 block text-xs font-bold uppercase tracking-wide text-slate-400">{ru ? 'Номер телефона' : 'Telefon raqami'}</label>
          <input
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={event => setPhone(event.target.value)}
            disabled={step === 'code' || busy}
            placeholder="+998 90 123 45 67"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 font-semibold outline-none focus:border-emerald-500 disabled:bg-slate-50"
          />

          {step === 'phone' ? (
            <button type="button" onClick={sendCode} disabled={busy || phone.replace(/\D/g, '').length !== 12} className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white disabled:opacity-50">
              {busy ? (ru ? 'Отправка...' : 'Yuborilmoqda...') : (ru ? 'Получить SMS-код' : 'SMS kodini olish')}
            </button>
          ) : (
            <>
              <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-400">{ru ? 'Код из SMS' : 'SMS kodi'}</label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center text-xl font-black tracking-[0.35em] outline-none focus:border-emerald-500"
              />
              <button type="button" onClick={verify} disabled={busy || code.length !== 6} className="mt-4 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white disabled:opacity-50">
                {busy ? (ru ? 'Проверка...' : 'Tekshirilmoqda...') : (ru ? 'Войти в кабинет' : 'Kabinetga kirish')}
              </button>
              <button type="button" onClick={() => { setStep('phone'); setCode(''); setMessage('') }} className="mt-3 w-full rounded-2xl border border-slate-200 px-5 py-3 font-bold text-slate-700">
                {ru ? 'Изменить номер' : 'Raqamni o‘zgartirish'}
              </button>
            </>
          )}

          {message && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</p>}
          <p className="mt-5 text-xs leading-5 text-slate-400">{ru ? 'Telegram не используется для создания или входа в аккаунт. Для доступа к кабинету используется только подтверждение номера телефона по SMS.' : 'Telegram akkaunt yaratish yoki kirish uchun ishlatilmaydi. Kabinetga kirish faqat telefon raqamini SMS orqali tasdiqlash bilan amalga oshiriladi.'}</p>
        </section>
      </div>
    </main>
  )
}
