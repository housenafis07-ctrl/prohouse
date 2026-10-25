'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function PhoneVerificationModal({
  lang,
  currentPhone,
  onDone,
}: {
  lang: 'uz' | 'ru'
  currentPhone: string | null
  onDone?: () => void
}) {
  const ru = lang === 'ru'
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState(currentPhone || '+998')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const close = () => {
    if (busy) return
    setOpen(false)
    setStep('phone')
    setCode('')
    setError('')
    setSuccess('')
  }

  async function sendCode() {
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const response = await fetch('/api/account/phone/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || (ru ? 'Не удалось отправить SMS.' : 'SMS yuborilmadi.'))
      setStep('code')
      setSuccess(ru ? 'SMS-код отправлен.' : 'SMS kodi yuborildi.')
    } catch (e) {
      setError(e instanceof Error ? e.message : (ru ? 'Ошибка отправки SMS.' : 'SMS yuborishda xatolik.'))
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode() {
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      const response = await fetch('/api/account/phone/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || (ru ? 'Не удалось подтвердить номер.' : 'Telefon raqamini tasdiqlab bo‘lmadi.'))

      if (data?.session?.access_token && data?.session?.refresh_token) {
        const { error: sessionError } = await createClient().auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
        if (sessionError) throw sessionError
      }

      setSuccess(ru ? 'Номер телефона подтверждён.' : 'Telefon raqami tasdiqlandi.')
      onDone?.()
      window.setTimeout(() => window.location.reload(), 250)
    } catch (e) {
      setError(e instanceof Error ? e.message : (ru ? 'Не удалось подтвердить номер.' : 'Telefon raqamini tasdiqlab bo‘lmadi.'))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button
      type="button"
      onClick={() => { setPhone(currentPhone || '+998'); setOpen(true); setError(''); setSuccess(''); setStep('phone'); setCode('') }}
      className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-emerald-700"
    >
      {currentPhone ? (ru ? 'Изменить номер' : 'Telefon raqamini o‘zgartirish') : (ru ? 'Добавить номер телефона' : 'Telefon raqamini qo‘shish')}
    </button>

    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900">{ru ? 'Подтверждение телефона' : 'Telefon raqamini tasdiqlash'}</h3>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {ru ? 'Telegram ID va telefon raqamingizni bitta RoyalHouse profiliga bog‘laymiz.' : 'Telegram ID va telefon raqamingizni bitta RoyalHouse profiliga bog‘laymiz.'}
            </p>
          </div>
          <button type="button" onClick={close} className="rounded-xl bg-slate-100 px-3 py-2 text-slate-600">✕</button>
        </div>

        {step === 'phone' ? <>
          <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-slate-400">{ru ? 'Номер телефона' : 'Telefon raqami'}</label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="+998 90 123 45 67"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg font-bold text-slate-900 outline-none focus:border-emerald-500"
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">{ru ? 'Номер должен принадлежать вам. После подтверждения он будет привязан к этому профилю.' : 'Raqam sizga tegishli bo‘lishi kerak. Tasdiqlangach shu profilga bog‘lanadi.'}</p>
          <button type="button" onClick={sendCode} disabled={busy} className="mt-5 w-full rounded-2xl bg-emerald-600 px-5 py-3.5 font-extrabold text-white disabled:opacity-50">
            {busy ? (ru ? 'Отправка...' : 'Yuborilmoqda...') : (ru ? 'Получить SMS-код' : 'SMS kod olish')}
          </button>
        </> : <>
          <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
            {ru ? `Код отправлен на ${phone}.` : `${phone} raqamiga kod yuborildi.`}
          </div>
          <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-400">{ru ? 'Код из SMS' : 'SMS kodi'}</label>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-center text-2xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-emerald-500"
          />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => { setStep('phone'); setError(''); setSuccess('') }} disabled={busy} className="rounded-2xl border border-slate-200 px-4 py-3 font-bold text-slate-700 disabled:opacity-50">{ru ? 'Изменить номер' : 'Raqamni o‘zgartirish'}</button>
            <button type="button" onClick={verifyCode} disabled={busy || code.length !== 6} className="rounded-2xl bg-emerald-600 px-4 py-3 font-extrabold text-white disabled:opacity-50">{busy ? (ru ? 'Проверка...' : 'Tekshirilmoqda...') : (ru ? 'Подтвердить' : 'Tasdiqlash')}</button>
          </div>
        </>}

        {error && <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
        {success && <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</div>}
      </div>
    </div>}
  </>
}
