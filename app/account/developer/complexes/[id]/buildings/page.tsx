'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'

type Building = { id: string; name: string; building_no: string | null; floors: number | null; units_total: number | null; completion_date: string | null; status: string }
type Complex = { id: string; name: string }

export default function ComplexBuildingsPage({ params }: { params: Promise<{ id: string }> }) {
  const [complexId, setComplexId] = useState('')
  const [complex, setComplex] = useState<Complex | null>(null)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [name, setName] = useState('')
  const [buildingNo, setBuildingNo] = useState('')
  const [floors, setFloors] = useState('')
  const [unitsTotal, setUnitsTotal] = useState('')
  const [completionDate, setCompletionDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load(id: string) {
    const response = await fetch(`/api/developer/buildings?complex_id=${encodeURIComponent(id)}`, { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Korpuslarni yuklab bo‘lmadi')
    setComplex(result.complex)
    setBuildings(result.buildings || [])
  }

  useEffect(() => {
    let active = true
    params.then(({ id }) => {
      if (!active) return
      setComplexId(id)
      load(id).catch(e => setError(e instanceof Error ? e.message : 'Xatolik')).finally(() => setLoading(false))
    })
    return () => { active = false }
  }, [params])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/developer/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complex_id: complexId, name, building_no: buildingNo,
          floors: floors || null, units_total: unitsTotal || null,
          completion_date: completionDate || null,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Korpusni yaratib bo‘lmadi')
      setBuildings(current => [...current, result.building])
      setName(''); setBuildingNo(''); setFloors(''); setUnitsTotal(''); setCompletionDate('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Server bilan bog‘lanib bo‘lmadi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/account/developer" className="text-sm font-bold text-emerald-700">← Developer kabineti</Link>
        <div className="mt-5 rounded-3xl bg-slate-900 p-7 text-white">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Developer · Inventory</p>
          <h1 className="mt-2 text-3xl font-black">{complex?.name || 'Korpuslar boshqaruvi'}</h1>
          <p className="mt-2 text-sm text-slate-300">Majmua tarkibidagi bino va korpuslarni qo‘shing.</p>
        </div>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Yangi korpus</h2>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block"><span className="mb-2 block text-sm font-bold">Korpus nomi *</span>
                <input required maxLength={120} value={name} onChange={e => setName(e.target.value)} className="h-12 w-full rounded-xl border px-4" placeholder="1-korpus" />
              </label>
              <label className="block"><span className="mb-2 block text-sm font-bold">Korpus raqami</span>
                <input maxLength={40} value={buildingNo} onChange={e => setBuildingNo(e.target.value)} className="h-12 w-full rounded-xl border px-4" placeholder="A-1" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-2 block text-sm font-bold">Qavatlar soni</span>
                  <input type="number" min="1" max="200" value={floors} onChange={e => setFloors(e.target.value)} className="h-12 w-full rounded-xl border px-4" />
                </label>
                <label className="block"><span className="mb-2 block text-sm font-bold">Xonadonlar soni</span>
                  <input type="number" min="0" max="10000" value={unitsTotal} onChange={e => setUnitsTotal(e.target.value)} className="h-12 w-full rounded-xl border px-4" />
                </label>
              </div>
              <label className="block"><span className="mb-2 block text-sm font-bold">Topshirish sanasi</span>
                <input type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)} className="h-12 w-full rounded-xl border px-4" />
              </label>
              <button disabled={saving || loading} className="w-full rounded-xl bg-emerald-600 px-5 py-3.5 font-black text-white disabled:opacity-60">
                {saving ? 'Saqlanmoqda...' : 'Korpusni qo‘shish'}
              </button>
            </form>
          </section>
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="text-xl font-black">Korpuslar</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{buildings.length} ta</span></div>
            {loading ? <p className="mt-5 text-sm text-slate-500">Yuklanmoqda...</p> : !buildings.length ? <p className="mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">Hozircha korpuslar qo‘shilmagan.</p> : <div className="mt-5 space-y-3">
              {buildings.map(building => <div key={building.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{building.name}</h3><p className="mt-1 text-xs text-slate-500">{building.building_no || 'Raqam belgilanmagan'}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{building.status}</span></div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"><span>{building.floors ?? '—'} qavat</span><span>{building.units_total ?? '—'} xonadon</span><span>{building.completion_date || 'Sana belgilanmagan'}</span></div>
              </div>)}
            </div>}
          </section>
        </div>
      </div>
    </main>
  )
}
