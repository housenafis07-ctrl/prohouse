'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'

type Profile = { developer_name: string; description: string | null; website: string | null; phone: string | null }
const errors: Record<string, string> = {
  AUTH_REQUIRED: 'Tizimga qayta kiring.',
  PARTNER_PROFILE_REQUIRED: 'Hamkor profilingiz topilmadi.',
  DEVELOPER_PROFILE_REQUIRED: 'Developer profilingiz topilmadi.',
  COMPANY_NAME_INVALID: 'Kompaniya nomini tekshiring.',
  FIELD_TOO_LONG: 'Kiritilgan maydonlardan biri juda uzun.',
  WEBSITE_MUST_INCLUDE_PROTOCOL: 'Sayt manzilini https:// bilan kiriting.',
}

export default function DeveloperSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [phone, setPhone] = useState('')
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
        body: JSON.stringify({ developer_name: name, description, website, phone }),
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
