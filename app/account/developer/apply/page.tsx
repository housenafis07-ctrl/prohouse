'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const errorText: Record<string, string> = {
  AUTH_REQUIRED: 'Avval tizimga kiring.',
  PARTNER_ACCOUNT_REQUIRED: 'Developer arizasi uchun hamkor hisob qaydnomasi kerak.',
  PARTNER_PROFILE_REQUIRED: 'Avval hamkor profilingizni to‘ldiring.',
  COMPANY_NAME_INVALID: 'Kompaniya nomini to‘g‘ri kiriting.',
  FIELD_TOO_LONG: 'Kiritilgan ma’lumotlardan biri juda uzun.',
  WEBSITE_MUST_INCLUDE_PROTOCOL: 'Sayt manzilini https:// bilan kiriting.',
}

export default function DeveloperApplyPage() {
  const router = useRouter()
  const [developerName, setDeveloperName] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/developer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developer_name: developerName,
          description,
          website,
          phone,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(errorText[result.error] || 'Arizani yuborishda xatolik yuz berdi. Qayta urinib ko‘ring.')
        return
      }
      router.replace('/account/developer')
      router.refresh()
    } catch {
      setError('Server bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/account/developer" className="text-sm font-bold text-emerald-700">
          ← Developer kabineti
        </Link>
        <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-600">
            Royalhouse · Developer
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">
            Developer arizasi
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Kompaniya ma’lumotlarini kiriting. Ariza yuborilgach, profil moderatsiya uchun
            tekshiruv holatiga o‘tadi.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Kompaniya nomi *</span>
              <input
                required
                minLength={2}
                maxLength={160}
                value={developerName}
                onChange={event => setDeveloperName(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500"
                placeholder="Masalan: Royal Development"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Kompaniya haqida</span>
              <textarea
                maxLength={4000}
                rows={4}
                value={description}
                onChange={event => setDescription(event.target.value)}
                className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-emerald-500"
                placeholder="Kompaniya va qurilish loyihalari haqida qisqacha..."
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Veb-sayt</span>
              <input
                type="url"
                maxLength={240}
                value={website}
                onChange={event => setWebsite(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500"
                placeholder="https://example.uz"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Aloqa telefoni</span>
              <input
                type="tel"
                maxLength={40}
                value={phone}
                onChange={event => setPhone(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500"
                placeholder="+998 90 123 45 67"
              />
            </label>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 px-5 py-3.5 font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Yuborilmoqda...' : 'Arizani yuborish'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
