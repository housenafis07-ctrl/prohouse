'use client'

import { useState } from 'react'

type Facts = Record<string, unknown>

export default function ListingAIDescriptionAssistant({
  facts,
  language = 'uz',
  onAccept,
}: {
  facts: Facts
  language?: 'uz' | 'ru'
  onAccept: (description: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const ru = language === 'ru'

  const improve = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/ai/listing-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts, language }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || (ru ? 'Ошибка AI.' : 'AI xatosi.'))
      setSuggestion(String(data.description || ''))
    } catch (e) {
      setError(e instanceof Error ? e.message : (ru ? 'Ошибка AI.' : 'AI xatosi.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-violet-950">✨ {ru ? 'Улучшить описание с AI' : 'AI bilan tavsifni yaxshilash'}</p>
          <p className="mt-1 text-xs text-violet-800/80">{ru ? 'AI использует только подтверждённые данные объявления.' : 'AI faqat e’londagi mavjud va tasdiqlangan ma’lumotlardan foydalanadi.'}</p>
        </div>
        <button type="button" onClick={improve} disabled={loading} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60">
          {loading ? (ru ? 'Готовим…' : 'Tayyorlanmoqda…') : (ru ? 'Улучшить' : 'Yaxshilash')}
        </button>
      </div>
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
      {suggestion && <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-violet-100">
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{suggestion}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => onAccept(suggestion)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">{ru ? 'Принять' : 'Qabul qilish'}</button>
          <button type="button" onClick={improve} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60">{ru ? 'Создать ещё раз' : 'Qayta yaratish'}</button>
        </div>
      </div>}
    </div>
  )
}
