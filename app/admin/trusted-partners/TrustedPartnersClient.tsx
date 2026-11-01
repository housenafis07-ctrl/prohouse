'use client'

import Link from 'next/link'
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
  created_at: string
  reviewed_at: string | null
}

interface IndividualTrustedProfile {
  id: string
  full_name: string | null
  phone: string | null
  account_type: string
  partner_type: string | null
  trusted_profile: boolean
  trusted_profile_opt_in: boolean
  trusted_profile_program_status: string | null
  myid_status: string | null
  myid_verified_at: string | null
  trusted_profile_rejection_reason: string | null
  trusted_profile_reviewed_at: string | null
}

const statusLabel: Record<string, string> = {
  requested: 'So‘rov yuborildi',
  under_review: 'Tekshiruvda',
  verification: 'Tekshiruvda',
  verified: 'Ishonchli hamkor',
  rejected: 'Rad etilgan',
}

const individualStatusLabel: Record<string, string> = {
  requested: 'So‘rov yuborildi',
  verification: 'Tekshiruvda',
  verified: 'Ishonchli profil',
  rejected: 'Rad etilgan',
  not_joined: 'So‘rov yuborilmagan',
}

const documentLabel: Record<string, string> = {
  registration_certificate: 'Ro‘yxatdan o‘tganlik guvohnomasi',
  inn_certificate: 'INN hujjati',
  director_id: 'Rahbar pasporti / ID',
  self_employed_certificate: 'O‘zini o‘zi band qilganlik hujjati',
  sole_proprietor_certificate: 'YaTT guvohnomasi',
  company_charter: 'Firma ustavi',
  other_required_documents: 'Boshqa zaruriy hujjatlar',
  identity_selfie: 'Foydalanuvchi fotosurati',
  identity_passport: 'Pasport rasmi',
  identity_id_front: 'ID karta — old tomoni',
  identity_id_back: 'ID karta — orqa tomoni',
}

