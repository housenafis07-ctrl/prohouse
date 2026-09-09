'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getListingImageStoragePath, isAcceptedListingImage, LISTING_IMAGE_ACCEPT, LISTING_IMAGE_BUCKET, LISTING_IMAGE_MAX_SIZE } from '@/utils/listing-images'

type ListingImage = {
  id: string
  listing_id: string
  image_url: string
  sort_order: number
  storage_path: string | null
  file?: File
  isNew?: boolean
}

export type ListingImageManagerHandle = {
  saveChanges: () => Promise<void>
  hasPendingChanges: () => boolean
}

const getImageDimensions = (file: File): Promise<{ width: number | null; height: number | null }> => new Promise(resolve => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth, height: image.naturalHeight }) }
  image.onerror = () => { URL.revokeObjectURL(url); resolve({ width: null, height: null }) }
  image.src = url
})

const renumber = (items: ListingImage[]) => items.map((item, index) => ({ ...item, sort_order: index }))

const ListingImageManager = forwardRef<ListingImageManagerHandle, { listingId: string }>(function ListingImageManager({ listingId }, ref) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<ListingImage[]>([])
  const [originalIds, setOriginalIds] = useState<string[]>([])
  const [pendingDeletes, setPendingDeletes] = useState<ListingImage[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const load = async () => {
    const db = createClient()
    const { data, error: loadError } = await db.from('listing_images').select('id,listing_id,image_url,sort_order,storage_path').eq('listing_id', listingId).order('sort_order', { ascending: true })
    if (loadError) setError(loadError.message)
    const loaded = (data ?? []) as ListingImage[]
    setImages(loaded)
    setOriginalIds(loaded.map(item => item.id))
    setPendingDeletes([])
    setLoading(false)
  }

  useEffect(() => { void load() }, [listingId])

  useImperativeHandle(ref, () => ({
    hasPendingChanges: () => pendingDeletes.length > 0 || images.some((item, index) => item.isNew || originalIds[index] !== item.id),
    saveChanges: async () => {
      if (busy) throw new Error('Rasmlar hozir saqlanmoqda.')
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Sessiya tugagan. Qayta kiring.')
      setBusy(true); setError('')
      const uploadedPaths: string[] = []
      try {
        const current = images.filter(item => !pendingDeletes.some(deleted => deleted.id === item.id))
        const saved: ListingImage[] = []
        for (let index = 0; index < current.length; index++) {
          const item = current[index]
          if (!item.isNew || !item.file) { saved.push({ ...item, sort_order: index }); continue }
          const path = getListingImageStoragePath(user.id, listingId, item.file.name)
          const { error: uploadError } = await db.storage.from(LISTING_IMAGE_BUCKET).upload(path, item.file, { contentType: item.file.type, cacheControl: '31536000', upsert: false })
          if (uploadError) throw uploadError
          uploadedPaths.push(path)
          const { width, height } = await getImageDimensions(item.file)
          const { data: publicData } = db.storage.from(LISTING_IMAGE_BUCKET).getPublicUrl(path)
          const { data, error: insertError } = await db.from('listing_images').insert({ listing_id: listingId, image_url: publicData.publicUrl, storage_path: path, sort_order: index, width, height, size_bytes: item.file.size, mime_type: item.file.type }).select('id,listing_id,image_url,sort_order,storage_path').single()
          if (insertError) throw insertError
          saved.push(data as ListingImage)
        }
        for (const deleted of pendingDeletes) {
          const { error: deleteError } = await db.from('listing_images').delete().eq('id', deleted.id).eq('listing_id', listingId)
          if (deleteError) throw deleteError
        }
        for (let index = 0; index < saved.length; index++) {
          const item = saved[index]
          const { error: updateError } = await db.from('listing_images').update({ sort_order: -(index + 1) }).eq('id', item.id).eq('listing_id', listingId)
          if (updateError) throw updateError
        }
        for (let index = 0; index < saved.length; index++) {
          const item = saved[index]
          const { error: updateError } = await db.from('listing_images').update({ sort_order: index }).eq('id', item.id).eq('listing_id', listingId)
          if (updateError) throw updateError
        }
        for (const deleted of pendingDeletes) {
          if (deleted.storage_path) await db.storage.from(LISTING_IMAGE_BUCKET).remove([deleted.storage_path])
        }
        setImages(saved)
        setOriginalIds(saved.map(item => item.id))
        setPendingDeletes([])
      } catch (e) {
        if (uploadedPaths.length) await db.storage.from(LISTING_IMAGE_BUCKET).remove(uploadedPaths)
        throw e
      } finally { setBusy(false) }
    }
  }), [busy, images, originalIds, pendingDeletes, listingId])

  const moveImage = (fromId: string, toId: string) => {
    if (fromId === toId || busy) return
    const current = [...images]
    const from = current.findIndex(item => item.id === fromId)
    const to = current.findIndex(item => item.id === toId)
    if (from < 0 || to < 0) return
    const [moved] = current.splice(from, 1)
    current.splice(to, 0, moved)
    setImages(renumber(current)); setDraggedId(null); setError('')
  }

  const makePrimary = (id: string) => {
    if (busy || images[0]?.id === id) return
    const current = [...images]
    const index = current.findIndex(item => item.id === id)
    if (index < 0) return
    const [selected] = current.splice(index, 1)
    current.unshift(selected)
    setImages(renumber(current)); setError('')
  }

  const addImage = (file: File) => {
    if (!isAcceptedListingImage(file)) throw new Error('Faqat JPG, PNG, WebP yoki GIF rasm yuklash mumkin.')
    if (file.size > LISTING_IMAGE_MAX_SIZE) throw new Error('Rasm hajmi 10 MB dan oshmasligi kerak.')
    const local: ListingImage = { id: `local-${crypto.randomUUID()}`, listing_id: listingId, image_url: URL.createObjectURL(file), storage_path: null, sort_order: images.length, file, isNew: true }
    setImages(current => renumber([...current, local]))
  }

  const handleFiles = (files: FileList | null) => {
    if (!files?.length || busy) return
    setError('')
    try {
      if (images.length + files.length > 10) throw new Error('Maksimal 10 ta rasm.')
      for (const file of Array.from(files)) addImage(file)
    } catch (e) { setError(e instanceof Error ? e.message : 'Rasm yuklashda xatolik yuz berdi.') }
    finally { if (inputRef.current) inputRef.current.value = '' }
  }

  const removeImage = (image: ListingImage) => {
    if (busy) return
    if (!window.confirm('Ushbu rasmni o‘chirmoqchimisiz?')) return
    if (image.isNew && image.image_url.startsWith('blob:')) URL.revokeObjectURL(image.image_url)
    setImages(current => renumber(current.filter(item => item.id !== image.id)))
    if (!image.isNew) setPendingDeletes(current => [...current, image])
    setError('')
  }

  if (loading) return <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-black">Rasmlar</h2><p className="mt-2 text-sm text-slate-500">Rasmlar yuklanmoqda...</p></section>

  return <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black">Rasmlar</h2><p className="mt-1 text-sm text-slate-500">Birinchi rasm e’lonning asosiy rasmi bo‘ladi. Rasmni sudrab tartibini o‘zgartiring.</p></div><button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">+ Rasm qo‘shish</button></div>
    <input ref={inputRef} type="file" accept={LISTING_IMAGE_ACCEPT} multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
    {error && <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {images.length === 0 ? <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="mt-5 flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-emerald-300"><span className="text-2xl">＋</span><span className="mt-1 font-bold">Rasm yuklash</span><span className="mt-1 text-xs">JPG, PNG, WebP yoki GIF · 10 MB gacha</span></button> : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((image, index) => <article key={image.id} draggable={!busy} onDragStart={() => setDraggedId(image.id)} onDragOver={e => e.preventDefault()} onDrop={() => draggedId && moveImage(draggedId, image.id)} className={`overflow-hidden rounded-2xl border bg-white ${index === 0 ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}><div className="relative aspect-[4/3] bg-slate-100"><img src={image.image_url} alt={`E’lon rasmi ${index + 1}`} className="h-full w-full object-cover" />{index === 0 && <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">Asosiy rasm</span>}</div><div className="flex items-center justify-between gap-2 p-3"><span className="text-xs font-bold text-slate-500">{index + 1}-rasm</span><div className="flex gap-2"><button type="button" disabled={busy || index === 0} onClick={() => makePrimary(image.id)} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40">Asosiy</button><button type="button" disabled={busy} onClick={() => removeImage(image)} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 disabled:opacity-40">O‘chirish</button></div></div></article>)}</div>}
    {images.length > 0 && <p className="mt-4 text-xs text-slate-500">Jami {images.length} ta rasm. Asosiy rasmni “Asosiy” tugmasi bilan tanlashingiz mumkin.</p>}
  </section>
})

export default ListingImageManager
