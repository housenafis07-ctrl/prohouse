'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Profile = {
  phone: string | null
  full_name: string | null
  account_type: 'individual' | 'partner' | null
  partner_type: string | null
  company_name: string | null
  inn: string | null
}

const partnerLabels: Record<string, string> = {
  self_employed: "O‘zini o‘zi band qilgan — O‘BQ",
  sole_proprietor: 'Yakka tartibdagi tadbirkor — YaTT',
  llc: 'Mas’uliyati cheklangan jamiyat — MChJ',
}

export default function AccountPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/register')
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('phone,full_name,account_type,partner_type,company_name,inn')
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return
      if (profileError) setError(profileError.message)
      setProfile(data ?? {
        phone: user.phone ?? null,
        full_name: null,
        account_type: 'individual',
        partner_type: null,
        company_name: null,
        inn: null,
      })
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [router])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center shadow-sm">Yuklanmoqda...</div></main>
  }

  if (!profile) return null

  const isPartner = profile.account_type === 'partner'

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-bold text-emerald-700">← Prohouse</Link>
          <button onClick={signOut} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Chiqish</button>
        </div>

        <section className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="bg-slate-900 px-6 py-7 text-white sm:px-8">
            <p className="text-sm font-semibold text-slate-300">Shaxsiy kabinet</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{profile.full_name || 'Prohouse foydalanuvchisi'}</h1>
            <p className="mt-2 text-sm text-slate-300">{profile.phone || 'Telefon raqami ko‘rsatilmagan'}</p>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Akkaunt turi</p>
                <p className="mt-2 font-bold text-slate-900">{isPartner ? 'Hamkor' : 'Jismoniy shaxs'}</p>
              </div>
              {isPartner && <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hamkor turi</p>
                <p className="mt-2 font-bold text-slate-900">{partnerLabels[profile.partner_type || ''] || '—'}</p>
              </div>}
              {profile.company_name && <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tashkilot</p>
                <p className="mt-2 font-bold text-slate-900">{profile.company_name}</p>
              </div>}
              {profile.inn && <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">INN</p>
                <p className="mt-2 font-bold text-slate-900">{profile.inn}</p>
              </div>}
            </div>

            {error && <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Profil ma’lumotlarini yuklashda xatolik: {error}</div>}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link href="/listings" className="rounded-2xl border border-slate-200 px-5 py-4 text-center font-bold text-slate-900 hover:bg-slate-50">E’lonlarni ko‘rish</Link>
              <Link href="/" className="rounded-2xl bg-emerald-600 px-5 py-4 text-center font-bold text-white hover:bg-emerald-700">Bosh sahifaga qaytish</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