export default function TrustedPartnersClient({
  partners,
  documents,
  individuals,
}: {
  partners: Partner[]
  documents: Document[]
  individuals: IndividualTrustedProfile[]
}) {
  const [items, setItems] = useState(partners)
  const [individualItems, setIndividualItems] = useState(individuals)
  const [working, setWorking] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [individualFilter, setIndividualFilter] = useState('all')
  const [section, setSection] = useState<'individuals' | 'partners'>('individuals')
  const [error, setError] = useState('')

  const normalizedPartnerStatus = (item: Partner) => item.trusted_partner_status || (item.verification_status === 'verified' ? 'verified' : 'requested')
  const filtered = useMemo(() => filter === 'all' ? items : items.filter(item => normalizedPartnerStatus(item) === filter), [items, filter])
  const filteredIndividuals = useMemo(() => {
    if (individualFilter === 'all') return individualItems
    return individualItems.filter(item => {
      const status = item.trusted_profile_program_status || 'not_joined'
      return status === individualFilter
    })
  }, [individualItems, individualFilter])
  const docsFor = (userId: string) => documents.filter(document => document.user_id === userId)

  const reviewPartner = async (partnerProfileId: string, status: 'under_review' | 'verified' | 'rejected') => {
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

  const reviewIndividual = async (userId: string, status: 'under_review' | 'verified' | 'rejected') => {
    const rejectionReason = status === 'rejected' ? window.prompt('Rad etish sababini kiriting')?.trim() || '' : ''
    if (status === 'rejected' && !rejectionReason) return
    setWorking(userId); setError('')
    try {
      const response = await fetch('/api/admin/trusted-partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUserId: userId, status, rejectionReason }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Saqlashda xatolik')
      setIndividualItems(current => current.map(item => item.id === userId ? {
        ...item,
        trusted_profile: status === 'verified',
        trusted_profile_program_status: status === 'under_review' ? 'verification' : status,
        trusted_profile_rejection_reason: status === 'rejected' ? rejectionReason : null,
        trusted_profile_reviewed_at: new Date().toISOString(),
      } : item))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Saqlashda xatolik')
    } finally { setWorking(null) }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8">
    <div className="mx-auto max-w-6xl">
      <nav className="mb-5 flex items-center justify-between gap-4">
        <Link href="/admin" className="font-black text-emerald-700 hover:text-emerald-800">← Admin panel</Link>
        <Link href="/" aria-label="RoyalHouse bosh sahifasi" className="font-black text-slate-900 hover:text-emerald-700">RoyalHouse</Link>
      </nav>

      <header className="rounded-3xl bg-slate-900 p-7 text-white">
        <p className="text-sm font-bold text-emerald-300">RoyalHouse xavfsizlik tizimi</p>
        <h1 className="mt-2 text-3xl font-black">Ishonchli profillar va hamkorlar</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Jismoniy shaxslarning selfie va pasport/ID hujjatlari hamda hamkorlarning hujjatlari shu yerda tekshiriladi. Tasdiqlangan ishonchli profil va hamkor maqomi arxivda saqlanadi hamda e‘lonlar oddiy e‘lonlardan yuqoriroq ranking oladi.</p>
      </header>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => setSection('individuals')} className={`rounded-2xl px-5 py-4 text-left ${section === 'individuals' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
          <span className="block text-sm font-black">Ishonchli profillar</span>
          <span className={`mt-1 block text-xs ${section === 'individuals' ? 'text-slate-300' : 'text-slate-500'}`}>Jismoniy shaxslar · Pasport / ID</span>
          <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-black ${section === 'individuals' ? 'bg-white/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700'}`}>{individualItems.filter(item => !item.trusted_profile).length} ta ko‘rib chiqilmagan</span>
        </button>
        <button type="button" onClick={() => setSection('partners')} className={`rounded-2xl px-5 py-4 text-left ${section === 'partners' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
          <span className="block text-sm font-black">Ishonchli hamkorlar</span>
          <span className={`mt-1 block text-xs ${section === 'partners' ? 'text-slate-300' : 'text-slate-500'}`}>YaTT · Firma · o‘zini o‘zi band qilganlar</span>
          <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-black ${section === 'partners' ? 'bg-white/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700'}`}>{items.filter(item => ['requested', 'under_review'].includes(normalizedPartnerStatus(item))).length} ta tekshiruvda</span>
        </button>
      </div>

      {error && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {section === 'individuals' ? <>
        <div className="mt-5 flex flex-wrap gap-2">
          {['all', 'requested', 'verification', 'verified', 'rejected'].map(value => <button key={value} type="button" onClick={() => setIndividualFilter(value)} className={`rounded-full px-4 py-2 text-sm font-bold ${individualFilter === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{value === 'all' ? 'Barchasi' : individualStatusLabel[value]}</button>)}
        </div>

        <div className="mt-5 space-y-4">
          {filteredIndividuals.length === 0 ? <div className="rounded-3xl bg-white p-8 text-center text-slate-500 shadow-sm">Hozircha hujjat orqali yuborilgan ishonchli profil so‘rovlari yo‘q.</div> : filteredIndividuals.map(profile => {
            const status = profile.trusted_profile_program_status || 'not_joined'
            const myIdVerified = profile.myid_status === 'verified'
            const identityDocs = docsFor(profile.id).filter(document => document.document_type.startsWith('identity_'))
            const hasManualDocs = identityDocs.some(document => document.document_type === 'identity_selfie') && identityDocs.some(document => ['identity_passport', 'identity_id_front'].includes(document.document_type))
            return <article key={profile.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${profile.trusted_profile ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{individualStatusLabel[status] || status}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${hasManualDocs ? 'bg-sky-50 text-sky-700' : myIdVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{hasManualDocs ? 'Hujjatlar yuklangan' : myIdVerified ? 'MyID tasdiqlangan' : 'Hujjat kutilmoqda'}</span>
                  </div>
                  <h2 className="mt-3 text-xl font-black">{profile.full_name || 'Nomsiz foydalanuvchi'}</h2>
                  <p className="mt-1 text-sm text-slate-500">{profile.phone || 'Telefon yo‘q'} · {profile.partner_type || 'Jismoniy shaxs'}</p>
                  {profile.myid_verified_at && <p className="mt-1 text-xs text-slate-400">MyID tasdiqlangan: {new Date(profile.myid_verified_at).toLocaleString('uz-UZ')}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {status !== 'verified' && <button disabled={working === profile.id} onClick={() => void reviewIndividual(profile.id, 'under_review')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold">Tekshiruvga olish</button>}
                  <button disabled={working === profile.id || (!myIdVerified && !hasManualDocs)} onClick={() => void reviewIndividual(profile.id, 'verified')} title={!myIdVerified && !hasManualDocs ? 'Avval selfie va pasport/ID rasmlarini yuklash kerak' : undefined} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Tasdiqlash</button>
                  {status !== 'rejected' && <button disabled={working === profile.id} onClick={() => void reviewIndividual(profile.id, 'rejected')} className="rounded-xl bg-red-50 px-4 py-2 text-sm font-black text-red-700">Rad etish</button>}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                <p className="font-black text-slate-900">Shaxsni tasdiqlovchi hujjatlar</p>
                {identityDocs.length === 0 ? <p className="mt-2 text-sm text-amber-700">Hali hujjatlar yuklanmagan.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{identityDocs.map(document => <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-bold">{documentLabel[document.document_type] || document.document_type}</p><p className="text-xs text-slate-500">{document.file_name} · {document.status}</p></div><a href={`/api/admin/trusted-partners/documents/${document.id}`} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-black text-emerald-700">Ochish ↗</a></div>)}</div>}
                <p className="mt-3 text-xs leading-5 text-slate-500">Admin hujjatdagi ma’lumotlarni profil bilan solishtirib, shaxsan tekshiradi. MyID shart emas.</p>
              </div>
              {profile.trusted_profile_rejection_reason && <div className="mt-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700"><span className="font-black">Rad etish sababi:</span> {profile.trusted_profile_rejection_reason}</div>}
            </article>
          })}
        </div>
      </> : <>
        <div className="mt-5 flex flex-wrap gap-2">
          {['all', 'requested', 'under_review', 'verified', 'rejected'].map(value => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{value === 'all' ? 'Barchasi' : statusLabel[value]}</button>)}
        </div>

        <div className="mt-5 space-y-4">
          {filtered.length === 0 ? <div className="rounded-3xl bg-white p-8 text-center text-slate-500 shadow-sm">Hozircha hamkor so‘rovlari yo‘q.</div> : filtered.map(partner => {
            const partnerStatus = normalizedPartnerStatus(partner)
            const partnerDocs = docsFor(partner.user_id)
            return <article key={partner.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{statusLabel[partnerStatus] || partnerStatus}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{partner.legal_form || partner.partner_type || 'partner'}</span></div>
                  <h2 className="mt-3 text-xl font-black">{partner.display_name || partner.profiles?.full_name || 'Nomsiz hamkor'}</h2>
                  <p className="mt-1 text-sm text-slate-500">{partner.company_name || partner.profiles?.company_name || '—'} · {partner.profiles?.phone || 'Telefon yo‘q'} · INN: {partner.profiles?.inn || '—'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {partnerStatus !== 'verified' && <button disabled={working === partner.id} onClick={() => void reviewPartner(partner.id, 'under_review')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold">Tekshiruvga olish</button>}
                  <button disabled={working === partner.id} onClick={() => void reviewPartner(partner.id, 'verified')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">Tasdiqlash</button>
                  {partnerStatus !== 'rejected' && <button disabled={working === partner.id} onClick={() => void reviewPartner(partner.id, 'rejected')} className="rounded-xl bg-red-50 px-4 py-2 text-sm font-black text-red-700">Rad etish</button>}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {partnerDocs.length === 0 ? <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 md:col-span-2">Hujjatlar yuklanmagan.</div> : partnerDocs.map(document => <div key={document.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{documentLabel[document.document_type] || document.document_type}</p><p className="mt-1 text-xs text-slate-500">{document.file_name} · {Math.round(document.size_bytes / 1024)} KB</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold">{document.status}</span></div><a href={`/api/admin/trusted-partners/documents/${document.id}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-black text-emerald-700">Hujjatni ochish →</a></div>)}
              </div>
            </article>
          })}
        </div>
      </>}
    </div>
  </main>
}
