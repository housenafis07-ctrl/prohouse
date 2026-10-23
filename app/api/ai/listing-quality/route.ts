import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type QualityInput = {
  title?: string
  description?: string
  city?: string
  district?: string
  rooms?: string | number | null
  area_m2?: string | number | null
  floor?: string | number | null
  floors_total?: string | number | null
  price?: string | number | null
  image_count?: number
  has_video?: boolean
  has_main_image?: boolean
}

function text(value: unknown, max = 1000) { return String(value ?? '').trim().slice(0, max) }

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { listing?: QualityInput; language?: unknown } | null
  const listing = body?.listing || {}
  const language = body?.language === 'ru' ? 'ru' : 'uz'

  const title = text(listing.title, 180)
  const description = text(listing.description, 1500)
  const city = text(listing.city, 100)
  const district = text(listing.district, 100)
  const rooms = listing.rooms != null && text(listing.rooms) !== ''
  const area = listing.area_m2 != null && text(listing.area_m2) !== ''
  const floor = listing.floor != null && text(listing.floor) !== ''
  const floorsTotal = listing.floors_total != null && text(listing.floors_total) !== ''
  const price = listing.price != null && text(listing.price) !== ''
  const imageCount = Math.max(0, Math.min(Number(listing.image_count) || 0, 20))
  const hasVideo = listing.has_video === true
  const hasMainImage = listing.has_main_image === true || imageCount > 0

  // Deterministic score: no invented AI facts and no hidden changes to the listing.
  let dataScore = 0
  if (rooms) dataScore += 5
  if (area) dataScore += 5
  if (floor && floorsTotal) dataScore += 5
  if (city && district) dataScore += 5
  if (price) dataScore += 5

  let mediaScore = 0
  if (hasMainImage) mediaScore += 10
  if (imageCount >= 3) mediaScore += 5
  if (imageCount >= 6) mediaScore += 5
  if (imageCount >= 10) mediaScore += 5
  if (hasVideo) mediaScore += 5

  let contentScore = 0
  if (title.length >= 20) contentScore += 8
  else if (title.length >= 8) contentScore += 5
  if (description.length >= 120) contentScore += 7
  else if (description.length >= 50) contentScore += 5
  if (description.length >= 250) contentScore += 3
  if (description.length >= 500) contentScore += 2

  let completenessScore = 0
  if (city) completenessScore += 3
  if (district) completenessScore += 3
  if (area) completenessScore += 2
  if (rooms) completenessScore += 2

  const score = Math.min(100, dataScore + mediaScore + contentScore + completenessScore)
  const recommendations: string[] = []
  if (!title) recommendations.push(language === 'ru' ? 'Добавьте понятный заголовок.' : 'Aniq va tushunarli sarlavha qo‘shing.')
  if (!description || description.length < 120) recommendations.push(language === 'ru' ? 'Сделайте описание подробнее.' : 'Tavsifni batafsilroq yozing.')
  if (!rooms) recommendations.push(language === 'ru' ? 'Укажите количество комнат.' : 'Xonalar sonini ko‘rsating.')
  if (!area) recommendations.push(language === 'ru' ? 'Укажите площадь.' : 'Maydonni ko‘rsating.')
  if (!floor || !floorsTotal) recommendations.push(language === 'ru' ? 'Укажите этаж и этажность дома.' : 'Qavat va jami qavat sonini ko‘rsating.')
  if (!price) recommendations.push(language === 'ru' ? 'Укажите цену.' : 'Narxni ko‘rsating.')
  if (!hasMainImage) recommendations.push(language === 'ru' ? 'Добавьте главное фото.' : 'Asosiy rasmni qo‘shing.')
  else if (imageCount < 3) recommendations.push(language === 'ru' ? 'Добавьте ещё несколько фотографий.' : 'Yana bir nechta rasm qo‘shing.')
  if (imageCount < 6) recommendations.push(language === 'ru' ? 'Покажите квартиру с разных ракурсов.' : 'Kvarteirani turli rakurslardan ko‘rsatuvchi rasmlar qo‘shing.')
  if (!hasVideo) recommendations.push(language === 'ru' ? 'Видео может сделать объявление информативнее.' : 'Video e’lonni yanada tushunarli qilishi mumkin.')

  const uniqueRecommendations = [...new Set(recommendations)].slice(0, 5)
  const label = score >= 90 ? (language === 'ru' ? 'Отличное объявление' : 'Ajoyib e’lon') : score >= 75 ? (language === 'ru' ? 'Хорошее объявление' : 'Yaxshi e’lon') : score >= 55 ? (language === 'ru' ? 'Можно улучшить' : 'Yaxshilash mumkin') : (language === 'ru' ? 'Нужно улучшить' : 'Yaxshilash tavsiya etiladi')

  return NextResponse.json({ score, label, breakdown: { data: dataScore, media: mediaScore, content: contentScore, completeness: completenessScore }, recommendations: uniqueRecommendations }, { headers: { 'Cache-Control': 'no-store' } })
}
