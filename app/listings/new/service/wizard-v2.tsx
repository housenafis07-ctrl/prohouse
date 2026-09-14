'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { UZBEKISTAN_LOCATIONS } from '@/data/uzbekistan-locations'
import { getListingImageStoragePath, isAcceptedListingImage, LISTING_IMAGE_ACCEPT, LISTING_IMAGE_BUCKET, LISTING_IMAGE_MAX_SIZE } from '@/utils/listing-images'

type Lang = 'uz' | 'ru'
type Category = { code: string; name_uz: string; name_ru: string | null; section_code: string; entity_type: string; is_listable?: boolean; sort_order: number }
type Img = { file: File; preview: string }
type ServiceRegion = { scope: 'all' | 'province' | 'district'; province: string; district?: string }

const STEPS = [
  { uz: 'Xizmat turi', ru: 'Услуга' },
  { uz: 'Ma’lumotlar', ru: 'Данные' },
  { uz: 'Hudud', ru: 'Регион' },
  { uz: 'Narx', ru: 'Цена' },
  { uz: 'Rasmlar', ru: 'Фото' },
  { uz: 'Tekshirish', ru: 'Проверка' },
]

const cleanDistrict = (v: string) => v.replace(/ tumani$/i, '').replace(/ shahri$/i, '')

