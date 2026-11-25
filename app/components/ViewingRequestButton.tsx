'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useI18n } from '@/app/components/I18nProvider'

export default function ViewingRequestButton({ listingId }: { listingId: string }) {
  const { lang } = useI18n()
  const router = useRouter()
  const ru = lang === 'ru'
  const [open, setOpen] = useState(false)
  const [requestedAt, setRequestedAt] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [rescheduled, setRescheduled] = useState(false)

  useEffect(() => {
    const next = new Date(Date.now() + 2 * 60 * 60 * 1000)
    next.setMinutes(0, 0, 0)
    const local = new Date(next.getTime() - next.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    setRequestedAt(local)
  }, [])

  const submit = async () => {
    if (!requestedAt || busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/viewing-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, requestedAt: new Date(requestedAt).toISOString(), note }),
      })
      const result = await response.json().catch(() => ({}))
      if (response.status === 401) {
        router.push(`/register?redirect=/listings/${encodeURIComponent(listingId)}`)
        return
      }
      if (!response.ok) throw new Error(result.error || (ru ? 'Не удалось отправить запрос.' : 'So‘rov yuborilmadi.'))
      setRescheduled(Boolean(result.rescheduled))
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : (ru ? 'Ошибка отправки.' : 'Yuborishda xatolik.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="col-span-2">
      <button type="button" onClick={() => { setOpen(true); setSuccess(false); setError('') }} className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-black text-emerald-800 transition hover:bg-emerald-100">
        {ru ? '📅 Записаться на просмотр' : '📅 Ko‘rish vaqtini belgilash'}
      </button>
      {open && typeof document !== 'undefined' && createPortal(<div className="fixed inset-0 z-[10000] isolate flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">{ru ? 'Запрос на просмотр' : 'Ko‘rish uchun so‘rov'}</h2>
              <p className="mt-1 text-sm text-slate-500">{ru ? 'Владелец объявления подтвердит или предложит другое время.' : 'E’lon egasi vaqtni tasdiqlaydi yoki boshqa vaqt taklif qiladi.'}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full px-2 py-1 text-xl text-slate-400 hover:bg-slate-100" aria-label={ru ? 'Закрыть' : 'Yopish'}>×</button>
          </div>
          {success ? <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-center">
            <div className="text-3xl text-emerald-600">✓</div>
            <p className="mt-2 font-black text-emerald-800">{rescheduled ? (ru ? 'Время запроса обновлено' : 'So‘rov vaqti yangilandi') : (ru ? 'Запрос отправлен' : 'So‘rov yuborildi')}</p>
            <p className="mt-1 text-sm text-slate-600">{ru ? 'Ожидайте подтверждения владельца.' : 'E’lon egasining tasdig‘ini kuting.'}</p>
            <a href="/account/viewings" className="mt-3 inline-block text-sm font-bold text-emerald-700 underline">{ru ? 'Открыть мои запросы' : 'Ko‘rish so‘rovlarimni ochish'}</a>
            <button type="button" onClick={() => setOpen(false)} className="mt-4 block w-full rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white">{ru ? 'Готово' : 'Tayyor'}</button>
          </div> : <>
            <label className="mt-5 block text-sm font-bold text-slate-700">{ru ? 'Желаемые дата и время' : 'Istalgan sana va vaqt'}</label>
            <input type="datetime-local" value={requestedAt} min={new Date(Date.now() + 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={e => setRequestedAt(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500" />
            <label className="mt-4 block text-sm font-bold text-slate-700">{ru ? 'Комментарий (необязательно)' : 'Izoh (ixtiyoriy)'}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={3} placeholder={ru ? 'Например, удобное время для звонка...' : 'Masalan, bog‘lanish uchun qulay vaqt...'} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500" />
            {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">{ru ? 'Отмена' : 'Bekor qilish'}</button>
              <button type="button" onClick={() => void submit()} disabled={!requestedAt || busy} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{busy ? (ru ? 'Отправка...' : 'Yuborilmoqda...') : (ru ? 'Отправить запрос' : 'So‘rov yuborish')}</button>
            </div>
          </>}
        </div>
      </div>, document.body)}
    </div>
  )
}
