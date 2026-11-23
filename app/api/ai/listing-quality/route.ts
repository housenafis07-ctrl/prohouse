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
  listing_type?: string
  property_type?: string
  taxonomy_code?: string
  service_type?: string
  service_category_uz?: string
  service_category_ru?: string
  service_area_scope?: string
  service_regions?: unknown
  contact_phone?: string
  company_name?: string
}

function text(value: unknown, max = 1000) { return String(value ?? '').trim().slice(0, max) }

function normalize(value: unknown) {
  return text(value, 250).toLowerCase().replace(/[’‘`]/g, "'").replace(/[-–—]/g, ' ')
}

function isServiceListing(listing: QualityInput) {
  return listing.listing_type === 'service' || listing.property_type === 'service'
}

function serviceRecommendations(listing: QualityInput, language: 'uz' | 'ru', imageCount: number, hasVideo: boolean) {
  const name = text(language === 'ru' ? listing.service_category_ru || listing.service_type : listing.service_category_uz || listing.service_type, 100)
  const haystack = normalize([listing.taxonomy_code, listing.service_type, listing.service_category_uz, listing.service_category_ru, listing.title, listing.description].filter(Boolean).join(' '))
  const ru = language === 'ru'
  const recommendations: string[] = []

  if (!text(listing.title)) recommendations.push(ru ? 'Добавьте точное название услуги с указанием основного результата.' : 'Xizmat nomini aniq yozing va asosiy natijani ko‘rsating.')
  if (!text(listing.description) || text(listing.description).length < 120) recommendations.push(ru ? 'Подробно опишите, что входит в услугу, этапы работы и итоговый результат.' : 'Xizmat tarkibi, ish bosqichlari va yakuniy natijani batafsil yozing.')
  if (!text(listing.price)) recommendations.push(ru ? 'Укажите стоимость услуги или понятный способ расчёта цены.' : 'Xizmat narxi yoki narx qanday hisoblanishini aniq ko‘rsating.')
  if (!listing.service_area_scope && !(Array.isArray(listing.service_regions) && listing.service_regions.length)) recommendations.push(ru ? 'Укажите регион оказания услуги.' : 'Xizmat ko‘rsatiladigan hududni ko‘rsating.')

  if (haystack.includes('landshaft') || haystack.includes('ландшафт') || haystack.includes('obodon') || haystack.includes('bog')) {
    recommendations.push(ru ? 'Добавьте фото готовых ландшафтных работ: дворы, сады, зоны отдыха и озеленение.' : 'Tayyor landshaft ishlaridan: hovli, bog‘, dam olish zonasi va ko‘kalamzorlashtirish namunalaridan rasm qo‘shing.')
    recommendations.push(ru ? 'Покажите этапы работы: подготовка участка, планировка, посадка и результат «до/после».' : 'Ish jarayonini ko‘rsating: hududni tayyorlash, rejalashtirish, ekish va “oldin/keyin” natijalar.')
    recommendations.push(ru ? 'Укажите используемые растения, материалы и оборудование, если это важно для услуги.' : 'Xizmat uchun muhim bo‘lsa, ishlatiladigan o‘simliklar, materiallar va uskunalarni ko‘rsating.')
  } else if (haystack.includes('qurilish') || haystack.includes('строитель') || haystack.includes('uy qur') || haystack.includes('строительство')) {
    recommendations.push(ru ? 'Добавьте фото построенных вами домов и других завершённых объектов.' : 'O‘zingiz qurgan uylar va yakunlangan boshqa obyektlardan namunaviy rasmlar qo‘shing.')
    recommendations.push(ru ? 'Покажите этапы строительства и реальные результаты работ.' : 'Qurilish jarayonining bosqichlari va bajarilgan ishlarning real natijalarini ko‘rsating.')
    recommendations.push(ru ? 'Покажите используемую технику, инструменты и строительные материалы.' : 'Ishlatiladigan texnika, asbob-uskunalar va qurilish materiallarini ko‘rsating.')
  } else if (haystack.includes('remont') || haystack.includes('ta\'mir') || haystack.includes('отделк') || haystack.includes('ремонт')) {
    recommendations.push(ru ? 'Добавьте фото выполненного ремонта в разных помещениях и ракурсах.' : 'Bajarilgan ta’mirlash ishlaridan turli xonalar va rakurslardagi rasmlarni qo‘shing.')
    recommendations.push(ru ? 'Покажите процесс работы и результат «до/после».' : 'Ish jarayoni va “oldin/keyin” natijasini ko‘rsating.')
    recommendations.push(ru ? 'Укажите используемые материалы и оборудование.' : 'Ishlatiladigan materiallar va uskunalarni ko‘rsating.')
  } else if (haystack.includes('dizayn') || haystack.includes('design') || haystack.includes('дизайн') || haystack.includes('loyiha') || haystack.includes('проект')) {
    recommendations.push(ru ? 'Добавьте примеры готовых проектов, чертежей, визуализаций или 3D-моделей.' : 'Tayyor loyihalar, chizmalar, vizualizatsiyalar yoki 3D modellar namunalarini qo‘shing.')
    recommendations.push(ru ? 'Покажите путь от идеи и эскиза до готового проекта.' : 'G‘oya va eskizdan tayyor loyihagacha bo‘lgan jarayonni ko‘rsating.')
  } else if (haystack.includes('kamera') || haystack.includes('видеонаблю') || haystack.includes('cctv')) {
    recommendations.push(ru ? 'Покажите установленные системы видеонаблюдения и примеры готовых объектов.' : 'O‘rnatilgan kuzatuv kamerasi tizimlari va tayyor obyektlardan namunalar qo‘shing.')
    recommendations.push(ru ? 'Укажите используемые камеры, регистраторы и другое оборудование.' : 'Ishlatiladigan kameralar, registratorlar va boshqa uskunalarni ko‘rsating.')
    recommendations.push(ru ? 'Покажите процесс монтажа и настройки системы.' : 'Montaj va tizimni sozlash jarayonini ko‘rsating.')
  } else if (haystack.includes('konditsioner') || haystack.includes('кондиционер') || haystack.includes('klimat')) {
    recommendations.push(ru ? 'Добавьте фото установленных кондиционеров и готовых объектов.' : 'O‘rnatilgan konditsionerlar va tayyor obyektlardan namunalar qo‘shing.')
    recommendations.push(ru ? 'Покажите этапы монтажа и укажите используемое оборудование.' : 'O‘rnatish bosqichlari va ishlatiladigan uskunalarni ko‘rsating.')
  } else if (haystack.includes('mebel') || haystack.includes('мебел') || haystack.includes('мебель')) {
    recommendations.push(ru ? 'Добавьте фото готовой мебели: кухни, шкафы, столы и другие выполненные работы.' : 'Tayyor mebellardan: oshxona, shkaf, stol va boshqa bajarilgan ishlar namunalarini qo‘shing.')
    recommendations.push(ru ? 'Покажите материалы, фурнитуру и детали изготовления.' : 'Materiallar, furnitura va tayyorlash detallarini ko‘rsating.')
  } else if (haystack.includes('klin') || haystack.includes('уборк') || haystack.includes('clean')) {
    recommendations.push(ru ? 'Добавьте фото результата уборки и разных типов выполненных работ.' : 'Tozalashdan keyingi natija va turli turdagi bajarilgan ishlar rasmlarini qo‘shing.')
    recommendations.push(ru ? 'Покажите используемую технику, инвентарь и средства.' : 'Ishlatiladigan texnika, inventar va vositalarni ko‘rsating.')
  } else {
    recommendations.push(ru ? `Добавьте примеры выполненных работ по услуге «${name || 'этой услуге'}».` : `${name || 'Ushbu xizmat'} bo‘yicha bajarilgan ishlar namunalaridan rasm qo‘shing.`)
    recommendations.push(ru ? 'Покажите процесс работы, оборудование или материалы, которые используются.' : 'Ish jarayoni, ishlatiladigan uskuna yoki materiallarni ko‘rsating.')
    recommendations.push(ru ? 'Добавьте фото результата работы с разных ракурсов.' : 'Bajarilgan ish natijasini turli rakurslardan ko‘rsatuvchi rasmlar qo‘shing.')
  }

  if (imageCount < 3) recommendations.push(ru ? 'Загрузите ещё несколько качественных фото, чтобы показать услугу с разных сторон.' : 'Xizmatni yaxshiroq ko‘rsatish uchun yana bir nechta sifatli rasm yuklang.')
  if (!hasVideo) recommendations.push(ru ? 'Добавьте короткое видео процесса работы или готового результата.' : 'Ish jarayoni yoki tayyor natijadan qisqa video qo‘shing.')

  return [...new Set(recommendations)].slice(0, 5)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { listing?: QualityInput; language?: unknown } | null
  const listing = body?.listing || {}
  const language = body?.language === 'ru' ? 'ru' : 'uz'
  const service = isServiceListing(listing)

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
  const hasServiceCategory = !!text(listing.taxonomy_code || listing.service_type || listing.service_category_uz || listing.service_category_ru)
  const hasServiceRegion = !!text(listing.service_area_scope) || (Array.isArray(listing.service_regions) && listing.service_regions.length > 0)

  let dataScore = 0
  let mediaScore = 0
  let contentScore = 0
  let completenessScore = 0

  if (service) {
    if (hasServiceCategory) dataScore += 5
    if (title) dataScore += 5
    if (hasServiceRegion) dataScore += 5
    if (price) dataScore += 5
    if (listing.contact_phone || listing.company_name) dataScore += 5

    if (hasMainImage) mediaScore += 10
    if (imageCount >= 3) mediaScore += 5
    if (imageCount >= 6) mediaScore += 5
    if (imageCount >= 10) mediaScore += 5
    if (hasVideo) mediaScore += 5

    if (title.length >= 20) contentScore += 8
    else if (title.length >= 8) contentScore += 5
    if (description.length >= 120) contentScore += 7
    else if (description.length >= 50) contentScore += 5
    if (description.length >= 250) contentScore += 3
    if (description.length >= 500) contentScore += 2

    if (city) completenessScore += 3
    if (district || hasServiceRegion) completenessScore += 3
    if (listing.contact_phone) completenessScore += 2
    if (listing.company_name) completenessScore += 2
  } else {
    if (rooms) dataScore += 5
    if (area) dataScore += 5
    if (floor && floorsTotal) dataScore += 5
    if (city && district) dataScore += 5
    if (price) dataScore += 5

    if (hasMainImage) mediaScore += 10
    if (imageCount >= 3) mediaScore += 5
    if (imageCount >= 6) mediaScore += 5
    if (imageCount >= 10) mediaScore += 5
    if (hasVideo) mediaScore += 5

    if (title.length >= 20) contentScore += 8
    else if (title.length >= 8) contentScore += 5
    if (description.length >= 120) contentScore += 7
    else if (description.length >= 50) contentScore += 5
    if (description.length >= 250) contentScore += 3
    if (description.length >= 500) contentScore += 2

    if (city) completenessScore += 3
    if (district) completenessScore += 3
    if (area) completenessScore += 2
    if (rooms) completenessScore += 2
  }

  const rawScore = dataScore + mediaScore + contentScore + completenessScore
  const score = Math.round((rawScore / 85) * 100)
  const recommendations: string[] = []

  if (service) {
    recommendations.push(...serviceRecommendations(listing, language, imageCount, hasVideo))
  } else {
    if (!title) recommendations.push(language === 'ru' ? 'Добавьте понятный заголовок.' : 'Aniq va tushunarli sarlavha qo‘shing.')
    if (!description || description.length < 120) recommendations.push(language === 'ru' ? 'Сделайте описание подробнее.' : 'Tavsifni batafsilroq yozing.')
    if (!rooms) recommendations.push(language === 'ru' ? 'Укажите количество комнат.' : 'Xonalar sonini ko‘rsating.')
    if (!area) recommendations.push(language === 'ru' ? 'Укажите площадь.' : 'Maydonni ko‘rsating.')
    if (!floor || !floorsTotal) recommendations.push(language === 'ru' ? 'Укажите этаж и этажность дома.' : 'Qavat va jami qavat sonini ko‘rsating.')
    if (!price) recommendations.push(language === 'ru' ? 'Укажите цену.' : 'Narxni ko‘rsating.')
    if (!hasMainImage) recommendations.push(language === 'ru' ? 'Добавьте главное фото.' : 'Asosiy rasmni qo‘shing.')
    else if (imageCount < 3) recommendations.push(language === 'ru' ? 'Добавьте ещё несколько фотографий.' : 'Yana bir nechta rasm qo‘shing.')
    if (imageCount < 6) recommendations.push(language === 'ru' ? 'Покажите квартиру с разных ракурсов.' : 'Kvartirani turli rakurslardan ko‘rsatuvchi rasmlar qo‘shing.')
    if (!hasVideo) recommendations.push(language === 'ru' ? 'Видео может сделать объявление информативнее.' : 'Video e’lonni yanada tushunarli qilishi mumkin.')
  }

  const uniqueRecommendations = [...new Set(recommendations)].slice(0, 5)
  const label = score >= 90 ? (language === 'ru' ? 'Отличное объявление' : 'Ajoyib e’lon') : score >= 75 ? (language === 'ru' ? 'Хорошее объявление' : 'Yaxshi e’lon') : score >= 55 ? (language === 'ru' ? 'Можно улучшить' : 'Yaxshilash mumkin') : (language === 'ru' ? 'Нужно улучшить' : 'Yaxshilash tavsiya etiladi')

  return NextResponse.json({ score, label, breakdown: { data: dataScore, media: mediaScore, content: contentScore, completeness: completenessScore }, recommendations: uniqueRecommendations }, { headers: { 'Cache-Control': 'no-store' } })
}