export default function ServiceListingWizardV2() {
  const router = useRouter()
  const db = useMemo(() => createClient(), [])
  const [lang, setLang] = useState<Lang>('uz')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [step, setStep] = useState(1)
  const [listingId, setListingId] = useState<string | null>(null)
  const [partnerType, setPartnerType] = useState<string | null>(null)
  const [selectedCode, setSelectedCode] = useState('')
  const [images, setImages] = useState<Img[]>([])
  const [mainImage, setMainImage] = useState(0)
  const [regions, setRegions] = useState<ServiceRegion[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [form, setForm] = useState({ taxonomy_code: '', listing_type: 'service', property_type: 'service', title: '', description: '', price: '', currency: 'UZS', city: 'Toshkent', district: '', address: '', contact_phone: '', company_name: '' })

  const ru = lang === 'ru'
  const t = (uz: string, ruText: string) => ru ? ruText : uz
  const selected = categories.find(c => c.code === selectedCode) || null
  const allSelected = regions.some(r => r.scope === 'all')

  const locationNodes = useMemo(() => UZBEKISTAN_LOCATIONS.map(x => ({ name: x.name, districts: x.districts || [] })), [])
  const selectedProvinceNames = useMemo(() => new Set(regions.filter(r => r.scope === 'province').map(r => r.province)), [regions])
  const selectedDistrictKeys = useMemo(() => new Set(regions.filter(r => r.scope === 'district').map(r => `${r.province}::${r.district}`)), [regions])

  const update = (key: keyof typeof form, value: string) => setForm(v => ({ ...v, [key]: value }))

  useEffect(() => {
    const saved = window.localStorage.getItem('prohouse-lang')
    if (saved === 'ru') setLang('ru')
    const onLanguageChange = (event: Event) => {
      const next = (event as CustomEvent<Lang>).detail
      if (next === 'uz' || next === 'ru') setLang(next)
    }
    window.addEventListener('prohouse-language-change', onLanguageChange)
    return () => window.removeEventListener('prohouse-language-change', onLanguageChange)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const r = await fetch('/api/listings/meta', { cache: 'no-store' })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || t('Ma’lumotlar yuklanmadi', 'Не удалось загрузить данные'))
        const serviceCategories = (d.categories || []).filter((c: Category) => c.section_code === 'services' && c.entity_type === 'service' && c.is_listable !== false)
        if (!active) return
        setCategories(serviceCategories)
        setPartnerType(d.partnerType || null)
        if (!serviceCategories.length) throw new Error(t('Hozircha xizmat yo‘nalishlari topilmadi.', 'Сейчас нет доступных направлений услуг.'))
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : t('Yuklashda xatolik', 'Ошибка загрузки'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [t])

  useEffect(() => () => images.forEach(i => URL.revokeObjectURL(i.preview)), [images])

  const toggleAll = () => {
    setRegions(allSelected ? [] : [{ scope: 'all', province: 'O‘zbekiston' }])
  }

  const toggleProvince = (province: string) => {
    setRegions(prev => {
      if (prev.some(r => r.scope === 'all')) return prev
      const exists = prev.some(r => r.scope === 'province' && r.province === province)
      if (exists) return prev.filter(r => !(r.scope === 'province' && r.province === province))
      return [...prev.filter(r => !(r.scope === 'district' && r.province === province)), { scope: 'province', province }]
    })
  }

  const toggleDistrict = (province: string, district: string) => {
    setRegions(prev => {
      if (prev.some(r => r.scope === 'all' || (r.scope === 'province' && r.province === province))) return prev
      const exists = prev.some(r => r.scope === 'district' && r.province === province && r.district === district)
      if (exists) return prev.filter(r => !(r.scope === 'district' && r.province === province && r.district === district))
      return [...prev, { scope: 'district', province, district }]
    })
  }

  const removeRegion = (region: ServiceRegion) => {
    setRegions(prev => prev.filter(r => !(r.scope === region.scope && r.province === region.province && r.district === region.district)))
  }

  const regionSummary = () => {
    if (allSelected) return t('Butun O‘zbekiston', 'Весь Узбекистан')
    const provinces = regions.filter(r => r.scope === 'province').map(r => r.province)
    const districts = regions.filter(r => r.scope === 'district').map(r => `${r.province} / ${cleanDistrict(r.district || '')}`)
    return [...provinces, ...districts].join(', ') || t('Tanlanmagan', 'Не выбрано')
  }

  const payload = () => ({ ...form, taxonomy_code: selectedCode, listing_type: 'service', property_type: 'service', price: form.price.replace(/\s/g, ''), service_area_scope: allSelected ? 'all' : 'selected', service_regions: regions })

  const ensureSession = async () => {
    let user = (await db.auth.getUser()).data.user
    if (!user) {
      await db.auth.refreshSession()
      user = (await db.auth.getUser()).data.user
    }
    return user
  }

  const save = async (nextStep: number, status: 'draft' | 'moderation' = 'draft') => {
    setSaving(true)
    setError('')
    try {
      const user = await ensureSession()
      if (!user) throw new Error('AUTH_REQUIRED')
      const r = await fetch('/api/listings/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId, step: nextStep, data: payload(), status }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.message || d.error || t('Saqlashda xatolik', 'Ошибка сохранения'))
      setListingId(d.listing.id)
      setStep(nextStep)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Saqlashda xatolik', 'Ошибка сохранения'))
    } finally { setSaving(false) }
  }

  const validate = () => {
    if (!selectedCode) return t('Xizmat turini tanlang.', 'Выберите услугу.')
    if (step >= 2 && !form.title.trim()) return t('Xizmat sarlavhasini kiriting.', 'Введите заголовок услуги.')
    if (step >= 2 && !form.description.trim()) return t('Xizmat tavsifini kiriting.', 'Введите описание услуги.')
    if (step >= 3 && !regions.length) return t('Kamida bitta xizmat hududini tanlang.', 'Выберите хотя бы один регион оказания услуги.')
    if (step >= 4 && (!form.price || !Number.isFinite(Number(form.price.replace(/\s/g, ''))))) return t('To‘g‘ri narx kiriting.', 'Введите корректную цену.')
    if (step >= 5 && images.length === 0) return t('Kamida 1 ta rasm yuklang.', 'Загрузите хотя бы 1 фото.')
    return ''
  }

  const next = async () => {
    const validation = validate()
    if (validation) { setError(validation); return }
    setError('')
    if (step < 6) await save(step + 1)
  }

  const back = () => { setError(''); setStep(s => Math.max(1, s - 1)) }

  const cancel = async () => {
    if (!listingId) { router.push('/account'); return }
    setSaving(true)
    try {
      const user = await ensureSession()
      if (!user) throw new Error('AUTH_REQUIRED')
      const r = await fetch(`/api/listings/draft?listingId=${encodeURIComponent(listingId)}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(t('Qoralamani bekor qilib bo‘lmadi.', 'Не удалось отменить черновик.'))
      router.push('/account')
    } catch (e) { setError(e instanceof Error ? e.message : t('Xatolik yuz berdi.', 'Произошла ошибка.')) }
    finally { setSaving(false) }
  }

  const addImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (images.length + files.length > 10) { setError(t('Maksimal 10 ta rasm.', 'Максимум 10 фото.')); return }
    const bad = files.find(f => !isAcceptedListingImage(f) || f.size > LISTING_IMAGE_MAX_SIZE)
    if (bad) { setError(t('Faqat JPG, PNG, WebP yoki GIF rasm. Har biri 10 MB gacha.', 'Только JPG, PNG, WebP или GIF. Максимум 10 МБ на файл.')); return }
    setImages(prev => [...prev, ...files.map(file => ({ file, preview: URL.createObjectURL(file) }))])
  }

  const removeImage = (index: number) => {
    const image = images[index]
    if (image) URL.revokeObjectURL(image.preview)
    setImages(prev => prev.filter((_, i) => i !== index))
    setMainImage(0)
  }

  const getImageDimensions = (file: File): Promise<{ width: number | null; height: number | null }> => new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }) }
    image.onerror = () => { URL.revokeObjectURL(url); resolve({ width: null, height: null }) }
    image.src = url
  })

  const submit = async () => {
    const validation = validate()
    if (validation) { setError(validation); return }
    if (!listingId) { setError(t('Qoralama topilmadi.', 'Черновик не найден.')); return }
    setSaving(true); setError('')
    const uploaded: string[] = []
    let persisted = false
    try {
      const user = await ensureSession()
      if (!user) throw new Error('AUTH_REQUIRED')
      const ordered = [images[mainImage], ...images.filter((_, i) => i !== mainImage)]
      const rows = []
      for (let i = 0; i < ordered.length; i++) {
        const file = ordered[i].file
        const path = getListingImageStoragePath(user.id, listingId, file.name)
        const upload = await db.storage.from(LISTING_IMAGE_BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false })
        if (upload.error) throw upload.error
        uploaded.push(path)
        const dimensions = await getImageDimensions(file)
        const publicUrl = db.storage.from(LISTING_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
        rows.push({ listing_id: listingId, image_url: publicUrl, storage_path: path, sort_order: i, width: dimensions.width, height: dimensions.height, size_bytes: file.size, mime_type: file.type })
      }
      if (rows.length) {
        const { error: imageError } = await db.from('listing_images').insert(rows)
        if (imageError) throw imageError
        persisted = true
      }
      const r = await fetch('/api/listings/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId, step: 6, data: payload(), status: 'moderation' }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.message || d.error || t('Moderatsiyaga yuborilmadi', 'Не удалось отправить на модерацию'))
      setSuccess(t(`Xizmat e’loni moderatsiyaga yuborildi: ${d.listing.listing_code}`, `Объявление об услуге отправлено на модерацию: ${d.listing.listing_code}`))
      setTimeout(() => router.push('/account/listings'), 700)
    } catch (e) {
      if (!persisted && uploaded.length) await db.storage.from(LISTING_IMAGE_BUCKET).remove(uploaded)
      setError(e instanceof Error ? e.message : t('E’lonni yuborishda xatolik', 'Ошибка отправки объявления'))
    } finally { setSaving(false) }
  }

  if (loading) return <main className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-10 text-center">{t('Yuklanmoqda...', 'Загрузка...')}</div></main>

  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10"><div className="mx-auto max-w-4xl">
    <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">PROHOUSE</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{t('Xizmat e’loni joylashtirish', 'Разместить объявление об услуге')}</h1><p className="mt-1 text-sm text-slate-500">{t('Xizmat ko‘rsatuvchi uchun alohida e’lon formasi.', 'Отдельная форма для поставщика услуг.')}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => { const n: Lang = ru ? 'uz' : 'ru'; setLang(n); window.localStorage.setItem('prohouse-lang', n); window.dispatchEvent(new CustomEvent('prohouse-language-change', { detail: n })) }} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700">{ru ? 'Ru / O‘z' : 'O‘z / Ru'}</button><Link href="/account" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">{t('Shaxsiy kabinet', 'Личный кабинет')}</Link></div></div>
    {partnerType && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">{t('Xizmat e’lonlari xizmat ko‘rsatuvchi professional hamkorlar uchun mo‘ljallangan.', 'Объявления об услугах предназначены для профессиональных партнёров.')}</div>}
    <div className="mb-5 grid grid-cols-6 gap-1">{STEPS.map((item, i) => <div key={item.uz} className={`rounded-xl px-1 py-2 text-center text-[11px] font-semibold ${i + 1 === step ? 'bg-slate-950 text-white' : i + 1 < step ? 'bg-slate-200 text-slate-700' : 'bg-white text-slate-400'}`}><span className="hidden sm:inline">{i + 1}. </span>{ru ? item.ru : item.uz}</div>)}</div>
    <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-8">
      {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>}
      {success && <div className="mb-5 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{success}</div>}

      {step === 1 && <div><h2 className="text-xl font-bold">1. {t('Xizmat turini tanlang', 'Выберите услугу')}</h2><p className="mt-1 text-sm text-slate-500">{t('Siz taklif qiladigan xizmat yo‘nalishini tanlang.', 'Выберите направление услуги, которую вы предлагаете.')}</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{categories.map(c => <button key={c.code} type="button" onClick={() => { setSelectedCode(c.code); update('taxonomy_code', c.code) }} className={`rounded-2xl border p-5 text-left transition ${selectedCode === c.code ? 'border-emerald-500 bg-emerald-50' : 'hover:border-slate-950'}`}><b>{ru ? (c.name_ru || c.name_uz) : c.name_uz}</b><span className="mt-1 block text-sm text-slate-500">{t('Xizmat', 'Услуга')}</span></button>)}</div></div>}

      {step === 2 && <div><h2 className="text-xl font-bold">2. {t('Xizmat ma’lumotlari', 'Данные об услуге')}</h2><input value={form.title} onChange={e => update('title', e.target.value)} placeholder={t('Xizmat sarlavhasi', 'Заголовок услуги')} className="mt-5 w-full rounded-xl border p-3"/><textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder={t('Xizmatni batafsil tasvirlang', 'Подробно опишите услугу')} rows={7} className="mt-4 w-full rounded-xl border p-3"/><div className="mt-4 grid gap-4 sm:grid-cols-2"><input value={form.company_name} onChange={e => update('company_name', e.target.value)} placeholder={t('Kompaniya yoki usta nomi (ixtiyoriy)', 'Название компании или мастера (необязательно)')} className="rounded-xl border p-3"/><input value={form.contact_phone} onChange={e => update('contact_phone', e.target.value)} placeholder={t('Aloqa telefoni (ixtiyoriy)', 'Контактный телефон (необязательно)')} className="rounded-xl border p-3"/></div></div>}

      {step === 3 && <div><h2 className="text-xl font-bold">3. {t('Xizmat ko‘rsatiladigan hudud', 'Регион оказания услуги')}</h2><p className="mt-1 text-sm text-slate-500">{t('Bir yoki bir nechta viloyat/tuman tanlang. Butun O‘zbekistonni ham tanlash mumkin.', 'Выберите один или несколько регионов. Можно выбрать весь Узбекистан.')}</p>
        <button type="button" onClick={toggleAll} className={`mt-5 flex w-full items-center justify-between rounded-2xl border p-4 text-left ${allSelected ? 'border-emerald-500 bg-emerald-50' : 'hover:border-slate-950'}`}><span><b>{t('🇺🇿 Butun O‘zbekiston', '🇺🇿 Весь Узбекистан')}</b><small className="block text-slate-500">{t('Barcha viloyat va tumanlarda xizmat ko‘rsataman', 'Оказываю услуги во всех регионах')}</small></span><input readOnly type="checkbox" checked={allSelected} className="h-5 w-5"/></button>
        <div className="mt-4 space-y-2">{locationNodes.map(node => { const provinceSelected = selectedProvinceNames.has(node.name); const open = expanded === node.name; return <div key={node.name} className="overflow-hidden rounded-2xl border">
          <div className={`flex items-center gap-2 p-3 ${provinceSelected ? 'bg-emerald-50' : 'bg-white'}`}><button type="button" onClick={() => toggleProvince(node.name)} className="flex flex-1 items-center gap-3 text-left"><input readOnly type="checkbox" checked={provinceSelected} className="h-5 w-5"/><span className="font-semibold">{node.name}</span></button>{node.districts.length > 0 && <button type="button" onClick={() => setExpanded(open ? null : node.name)} className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-100">{open ? '▲' : '▼'}</button>}</div>
          {open && !provinceSelected && <div className="grid gap-1 border-t bg-slate-50 p-3 sm:grid-cols-2">{node.districts.map(district => { const key = `${node.name}::${district}`; const checked = selectedDistrictKeys.has(key); return <button type="button" key={district} onClick={() => toggleDistrict(node.name, district)} className={`rounded-xl border p-3 text-left text-sm ${checked ? 'border-emerald-500 bg-emerald-50' : 'bg-white hover:border-slate-950'}`}><input readOnly type="checkbox" checked={checked} className="mr-2"/>{cleanDistrict(district)}</button> })}</div>}
        </div> })}</div>
        <div className="mt-5 rounded-2xl bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Tanlangan hududlar', 'Выбранные регионы')}</div><div className="mt-2 text-sm font-semibold text-slate-800">{regionSummary()}</div>{regions.length > 0 && !allSelected && <div className="mt-3 flex flex-wrap gap-2">{regions.map((r, i) => <button key={`${r.scope}-${r.province}-${r.district}-${i}`} type="button" onClick={() => removeRegion(r)} className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium hover:bg-red-50">{r.scope === 'province' ? r.province : `${r.province} / ${cleanDistrict(r.district || '')}`} ×</button>)}</div>}</div>
      </div>}

      {step === 4 && <div><h2 className="text-xl font-bold">4. {t('Narx va shartlar', 'Цена и условия')}</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><input value={form.price} onChange={e => update('price', e.target.value)} placeholder={t('Narx', 'Цена')} inputMode="numeric" className="rounded-xl border p-3 sm:col-span-2"/><select value={form.currency} onChange={e => update('currency', e.target.value)} className="rounded-xl border p-3"><option>UZS</option><option>USD</option></select></div><p className="mt-3 text-sm text-slate-500">{t('Masalan: 150 000 so‘mdan yoki xizmat hajmiga qarab.', 'Например: от 150 000 сум или по объёму работ.')}</p></div>}

      {step === 5 && <div><h2 className="text-xl font-bold">5. {t('Rasmlar', 'Фото')}</h2><p className="mt-1 text-sm text-slate-500">{t('Xizmatingiz namunalaridan 10 tagacha rasm yuklang.', 'Загрузите до 10 фото с примерами вашей работы.')}</p><label className="mt-5 flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed p-10 text-sm font-semibold"><input type="file" accept={LISTING_IMAGE_ACCEPT} multiple onChange={addImages} className="hidden"/>{t('Rasmlarni tanlash', 'Выбрать фото')}</label><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{images.map((im, i) => <div key={im.preview} className="relative overflow-hidden rounded-2xl border"><img src={im.preview} className="aspect-square w-full object-cover"/><button type="button" onClick={() => removeImage(i)} className="absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-xs">×</button>{i === mainImage && <span className="absolute bottom-2 left-2 rounded-full bg-slate-950 px-2 py-1 text-[10px] text-white">{t('Asosiy', 'Основное')}</span>}</div>)}</div></div>}

      {step === 6 && <div><h2 className="text-xl font-bold">6. {t('Tekshirish', 'Проверка')}</h2><div className="mt-5 space-y-3">{[[t('Xizmat turi', 'Услуга'), ru ? (selected?.name_ru || selected?.name_uz || '—') : (selected?.name_uz || '—')], [t('Sarlavha', 'Заголовок'), form.title || '—'], [t('Hudud', 'Регион'), regionSummary()], [t('Manzil', 'Адрес'), form.address || '—'], [t('Narx', 'Цена'), `${form.price || '—'} ${form.currency}`], [t('Rasmlar', 'Фото'), `${images.length} ${t('ta', 'шт.')}`]].map(([a, b]) => <div key={String(a)} className="flex justify-between gap-5 rounded-2xl bg-slate-50 p-4 text-sm"><span className="text-slate-500">{a}</span><b className="text-right">{b}</b></div>)}</div><p className="mt-5 text-sm text-slate-500">{t('E’lon moderatsiyaga yuborilgach, tasdiqlangandan so‘ng xizmatlar katalogida ko‘rsatiladi.', 'После отправки на модерацию объявление появится в каталоге услуг после подтверждения.')}</p></div>}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><div className="flex gap-2"><button type="button" onClick={back} disabled={step === 1 || saving} className="rounded-xl border px-5 py-3 text-sm font-semibold disabled:opacity-40">{t('Orqaga', 'Назад')}</button><button type="button" onClick={() => void cancel()} disabled={saving} className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 disabled:opacity-40">{t('Bekor qilish', 'Отмена')}</button></div>{step < 6 ? <button type="button" onClick={() => void next()} disabled={saving || (step === 1 && !selectedCode)} className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40">{saving ? t('Saqlanmoqda...', 'Сохранение...') : t('Davom etish', 'Продолжить')}</button> : <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40">{saving ? t('Yuborilmoqda...', 'Отправка...') : t('Xizmat e’lonini yuborish', 'Отправить объявление')}</button>}</div>
    </section></div></main>
}
