'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type Realtor = {
  id: string
  user_id: string
  display_name: string
  phone: string | null
  certificate_number: string | null
  certificate_issued_at: string | null
  certificate_expires_at: string | null
  registry_number: string | null
  registry_status: string | null
  experience_years: number
  agency_name: string | null
  service_areas: string[]
  verification_status: string
  verification_rejection_reason: string | null
  verification_reviewed_at: string | null
  created_at: string
  account: { full_name: string | null; phone: string | null } | null
}

type Filter = 'pending' | 'verified' | 'rejected' | 'all'

const label: Record<string, string> = {
  pending: 'Kutilmoqda',
  verified: 'Tasdiqlangan',
  rejected: 'Rad etilgan',
}

export default function RealtorModerationClient({ realtors }: { realtors: Realtor[] }) {
  const [items, setItems] = useState(realtors)
  const [filter, setFilter] = useState<Filter>('pending')
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const counts = useMemo(() => ({
    pending: items.filter(item => item.verification_status === 'pending').length,
    verified: items.filter(item => item.verification_status === 'verified').length,
    rejected: items.filter(item => item.verification_status === 'rejected').length,
  }), [items])

  const visible = useMemo(
    () => filter === 'all' ? items : items.filter(item => item.verification_status === filter),
    [items, filter],
  )

  async function review(realtor: Realtor, status: 'verified' | 'rejected') {
    const rejectionReason = status === 'rejected'
      ? window.prompt('Arizani rad etish sababini kiriting:')?.trim() || ''
      : ''
    if (status === 'rejected' && !rejectionReason) return
    if (status === 'verified' && !window.confirm(`${realtor.display_name} rieltorini tasdiqlaysizmi?`)) return

    setWorking(realtor.id)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/realtors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realtorProfileId: realtor.id, status, rejectionReason }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Holatni saqlab bo‘lmadi')
      setItems(current => current.map(item => item.id === realtor.id ? {
        ...item,
        verification_status: status,
        verification_rejection_reason: status === 'rejected' ? rejectionReason : null,
        verification_reviewed_at: new Date().toISOString(),
      } : item))
      setNotice(status === 'verified' ? 'Rieltor profili tasdiqlandi.' : 'Ariza rad etildi.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kutilmagan xatolik')
    } finally {
      setWorking(null)
    }
  }

  return <main className="min-h-screen bg-slate-50">
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm font-bold text-emerald-700">← Admin panel</Link>
          <h1 className="mt-3 text-3xl font-black text-slate-900">Rieltor arizalari</h1>
          <p className="mt-2 text-sm text-slate-500">Rieltorlik profillarini tekshiring, tasdiqlang yoki rad eting.</p>
        </div>
        <button onClick={() => window.location.reload()} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Yangilash</button>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {(['pending', 'verified', 'rejected'] as const).map(status => <button key={status} onClick={() => setFilter(status)} className={`rounded-2xl border p-5 text-left transition ${filter === status ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          <p className="text-sm text-slate-500">{label[status]}</p>
          <p className="mt-1 text-3xl font-black">{counts[status]}</p>
        </button>)}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(['pending', 'verified', 'rejected', 'all'] as const).map(status => <button key={status} onClick={() => setFilter(status)} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === status ? 'bg-slate-900 text-white' : 'border bg-white text-slate-600'}`}>
          {status === 'all' ? 'Barchasi' : label[status]}
        </button>)}
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}

      <div className="mt-5 space-y-4">
        {visible.map(realtor => <article key={realtor.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">{realtor.display_name}</h2>
              <p className="mt-1 text-sm text-slate-500">{realtor.phone || realtor.account?.phone || 'Telefon ko‘rsatilmagan'}</p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${realtor.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-800' : realtor.verification_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
              {label[realtor.verification_status] || realtor.verification_status}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Akkaunt egasi" value={realtor.account?.full_name || realtor.display_name} />
            <Info label="Malaka sertifikati" value={realtor.certificate_number || 'Kiritilmagan'} />
            <Info label="Tajriba" value={`${realtor.experience_years} yil`} />
            <Info label="Agentlik" value={realtor.agency_name || 'Mustaqil rieltor'} />
            <Info label="Xizmat hududlari" value={realtor.service_areas?.length ? realtor.service_areas.join(', ') : 'Ko‘rsatilmagan'} />
            <Info label="Ariza sanasi" value={new Date(realtor.created_at).toLocaleString('uz-UZ')} />
            {realtor.certificate_issued_at && <Info label="Sertifikat berilgan sana" value={realtor.certificate_issued_at} />}
            {realtor.certificate_expires_at && <Info label="Sertifikat amal qilish muddati" value={realtor.certificate_expires_at} />}
            {realtor.registry_number && <Info label="Reyestr raqami" value={realtor.registry_number} />}
          </div>

          {realtor.verification_status === 'rejected' && realtor.verification_rejection_reason && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Rad etish sababi: {realtor.verification_rejection_reason}</p>}

          {realtor.verification_status === 'pending' && <div className="mt-5 flex flex-wrap gap-2">
            <button disabled={working === realtor.id} onClick={() => review(realtor, 'verified')} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{working === realtor.id ? 'Saqlanmoqda…' : 'Tasdiqlash'}</button>
            <button disabled={working === realtor.id} onClick={() => review(realtor, 'rejected')} className="rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-700 disabled:opacity-50">Rad etish</button>
          </div>}
        </article>)}
        {!visible.length && <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-slate-500">Bu bo‘limda hozircha arizalar yo‘q.</div>}
      </div>
    </div>
  </main>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4">
    <p className="text-xs font-semibold text-slate-400">{label}</p>
    <p className="mt-1 break-words text-sm font-bold text-slate-800">{value}</p>
  </div>
}
