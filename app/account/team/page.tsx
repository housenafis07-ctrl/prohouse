'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function PartnerTeamPage() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'manager'>('member')
  const [members, setMembers] = useState<Array<{ id: string; member_user_id: string; role: string; created_at: string }>>([])
  const [limit, setLimit] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    const response = await fetch('/api/account/team')
    const data = await response.json().catch(() => ({}))
    if (!response.ok) setError(data.error || 'Jamoa yuklanmadi.')
    else {
      setMembers(data.members || [])
      setLimit(Number(data.plan?.employee_limit || 0))
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const add = async () => {
    setBusy(true); setError('')
    const response = await fetch('/api/account/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) setError(data.error || 'Xodimni qo‘shib bo‘lmadi.')
    else { setEmail(''); await load() }
    setBusy(false)
  }

  const remove = async (id: string) => {
    setBusy(true); setError('')
    const response = await fetch('/api/account/team?id=' + encodeURIComponent(id), { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) setError(data.error || 'Xodimni o‘chirib bo‘lmadi.')
    else await load()
    setBusy(false)
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <Link href="/account/monetization" className="text-sm font-extrabold text-emerald-700">← Hisob va to‘lovlar</Link>
      <h1 className="mt-5 text-3xl font-black">Jamoa</h1>
      <p className="mt-2 text-sm text-slate-500">BUSINESS tarifidagi xodimlar uchun o‘rinlarni boshqaring.</p>

      {error && <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>}

      {loading ? <div className="mt-6 rounded-3xl bg-white p-8 text-center text-slate-500">Yuklanmoqda...</div> : <>
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-black">Xodim qo‘shish</h2><p className="mt-1 text-xs text-slate-500">Ro‘yxatdan o‘tgan RoyalHouse foydalanuvchisining email manzilini kiriting.</p></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{members.length}/{limit}</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="xodim@email.com" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500" />
            <select value={role} onChange={e => setRole(e.target.value as 'member' | 'manager')} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <option value="member">Xodim</option><option value="manager">Menejer</option>
            </select>
            <button type="button" disabled={busy || !email.trim() || members.length >= limit} onClick={() => void add()} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">Qo‘shish</button>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {members.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Hali xodim qo‘shilmagan.</div> : members.map(member => <div key={member.id} className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-0">
            <div><p className="font-bold">{member.member_user_id}</p><p className="text-xs text-slate-500">{member.role === 'manager' ? 'Menejer' : 'Xodim'}</p></div>
            <button type="button" disabled={busy} onClick={() => void remove(member.id)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">O‘chirish</button>
          </div>)}
        </section>
      </>}
    </div>
  </main>
}
