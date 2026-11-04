'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/app/components/I18nProvider'

type Unit = { id: string; unit_no: string | null; floor: number | null; rooms: number | null; area_m2: number | null; price: number | null; currency: string; status: string; building_id: string }
type Building = { id: string; name: string; complex_id: string }
type Complex = { id: string; name: string }
const statusLabels: Record<string, readonly [string, string]> = {
  available: ['Mavjud', 'Доступна'],
  reserved: ['Bron', 'Забронирована'],
  sold: ['Sotilgan', 'Продана'],
  hidden: ['Yashirilgan', 'Скрыта'],
}

export default function InventoryPage() {
  const { lang } = useI18n()
  const ru = lang === 'ru'
  const tx = (uz: string, rr: string) => ru ? rr : uz
  const [complexes, setComplexes] = useState<Complex[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [selected, setSelected] = useState('')
  const [selectedBuilding, setSelectedBuilding] = useState('')
  const [unitNo, setUnitNo] = useState('')
  const [floor, setFloor] = useState('')
  const [rooms, setRooms] = useState('')
  const [area, setArea] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const response = await fetch('/api/developer/inventory', { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Inventarni yuklab bo‘lmadi')
        setComplexes(result.complexes || [])
        setBuildings(result.buildings || [])
        setUnits(result.units || [])
        if (result.buildings?.length) setSelectedBuilding(result.buildings[0].id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Inventarni yuklab bo‘lmadi')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function addUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedBuilding) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/developer/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building_id: selectedBuilding,
          unit_no: unitNo,
          floor,
          rooms,
          area_m2: area,
          price,
          currency,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Xonadonni yaratib bo‘lmadi')
      setUnits(current => [...current, result.unit])
      setUnitNo(''); setFloor(''); setRooms(''); setArea(''); setPrice('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xonadonni saqlab bo‘lmadi')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(id: string, status: string) {
    const response = await fetch('/api/developer/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (response.ok) setUnits(current => current.map(unit => unit.id === id ? { ...unit, status } : unit))
    else setError(tx('Xonadon holatini yangilab bo‘lmadi.', 'Не удалось обновить статус квартиры.'))
  }

  const filtered = selected ? units.filter(unit => unit.building_id === selected) : units
  const buildingLabel = (building: Building) => {
    const complex = complexes.find(item => item.id === building.complex_id)
    return complex ? `${complex.name} · ${building.name}` : building.name
  }

  if (loading) return <main className="p-8">{tx('Yuklanmoqda...', 'Загрузка...')}</main>

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between">
          <Link href="/account/developer" className="font-bold text-emerald-700">← {tx('Developer kabineti', 'Кабинет девелопера')}</Link>
          <span className="text-sm font-bold text-slate-500">Inventory</span>
        </header>

        <section className="mt-5 rounded-3xl bg-slate-900 p-7 text-white">
          <h1 className="text-3xl font-black">{tx('Xonadonlar inventari', 'Инвентарь квартир')}</h1>
          <p className="mt-2 text-sm text-slate-300">{tx('Xonadonlarni qo‘shing, mavjudlik holati va narxlarini boshqaring.', 'Добавляйте квартиры и управляйте их статусом и ценами.')}</p>
        </section>

        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-white p-5"><p className="text-xs font-bold text-slate-400">{tx('JAMI', 'ВСЕГО')}</p><p className="mt-1 text-2xl font-black">{units.length}</p></div>
          {(['available', 'reserved', 'sold'] as const).map(status => (
            <div key={status} className="rounded-2xl bg-white p-5"><p className="text-xs font-bold text-slate-400">{statusLabels[status][ru ? 1 : 0].toUpperCase()}</p><p className="mt-1 text-2xl font-black">{units.filter(unit => unit.status === status).length}</p></div>
          ))}
        </div>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">{tx('Yangi xonadon qo‘shish', 'Добавить квартиру')}</h2>
          {!buildings.length ? (
            <div className="mt-4 rounded-2xl border border-dashed p-6 text-sm text-slate-500">
              {tx('Avval majmua uchun korpus yarating.', 'Сначала добавьте корпус для жилого комплекса.')}
              <Link href="/account/developer" className="ml-2 font-bold text-emerald-700">{tx('Majmualarga qaytish', 'К комплексам')}</Link>
            </div>
          ) : (
            <form onSubmit={addUnit} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block lg:col-span-2"><span className="mb-2 block text-sm font-bold text-slate-700">{tx('Majmua / korpus', 'Комплекс / корпус')} *</span>
                <select required value={selectedBuilding} onChange={e => setSelectedBuilding(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-3">
                  {buildings.map(building => <option key={building.id} value={building.id}>{buildingLabel(building)}</option>)}
                </select>
              </label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{tx('Xonadon raqami', 'Номер квартиры')}</span>
                <input maxLength={40} value={unitNo} onChange={e => setUnitNo(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4" placeholder="12-A" />
              </label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{tx('Qavat', 'Этаж')}</span>
                <input type="number" min="0" max="250" value={floor} onChange={e => setFloor(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4" />
              </label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{tx('Xonalar soni', 'Количество комнат')}</span>
                <input type="number" min="0.5" max="20" step="0.5" value={rooms} onChange={e => setRooms(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4" />
              </label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{tx('Maydon (m²)', 'Площадь (м²)')}</span>
                <input type="number" min="0.1" max="10000" step="0.01" value={area} onChange={e => setArea(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4" />
              </label>
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{tx('Narx', 'Цена')}</span>
                  <input type="number" min="0" max="1000000000000" value={price} onChange={e => setPrice(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-4" />
                </label>
                <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{tx('Valyuta', 'Валюта')}</span>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-2"><option value="USD">USD</option><option value="UZS">UZS</option><option value="EUR">EUR</option></select>
                </label>
              </div>
              <div className="flex items-end lg:col-span-4">
                <button disabled={saving} className="w-full rounded-xl bg-emerald-600 px-5 py-3.5 font-black text-white disabled:opacity-60 sm:w-auto">{saving ? tx('Saqlanmoqda...', 'Сохранение...') : tx('Xonadonni qo‘shish', 'Добавить квартиру')}</button>
              </div>
            </form>
          )}
        </section>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black">{tx('Inventar', 'Инвентарь')}</h2>
            <select value={selected} onChange={e => setSelected(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
              <option value="">{tx('Barcha korpuslar', 'Все корпуса')}</option>
              {buildings.map(building => <option key={building.id} value={building.id}>{buildingLabel(building)}</option>)}
            </select>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b text-xs uppercase text-slate-400">
                <th className="p-3">{tx('Xonadon', 'Квартира')}</th><th className="p-3">{tx('Korpus', 'Корпус')}</th><th className="p-3">{tx('Qavat', 'Этаж')}</th><th className="p-3">{tx('Xona', 'Комнаты')}</th><th className="p-3">{tx('Maydon', 'Площадь')}</th><th className="p-3">{tx('Narx', 'Цена')}</th><th className="p-3">{tx('Holat', 'Статус')}</th>
              </tr></thead>
              <tbody>{filtered.map(unit => {
                const building = buildings.find(item => item.id === unit.building_id)
                return <tr key={unit.id} className="border-b border-slate-100">
                  <td className="p-3 font-black">{unit.unit_no || '—'}</td><td className="p-3">{building?.name || '—'}</td><td className="p-3">{unit.floor ?? '—'}</td><td className="p-3">{unit.rooms ?? '—'}</td><td className="p-3">{unit.area_m2 ? `${unit.area_m2} m²` : '—'}</td><td className="p-3 font-bold">{unit.price !== null ? `${unit.price.toLocaleString(ru ? 'ru-RU' : 'uz-UZ')} ${unit.currency}` : '—'}</td>
                  <td className="p-3"><select value={unit.status} onChange={e => changeStatus(unit.id, e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label[ru ? 1 : 0]}</option>)}</select></td>
                </tr>
              })}</tbody>
            </table>
            {!filtered.length && <p className="py-10 text-center text-sm text-slate-500">{tx('Xonadonlar topilmadi.', 'Квартиры не найдены.')}</p>}
          </div>
        </section>
      </div>
    </main>
  )
}
