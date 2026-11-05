'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'

type CompanyDetails = { tax_id?: string; legal_address?: string; contact_email?: string; responsible_name?: string; responsible_position?: string; registration_date?: string }
type Profile = { developer_name: string; description: string | null; website: string | null; phone: string | null; company_details?: CompanyDetails }
const errors: Record<string, string> = {
  AUTH_REQUIRED: 'Tizimga qayta kiring.',
  PARTNER_PROFILE_REQUIRED: 'Hamkor profilingiz topilmadi.',
  DEVELOPER_PROFILE_REQUIRED: 'Developer profilingiz topilmadi.',
  COMPANY_NAME_INVALID: 'Kompaniya nomini tekshiring.',
  FIELD_TOO_LONG: 'Kiritilgan maydonlardan biri juda uzun.',
  WEBSITE_MUST_INCLUDE_PROTOCOL: 'Sayt manzilini https:// bilan kiriting.',
  TAX_ID_INVALID: 'STIR 9 ta raqamdan iborat bo‘lishi kerak.',
  CONTACT_EMAIL_INVALID: 'Elektron pochta manzilini tekshiring.',
  REGISTRATION_DATE_INVALID: 'Ro‘yxatdan o‘tgan sanani tekshiring.',
}

export default function DeveloperSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [phone, setPhone] = useState('')
  const [taxId, setTaxId] = useState('')
  const [legalAddress, setLegalAddress] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [responsibleName, setResponsibleName] = useState('')
  const [responsiblePosition, setResponsiblePosition] = useState('')
  const [registrationDate, setRegistrationDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/developer/profile', { cache: 'no-store' })
      .then(async response => {
        const result = await response.json()
        if (!response.ok || !result.developer) throw new Error(errors[result.error] || 'Profilni yuklab bo‘lmadi.')
        setProfile(result.developer)
        setName(result.developer.developer_name || '')
        setDescription(result.developer.description || '')
        setWebsite(result.developer.website || '')
        setPhone(result.developer.phone || '')
        const details = result.developer.company_details || {}
        setTaxId(details.tax_id || '')
        setLegalAddress(details.legal_address || '')
        setContactEmail(details.contact_email || '')
        setResponsibleName(details.responsible_name || '')
        setResponsiblePosition(details.responsible_position || '')
        setRegistrationDate(details.registration_date || '')
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Xatolik yuz berdi.'))
      .finally(() => setLoading(false))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      const response = await fetch('/api/developer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developer_name: name, description, website, phone, tax_id: taxId, legal_address: legalAddress, contact_email: contactEmail, responsible_name: responsibleName, responsible_position: responsiblePosition, registration_date: registrationDate }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(errors[result.error] || 'Ma’lumotlarni saqlab bo‘lmadi.')
      setProfile(result.developer)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Server bilan bog‘lanib bo‘lmadi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/account/developer" className="text-sm font-bold text-emerald-700">← Developer kabineti</Link>
        <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-black">Kompaniya profili</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Kompaniya ma’lumotlarini yangilang. Tasdiqlash holati bu sahifadan o‘zgartirilmaydi.</p>
          {loading ? <p className="mt-6 text-sm text-slate-500">Yuklanmoqda...</p> : !profile ? <p className="mt-6 text-sm text-slate-500">Developer profili mavjud emas.</p> : (
            <form onSubmit={submit} className="mt-7 space-y-5">
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Kompaniya nomi *</span>
                <input required minLength={2} maxLength={160} value={name} onChange={e => setName(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500" />
              </label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Kompaniya haqida</span>
                <textarea rows={5} maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-emerald-500" />
              </label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Veb-sayt</span>
                <input type="url" maxLength={240} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.uz" className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500" />
              </label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Telefon</span>
                <input type="tel" maxLength={40} value={phone} onChange={e => setPhone(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500" />
              </label>
              <div className="border-t border-slate-100 pt-5">
                <h2 className="text-lg font-black text-slate-900">Kompaniya rekvizitlari</h2>
                <p className="mt-1 text-sm text-slate-500">Yuridik va mas’ul shaxs ma’lumotlari. Kiritilmagan maydonlarni bo‘sh qoldirishingiz mumkin.</p>
              </div>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">STIR (INN)</span>
                <input inputMode="numeric" pattern="[0-9]{9}" maxLength={9} value={taxId} onChange={e => setTaxId(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="9 xonali STIR" className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500" />
              </label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Yuridik manzil</span>
                <input maxLength={240} value={legalAddress} onChange={e => setLegalAddress(e.target.value)} placeholder="Toshkent shahri, ..." className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500" />
              </label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Kompaniya elektron pochtasi</span>
                <input type="email" maxLength={240} value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="info@company.uz" className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500" />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Mas’ul shaxs F.I.Sh.</span>
                  <input maxLength={240} value={responsibleName} onChange={e => setResponsibleName(e.target.value)} placeholder="Ism Familiya" className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500" />
                </label>
                <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Lavozimi</span>
                  <input maxLength={240} value={responsiblePosition} onChange={e => setResponsiblePosition(e.target.value)} placeholder="Direktor" className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500" />
                </label>
              </div>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Kompaniya ro‘yxatdan o‘tgan sana</span>
                <input type="date" value={registrationDate} onChange={e => setRegistrationDate(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500" />
              </label>
              {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              {saved && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Ma’lumotlar saqlandi.</p>}
              <button disabled={saving} className="w-full rounded-xl bg-emerald-600 px-5 py-3.5 font-black text-white disabled:opacity-60">{saving ? 'Saqlanmoqda...' : 'O‘zgarishlarni saqlash'}</button>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
