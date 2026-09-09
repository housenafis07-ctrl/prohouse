'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getListingImageStoragePath, isAcceptedListingImage, LISTING_IMAGE_ACCEPT, LISTING_IMAGE_BUCKET, LISTING_IMAGE_MAX_SIZE } from '@/utils/listing-images'

type ListingImage = {
  id: string
  listing_id: string
  image_url: string
  sort_order: number
  storage_path: string | null
}

const getImageDimensions = (file: File): Promise<{ width: number | null; height: number | null }> => new Promise(resolve => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }) }
  image.onerror = () => { URL.revokeObjectURL(url); resolve({ width: null, height: null }) }
  image.src = url
})

export default function ListingImageManager({ listingId }: { listingId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<ListingImage[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const load = async () => {
    const db = createClient()
    const { data, error: loadError } = await db
      .from('listing_images')
      .select('id,listing_id,image_url,sort_order,storage_path')
      .eq('listing_id', listingId)
      .order('sort_order', { ascending: true })
    if (loadError) setError(loadError.message)
    setImages((data ?? []) as ListingImage[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [listingId])

  const renumber = (items: ListingImage[]) => items.map((item, index) => ({ ...item, sort_order: index }))

  const persistOrder = async (items: ListingImage[]) => {
    const db = createClient()
    for (const item of items) {
      const { error: updateError } = await db.from('listing_images').update({ sort_order: item.sort_order }).eq('id', item.id).eq('listing_id', listingId)
      if (updateError) throw updateError
    }
  }

  const moveImage = async (fromId: string, toId: string) => {
    if (fromId === toId || busy) return
    const current = [...images]
    const from = current.findIndex(item => item.id === fromId)
    const to = current.findIndex(item => item.id === toId)
    if (from < 0 || to < 0) return
    const [moved] = current.splice(from, 1)
    current.splice(to, 0, moved)
    const next = renumber(current)
    setImages(next)
    setBusy(true); setError('')
    try { await persistOrder(next) } catch (e) { setError(e instanceof Error ? e.message : 'Rasm tartibini saqlab bo‘lmadi.'); await load() } finally { setBusy(false); setDraggedId(null) }
  }

  const makePrimary = async (id: string) => {
    if (busy || images[0]?.id === id) return
    const current = [...images]
    const index = current.findIndex(item => item.id === id)
    if (index < 0) return
    const [selected] = current.splice(index, 1)
    current.unshift(selected)
    const next = renumber(current)
    setImages(next); setBusy(true); setError('')
    try { await persistOrder(next) } catch (e) { setError(e instanceof Error ? e.message : 'Asosiy rasmni saqlab bo‘lmadi.'); await load() } finally { setBusy(false) }
  }

  const upload = async (file: File) => {
    if (!isAcceptedListingImage(file)) throw new Error('Faqat JPG, PNG, WebP yoki GIF rasm yuklash mumkin.')
    if (file.size > LISTING_IMAGE_MAX_SIZE) throw new Error('Rasm hajmi 10 MB dan oshmasligi kerak.')
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) throw new Error('Sessiya tugagan. Qayta kiring.')
    const path = getListingImageStoragePath(user.id, listingId, file.name)
    const { error: uploadError } = await db.storage.from(LISTING_IMAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    const { width, height } = await getImageDimensions(file)
    const { data: publicData } = db.storage.from(LISTING_IMAGE_BUCKET).getPublicUrl(path)
    const nextOrder = images.length
    const { data, error: insertError } = await db.from('listing_images').insert({ listing_id: listingId, image_url: publicData.publicUrl, storage_path: path, sort_order: nextOrder, width, height, size_bytes: file.size, mime_type: file.type }).select('id,listing_id,image_url,sort_order,storage_path').single()
    if (insertError) {
      await db.storage.from(LISTING_IMAGE_BUCKET).remove([path])
      throw insertError
    }
    setImages(current => [...current, data as ListingImage])
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || busy) return
    setBusy(true); setError('')
    try {
      for (const file of Array.from(files)) await upload(file)
    } catch (e) { setError(e instanceof Error ? e.message : 'Rasm yuklashda xatolik yuz berdi.') }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = '' }
  }

  const removeImage = async (image: ListingImage) => {
    if (busy) return
    if (!window.confirm('Ushbu rasmni o‘chirmoqchimisiz?')) return
    setBusy(true); setError('')
    try {
      const db = createClient()
      if (image.storage_path) {
        const { error: storageError } = await db.storage.from(LISTING_IMAGE_BUCKET).remove([image.storage_path])
        if (storageError) throw storageError
      }
      const { error: deleteError } = await db.from('listing_images').delete().eq('id', image.id).eq('listing_id', listingId)
      if (deleteError) throw deleteError
      const next = renumber(images.filter(item => item.id !== image.id))
      setImages(next)
      if (next.length) await persistOrder(next)
    } catch (e) { setError(e instanceof Error ? e.message : 'Rasmni o‘chirishda xatolik yuz berdi.') }
    finally { setBusy(false) }
  }

  if (loading) return <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-black">Rasmlar</h2><p className="mt-2 text-sm text-slate-500">Rasmlar yuklanmoqda...</p></section>

  return <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="text-xl font-black">Rasmlar</h2><p className="mt-1 text-sm text-slate-500">Birinchi rasm e’lonning asosiy rasmi bo‘ladi. Rasmni sudrab tartibini o‘zgartiring.</p></div>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saqlanmoqda...' : '+ Rasm qo‘shish'}</button>
    </div>
    <input ref={inputRef} type="file" accept={LISTING_IMAGE_ACCEPT} multiple className="hidden" onChange={e => void handleFiles(e.target.files)} />
    {error && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {images.length === 0 ? <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="mt-5 flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-emerald-300"><span className="text-2xl">＋</span><span className="mt-1 font-bold">Rasm yuklash</span><span className="mt-1 text-xs">JPG, PNG, WebP yoki GIF · 10 MB gacha</span></button> : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((image, index) => <article key={image.id} draggable={!busy} onDragStart={() => setDraggedId(image.id)} onDragOver={e => e.preventDefault()} onDrop={() => draggedId && void moveImage(draggedId, image.id)} className={`overflow-hidden rounded-2xl border bg-white ${index === 0 ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
        <div className="relative aspect-[4/3] bg-slate-100"><img src={image.image_url} alt={`E’lon rasmi ${index + 1}`} className="h-full w-full object-cover" />{index === 0 && <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">Asosiy rasm</span>}</div>
        <div className="flex items-center justify-between gap-2 p-3"><span className="text-xs font-bold text-slate-500">{index + 1}-rasm</span><div className="flex gap-2"><button type="button" disabled={busy || index === 0} onClick={() => void makePrimary(image.id)} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40">Asosiy</button><button type="button" disabled={busy} onClick={() => void removeImage(image)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 disabled:opacity-40">O‘chirish</button></div></div>
      </article>)}
    </div>}
    {images.length > 0 && <p className="mt-4 text-xs text-slate-500">Jami {images.length} ta rasm. Asosiy rasmni “Asosiy” tugmasi bilan tanlashingiz mumkin.</p>}
  </section>
}
