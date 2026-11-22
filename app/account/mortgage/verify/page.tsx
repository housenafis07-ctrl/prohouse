'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/app/components/I18nProvider'

export default function MortgageIdentityPage() {
  const params = useSearchParams()
  const leadId = params.get('leadId') || ''
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const [pinfl, setPinfl] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [passportSeriesNumber, setPassportSeriesNumber] = useState('')
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const t = (uz: string, russian: string) => ru ? russian : uz
  async function submit() {
    setError('')
    if (!leadId) { setError(t('Ariza raqami topilmadi.','Не найдена заявка.')); return }
    if (!front || !back || !selfie) { setError(t('Uchala rasmni ham yuklang.','Загрузите все три изображения.')); return }
    if (!consent) { setError(t('Ma’lumotlarni qayta ishlashga rozilik bering.','Подтвердите согласие на обработку данных.')); return }
    const form = new FormData()
    form.set('leadId', leadId)
    form.set('pinfl', pinfl)
    form.set('dateOfBirth', dateOfBirth)
    form.set('passportSeriesNumber', passportSeriesNumber)
    form.set('consent', 'true')
    form.set('front', front)
    form.set('back', back)
    form.set('selfie', selfie)
    setBusy(true)
    try {
      const response = await fetch('/api/mortgage/identity', { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || t('Yuborishda xatolik.','Ошибка отправки.'))
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Yuborishda xatolik.','Ошибка отправки.'))
    } finally { setBusy(false) }
  }

  const fileInput = (label: string, file: File | null, setter: (file: File | null) => void) => (
    <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold">
      <span>{label}</span>
      <input className="mt-2 block w-full text-xs" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => setter(e.target.files?.[0] || null)} />
      <span className="mt-1 block text-xs font-normal text-slate-500">{file ? file.name : t('JPG, PNG yoki WebP · 5 MB gacha','JPG, PNG или WebP · до 5 МБ')}</span>
    </label>
  )

  return <main className="min-h-screen bg-slate-50 px-4 py-8">
    <div className="mx-auto max-w-2xl">
      <Link href="/account/mortgage" className="text-sm font-bold text-emerald-700">← {t('Ipoteka arizalarim','Мои ипотечные заявки')}</Link>
      <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm sm:p-8">
        <p className="text-sm font-black text-emerald-700">RoyalHouse · Mortgage</p>
        <h1 className="mt-2 text-2xl font-black">{t('Shaxsni tasdiqlash','Подтверждение личности')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{t('Arizangizni ko‘rib chiqish uchun quyidagi ma’lumotlar va hujjat rasmlarini yuboring. Hujjatlar yopiq saqlanadi.','Для рассмотрения заявки отправьте данные и изображения документов. Файлы хранятся в закрытом хранилище.')}</p>
        {done ? <div className="mt-6 rounded-2xl bg-emerald-50 p-5 font-bold text-emerald-800">{t('Ma’lumot va hujjatlar qabul qilindi. Ariza holatini shaxsiy kabinetingizda kuzatishingiz mumkin.','Данные и документы получены. Статус заявки можно отслеживать в личном кабинете.')}<Link className="mt-4 block underline" href="/account/mortgage">{t('Arizalarimga qaytish','Вернуться к заявкам')}</Link></div> : <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">JSHSHIR / PINFL
              <input value={pinfl} onChange={e=>setPinfl(e.target.value.replace(/\D/g,'').slice(0,14))} inputMode="numeric" maxLength={14} placeholder="14 ta raqam" className="mt-2 w-full rounded-xl border px-4 py-3" />
            </label>
            <label className="text-sm font-bold">{t('Tug‘ilgan sana','Дата рождения')}
              <input type="date" value={dateOfBirth} onChange={e=>setDateOfBirth(e.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" />
            </label>
            <label className="text-sm font-bold sm:col-span-2">{t('Pasport seriyasi va raqami','Серия и номер паспорта')}
              <input value={passportSeriesNumber} onChange={e=>setPassportSeriesNumber(e.target.value.toUpperCase().replace(/\s/g,'').slice(0,9))} placeholder="AA1234567" maxLength={9} className="mt-2 w-full rounded-xl border px-4 py-3" />
            </label>
          </div>
          <h2 className="mt-7 text-lg font-black">{t('Hujjat rasmlari','Изображения документов')}</h2>
          <div className="mt-3 grid gap-3">
            {fileInput(t('1. Pasport / ID karta — old tomoni','1. Паспорт / ID-карта — лицевая сторона'),front,setFront)}
            {fileInput(t('2. Pasport / ID karta — orqa tomoni','2. Паспорт / ID-карта — обратная сторона'),back,setBack)}
            {fileInput(t('3. Hujjatni qo‘lda ushlab tushgan selfi','3. Селфи с документом в руках'),selfie,setSelfie)}
          </div>
          <label className="mt-5 flex items-start gap-3 text-xs leading-5 text-slate-600">
            <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1" />
            <span>{t('Men JSHSHIR, tug‘ilgan sana, pasport ma’lumotlari va yuklangan rasmlarni ipoteka arizamni ko‘rib chiqish, shaxsni tasdiqlash hamda tanlangan bankka yuborish maqsadida qayta ishlashga roziman.','Я согласен(на) на обработку ПИНФЛ, даты рождения, паспортных данных и загруженных изображений для рассмотрения ипотечной заявки, подтверждения личности и передачи выбранному банку.')}</span>
          </label>
          {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
          <button disabled={busy} onClick={()=>void submit()} className="mt-6 w-full rounded-xl bg-emerald-700 px-5 py-3.5 font-black text-white disabled:opacity-50">{busy ? t('Yuborilmoqda...','Отправка...') : t('Hujjatlarni xavfsiz yuborish','Безопасно отправить документы')}</button>
        </>}
      </section>
    </div>
  </main>
}
