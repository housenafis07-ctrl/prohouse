'use client'

import { useMemo, useState } from 'react'

interface Partner {
  id: string
  user_id: string
  partner_type: string | null
  legal_form: string | null
  display_name: string | null
  company_name: string | null
  verification_status: string | null
  trusted_partner_status: string
  trusted_partner_rejection_reason: string | null
  trusted_partner_reviewed_at: string | null
  updated_at: string
  profiles: { full_name: string | null; phone: string | null; inn: string | null; company_name: string | null } | null
}

interface Document {
  id: string
  user_id: string
  document_type: string
  file_name: string
  mime_type: string
  size_bytes: number
  status: string
  rejection_reason: string | null
  signed_url: string | null
  created_at: string
  reviewed_at: string | null
}

const statusLabel: Record<string, string> = {
  requested: 'So‘rov yuborildi',
  under_review: 'Tekshiruvda',
  verified: 'Ishonchli hamkor',
  rejected: 'Rad etilgan',
}

const documentLabel: Record<string, string> = {
  registration_certificate: 'Ro‘yxatdan o‘tganlik guvohnomasi',
  inn_certificate: 'INN hujjati',
  director_id: 'Rahbar pasporti / ID',
  self_employed_certificate: 'O‘zini o‘zi band qilganlik hujjati',
  sole_proprietor_certificate: 'YaTT guvohnomasi',
  company_charter: 'Firma ustavi',
}

export default function TrustedPartnersClient({ partners, documents }: { partners: Partner[]; documents: Document[] }) {
  const [items, setItems] = useState(partners)
  const [working, setWorking] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  const filtered = useMemo(() => filter === 'all' ? items : items.filter(item => item.trusted_partner_status === filter), [items, filter])
  const docsFor = (userId: string) => documents.filter(document => document.user_id === userId)

  const review = async (partnerProfileId: string, status: 'under_review' | 'verified' | 'rejected') => {
    const rejectionReason = status === 'rejected' ? window.prompt('Rad etish sababini kiriting')?.trim() || '' : ''
    if (status === 'rejected' && !rejectionReason) return
    setWorking(partnerProfileId); setError('')
    try {
      const response = await fetch('/api/admin/trusted-partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerProfileId, status, rejectionReason }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Saqlashda xatolik')
      setItems(current => current.map(item => item.id === partnerProfileId ? {
        ...item,
        trusted_partner_status: status,
        trusted_partner_rejection_reason: status === 'rejected' ? rejectionReason : null,
        trusted_partner_reviewed_at: new Date().toISOString(),
      } : item))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saqlashda xatolik')
    } finally { setWorking(null) }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8">
    <div className="mx-auto max-w-6xl">
      <header className="rounded-3xl bg-slate-900 p-7 text-white">
        <p className="text-sm font-bold text-emerald-300">RoyalHouse xavfsizlik tizimi</p>
        <h1 className="mt-2 text-3xl font-black">Ishonchli hamkorlar</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Hamkor yuborgan hujjatlar shu yerda tekshiriladi. Tasdiqlangan hamkor maqomi arxivda saqlanadi va uning e‘lonlari oddiy e‘lonlardan yuqoriroq ranking oladi.</p>
      </header>

      <div className="mt-5 flex flex-wrap gap-2">
        {['all', 'requested', 'under_review', 'verified', 'rejected'].map(value => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{value === 'all' ? 'Barchasi' : statusLabel[value]}</button>)}
      </div>

      {error && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <div className="mt-5 space-y-4">
        {filtered.length === 0 ? <div className="rounded-3xl bg-white p-8 text-center text-slate-500 shadow-sm">Hozircha so‘rovlar yo‘q.</div> : filtered.map(partner => {
          const partnerDocs = docsFor(partner.user_id)
          return <article key={partner.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{statusLabel[partner.trusted_partner_status] || partner.trusted_partner_status}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{partner.legal_form || partner.partner_type || 'partner'}</span></div>
                <h2 className="mt-3 text-xl font-black">{partner.display_name || partner.profiles?.full_name || 'Nomsiz hamkor'}</h2>
                <p className="mt-1 text-sm text-slate-500">{partner.company_name || partner.profiles?.company_name || '—'} · {partner.profiles?.phone || 'Telefon yo‘q'} · INN: {partner.profiles?.inn || '—'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {partner.trusted_partner_status !== 'verified' && <button disabled={working === partner.id} onClick={() => void review(partner.id, 'under_review')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold">Tekshiruvga olish</button>}
                <button disabled={working === partner.id} onClick={() => void review(partner.id, 'verified')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">Tasdiqlash</button>
                {partner.trusted_partner_status !== 'rejected' && <button disabled={working === partner.id} onClick={() => void review(partner.id, 'rejected')} className="rounded-xl bg-red-50 px-4 py-2 text-sm font-black text-red-700">Rad etish</button>}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {partnerDocs.length === 0 ? <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 md:col-span-2">Hujjatlar yuklanmagan.</div> : partnerDocs.map(document => <div key={document.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{documentLabel[document.document_type] || document.document_type}</p><p className="mt-1 text-xs text-slate-500">{document.file_name} · {Math.round(document.size_bytes / 1024)} KB</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold">{document.status}</span></div>{document.signed_url && <a href={document.signed_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-black text-emerald-700">Hujjatni ochish →</a>}</div>)}
            </div>
          </article>
        })}
      </div>
    </div>
  </main>
}
