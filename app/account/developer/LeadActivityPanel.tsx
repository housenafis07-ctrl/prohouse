'use client'

import { useEffect, useState } from 'react'

type Note = { id: string; body: string; created_at: string }
type Activity = { id: string; activity_type: 'call' | 'message' | 'meeting' | 'other'; summary: string; created_at: string }

export default function LeadActivityPanel({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [note, setNote] = useState('')
  const [summary, setSummary] = useState('')
  const [activityType, setActivityType] = useState<Activity['activity_type']>('call')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/developer/leads/${leadId}/activity`, { cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'LOAD_FAILED')
      setNotes(data.notes || []); setActivities(data.activities || [])
    } catch (e) { setError(e instanceof Error ? e.message : 'LOAD_FAILED') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (open) load() }, [open, leadId])

  async function submit(payload: Record<string, string>, clear: () => void) {
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/developer/leads/${leadId}/activity`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'SAVE_FAILED')
      clear(); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'SAVE_FAILED') }
    finally { setSaving(false) }
  }

  const date = (value: string) => new Date(value).toLocaleString()
  return <div className="mt-3 border-t border-slate-100 pt-3">
    <button type="button" onClick={() => setOpen(v => !v)} className="text-xs font-black text-indigo-700">
      {open ? '− Yopish' : '＋ Izohlar va aloqa tarixi'}
    </button>
    {open && <div className="mt-3 space-y-4">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <form onSubmit={e => { e.preventDefault(); if (note.trim()) submit({ kind: 'note', body: note }, () => setNote('')) }} className="space-y-2">
          <label className="block text-xs font-bold text-slate-600">Ichki izoh</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={4000} rows={3} placeholder="Faqat kompaniya xodimlari uchun..." className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
          <button disabled={saving || !note.trim()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Izohni saqlash</button>
        </form>
        <form onSubmit={e => { e.preventDefault(); if (summary.trim()) submit({ kind: 'activity', activity_type: activityType, summary }, () => setSummary('')) }} className="space-y-2">
          <label className="block text-xs font-bold text-slate-600">Aloqa natijasini qayd etish</label>
          <div className="flex gap-2">
            <select value={activityType} onChange={e => setActivityType(e.target.value as Activity['activity_type'])} className="rounded-lg border border-slate-200 px-2 text-xs">
              <option value="call">Qo‘ng‘iroq</option><option value="message">Xabar</option><option value="meeting">Uchrashuv</option><option value="other">Boshqa</option>
            </select>
            <input value={summary} onChange={e => setSummary(e.target.value)} maxLength={1000} placeholder="Masalan: ertaga ko‘rishga keladi" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs" />
          </div>
          <button disabled={saving || !summary.trim()} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Aloqani saqlash</button>
        </form>
      </div>
      {loading ? <p className="text-xs text-slate-500">Yuklanmoqda...</p> : <div className="grid gap-3 md:grid-cols-2">
        <div><h4 className="mb-2 text-xs font-black text-slate-700">Ichki izohlar ({notes.length})</h4>{notes.length ? notes.map(item => <div key={item.id} className="mb-2 rounded-lg bg-amber-50 p-3"><p className="whitespace-pre-wrap text-xs text-slate-700">{item.body}</p><time className="mt-2 block text-[10px] text-slate-400">{date(item.created_at)}</time></div>) : <p className="text-xs text-slate-400">Izohlar hali yo‘q.</p>}</div>
        <div><h4 className="mb-2 text-xs font-black text-slate-700">Aloqa tarixi ({activities.length})</h4>{activities.length ? activities.map(item => <div key={item.id} className="mb-2 rounded-lg bg-emerald-50 p-3"><p className="text-xs font-bold text-slate-700">{({call:'Qo‘ng‘iroq',message:'Xabar',meeting:'Uchrashuv',other:'Boshqa'})[item.activity_type]}</p><p className="mt-1 text-xs text-slate-600">{item.summary}</p><time className="mt-2 block text-[10px] text-slate-400">{date(item.created_at)}</time></div>) : <p className="text-xs text-slate-400">Aloqa tarixi hali yo‘q.</p>}</div>
      </div>}
    </div>}
  </div>
}
