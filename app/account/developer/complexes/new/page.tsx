'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ResidentialComplexMap from '../ResidentialComplexMap'

type MapData = { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; properties: { kind: 'complex' | 'building'; name: string }; geometry: { type: 'Polygon'; coordinates: [number, number][][] } }> }

const messages: Record<string, string> = {
  MAP_COORDINATES_INVALID: 'Xarita koordinatalarini tekshiring.',
  MAP_DATA_INVALID: 'Xarita konturi noto‘g‘ri formatda.',
  AUTH_REQUIRED: 'Tizimga qayta kiring.',
  PARTNER_ACCOUNT_REQUIRED: 'Hamkor hisob qaydnomasi talab qilinadi.',
  PARTNER_PROFILE_REQUIRED: 'Avval hamkor profilingizni to‘ldiring.',
  DEVELOPER_PROFILE_REQUIRED: 'Avval developer arizasini yuboring.',
  COMPLEX_NAME_INVALID: 'Majmua nomini kamida 2 ta belgi bilan kiriting.',
  CITY_REQUIRED: 'Shahar yoki viloyatni kiriting.',
  FIELD_TOO_LONG: 'Maydonlardan biridagi matn ruxsat etilgan uzunlikdan oshdi.',
  COMPLETION_YEAR_INVALID: 'Topshirish yilini tekshiring.',
}

export default function NewComplexPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [completionYear, setCompletionYear] = useState('')
  const [mapData, setMapData] = useState<MapData>({ type: 'FeatureCollection', features: [] })
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/developer/complexes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, city, district, address, description,
          completion_year: completionYear || null,
          latitude: mapCenter?.latitude ?? null,
          longitude: mapCenter?.longitude ?? null,
          map_data: mapData,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(messages[result.error] || 'Majmuani yaratib bo‘lmadi. Qayta urinib ko‘ring.')
        return
      }
      router.replace('/account/developer')
      router.refresh()
    } catch {
      setError('Server bilan bog‘lanib bo‘lmadi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/account/developer" className="text-sm font-bold text-emerald-700">← Developer kabineti</Link>
        <section className="mt-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Royalhouse · Developer</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Yangi turar joy majmuasi</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Dastlab asosiy ma’lumotlarni kiriting. Majmua hozircha rejalashtirish holatida saqlanadi;
            ommaviy e’lon sifatida avtomatik nashr qilinmaydi.
          </p>
          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Majmua nomi *</span>
              <input required minLength={2} maxLength={180} value={name} onChange={e => setName(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500"
                placeholder="Masalan: Yangi Hayot Residence" />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Shahar / viloyat *</span>
                <input required maxLength={120} value={city} onChange={e => setCity(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500"
                  placeholder="Toshkent shahri" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Tuman</span>
                <input maxLength={120} value={district} onChange={e => setDistrict(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500"
                  placeholder="Yunusobod tumani" />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Manzil</span>
              <input maxLength={500} value={address} onChange={e => setAddress(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500"
                placeholder="Ko‘cha va uy raqami" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Topshirish yili</span>
              <input type="number" min={new Date().getFullYear() - 5} max={new Date().getFullYear() + 30}
                value={completionYear} onChange={e => setCompletionYear(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-500"
                placeholder={String(new Date().getFullYear() + 1)} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Loyiha haqida</span>
              <textarea rows={5} maxLength={8000} value={description} onChange={e => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-emerald-500"
                placeholder="Majmua, infratuzilma va loyiha xususiyatlari haqida..." />
            </label>
            <div className="space-y-2">
              <div><h2 className="text-sm font-black text-slate-800">Majmua joylashuvi va xarita konturi</h2><p className="mt-1 text-xs leading-5 text-slate-500">Xaritada majmua hududini, keyin esa korpuslarni alohida poligon bilan belgilang. Bu ma’lumotlar majmua kartasida ishlatiladi.</p></div>
              <ResidentialComplexMap value={mapData} onChange={(next, center) => { setMapData(next); setMapCenter(center) }} />
            </div>
                        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-emerald-600 px-5 py-3.5 font-black text-white hover:bg-emerald-700 disabled:opacity-60">
              {loading ? 'Saqlanmoqda...' : 'Majmuani yaratish'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
