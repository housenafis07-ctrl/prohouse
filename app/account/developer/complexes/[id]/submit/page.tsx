'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

export default function SubmitComplexPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [missing, setMissing] = useState<string[]>([])
  const [success, setSuccess] = useState(false)

  async function submit() {
    setBusy(true); setError(''); setMissing([])
    try {
      const response = await fetch(`/api/developer/complexes/${params.id}/submit`, { method: 'POST', cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) {
        if (result.error === 'COMPLEX_INCOMPLETE') setMissing(result.missing || [])
        else setError(result.error || 'Moderatsiyaga yuborib bo‘lmadi.')
        return
      }
      setSuccess(true)
      router.refresh()
    } catch {
      setError('Server bilan bog‘lanib bo‘lmadi.')
    } finally { setBusy(false) }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-8"><div className="mx-auto max-w-3xl">
    <Link href="/account/developer" className="font-bold text-emerald-700">← Developer kabineti</Link>
    <section className="mt-5 rounded-3xl bg-white p-7 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-emerald-600">RoyalHouse · Developer</p>
      <h1 className="mt-2 text-3xl font-black">Majmuani moderatsiyaga yuborish</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Ariza faqat majmua profili, xarita konturlari, korpuslar va xonadonlar inventari to‘liq bo‘lganda adminga yuboriladi. Yuborilgach admin tekshiradi; tasdiqlanmaguncha ommaviy sahifada ko‘rinmaydi.</p>
      {success ? <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-emerald-800"><b>Majmua admin moderatsiyasiga yuborildi.</b><p className="mt-1 text-sm">Holat: Tekshiruv kutilmoqda.</p><Link href="/account/developer" className="mt-3 inline-block font-bold underline">Developer kabinetiga qaytish</Link></div> : <>
        <div className="mt-6 rounded-2xl border border-slate-200 p-5"><h2 className="font-black">Yuborishdan oldingi talablar</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600"><li>Majmua nomi, shahar, to‘liq manzil va loyiha tavsifi</li><li>Topshirish yili va xaritadagi majmua hududi</li><li>Har bir korpusning qavatlari, xonadonlar soni va xaritadagi konturi</li><li>Kamida bitta xonadon inventari: xonalar, maydon va narx</li></ul></div>
        {missing.length>0&&<div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><b>Quyidagi ma’lumotlarni to‘ldiring:</b><ul className="mt-2 list-disc space-y-1 pl-5">{missing.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
        {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        <button onClick={submit} disabled={busy} className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-4 font-black text-white disabled:opacity-50">{busy?'Tekshirilmoqda...':'To‘liq ma’lumotlarni tekshirish va adminga yuborish'}</button>
      </>}
    </section>
  </div></main>
}
