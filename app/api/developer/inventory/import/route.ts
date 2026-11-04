import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import ExcelJS from 'exceljs'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_ROWS = 500
const CURRENCIES = ['USD', 'UZS', 'EUR']
const REQUIRED_HEADERS = ['unit_no', 'floor', 'rooms', 'area_m2', 'price', 'currency', 'plan_url']

type UnitImportRow = {
  row: number
  unit_no: string
  floor: number | null
  rooms: number | null
  area_m2: number | null
  price: number | null
  currency: string
  plan_url: string | null
  errors: string[]
}

async function getDeveloper() {
  const cookieStore = await cookies()
  const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) return { error: NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 }) }

  const db = serviceClient()
  const { data: account, error: accountError } = await db.from('profiles')
    .select('id,account_type').eq('id', userId).maybeSingle()
  if (accountError) return { error: NextResponse.json({ error: 'ACCOUNT_LOOKUP_FAILED' }, { status: 500 }) }
  if (!account || account.account_type !== 'partner') {
    return { error: NextResponse.json({ error: 'PARTNER_ACCOUNT_REQUIRED' }, { status: 403 }) }
  }

  const { data: partner, error: partnerError } = await db.from('partner_profiles')
    .select('id').eq('user_id', userId).maybeSingle()
  if (partnerError) return { error: NextResponse.json({ error: 'PARTNER_PROFILE_LOOKUP_FAILED' }, { status: 500 }) }
  if (!partner) return { error: NextResponse.json({ error: 'PARTNER_PROFILE_REQUIRED' }, { status: 403 }) }

  const { data: developer, error: developerError } = await db.from('developer_profiles')
    .select('id,user_id,verification_status').eq('partner_profile_id', partner.id).maybeSingle()
  if (developerError) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_LOOKUP_FAILED' }, { status: 500 }) }
  if (!developer) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_REQUIRED' }, { status: 403 }) }
  if (developer.verification_status !== 'verified') return { error: NextResponse.json({ error: 'DEVELOPER_NOT_APPROVED' }, { status: 403 }) }
  if (developer.user_id && developer.user_id !== userId) {
    return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_ACCESS_DENIED' }, { status: 403 }) }
  }
  if (!developer.user_id) {
    const { error } = await db.from('developer_profiles').update({ user_id: userId }).eq('id', developer.id)
    if (error) return { error: NextResponse.json({ error: 'DEVELOPER_PROFILE_LINK_FAILED' }, { status: 500 }) }
  }
  return { db, developer }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim()
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) throw new Error('FORMULA_NOT_ALLOWED')
    if ('text' in value && typeof value.text === 'string') return value.text.trim()
    if ('richText' in value && Array.isArray(value.richText)) return value.richText.map(part => part.text).join('').trim()
    if ('result' in value && value.result !== undefined) return cellText(value.result as ExcelJS.CellValue)
  }
  return ''
}

function numberValue(value: string): number | null {
  if (!value) return null
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return Number.NaN
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

async function parseImportFile(file: File) {
  if (!file || file.size === 0) throw new Error('FILE_EMPTY')
  if (file.size > MAX_FILE_BYTES) throw new Error('FILE_TOO_LARGE')
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('XLSX_ONLY')
  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('INVALID_XLSX')

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes)
  const sheet = workbook.worksheets.find(item => item.state === 'visible')
  if (!sheet) throw new Error('WORKSHEET_NOT_FOUND')
  if (sheet.rowCount > MAX_ROWS + 1) throw new Error('TOO_MANY_ROWS')

  const headerRow = sheet.getRow(1)
  const headerMap = new Map<string, number>()
  headerRow.eachCell((cell, column) => {
    const header = cellText(cell.value).toLowerCase().replace(/[\s-]+/g, '_')
    if (header) { if (headerMap.has(header)) throw new Error('DUPLICATE_HEADER:' + header); headerMap.set(header, column) }
  })
  const missing = REQUIRED_HEADERS.filter(header => !headerMap.has(header))
  if (missing.length) throw new Error('MISSING_COLUMNS:' + missing.join(','))

  const rows: UnitImportRow[] = []
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    const raw: Record<string, string> = {}
    for (const header of REQUIRED_HEADERS) {
      const column = headerMap.get(header)!
      try {
        raw[header] = cellText(row.getCell(column).value)
      } catch {
        raw[header] = ''
        if (!rows.some(item => item.row === rowNumber)) {
          rows.push({ row: rowNumber, unit_no: '', floor: null, rooms: null, area_m2: null, price: null, currency: 'USD', plan_url: null, errors: ['Formula qiymatlariga ruxsat berilmaydi'] })
        }
      }
    }
    if (REQUIRED_HEADERS.every(header => !raw[header])) continue
    const prior = rows.find(item => item.row === rowNumber)
    const errors = prior?.errors || []
    const unitNo = (raw.unit_no || '').trim()
    if (!unitNo) errors.push('Xonadon raqami majburiy')
    if (unitNo.length > 40) errors.push('Xonadon raqami 40 belgidan oshmasin')

    const floorValue = numberValue(raw.floor)
    const roomsValue = numberValue(raw.rooms)
    const areaValue = numberValue(raw.area_m2)
    const priceValue = numberValue(raw.price)
    if (raw.floor && (floorValue === null || !Number.isInteger(floorValue) || floorValue < 0 || floorValue > 250)) errors.push('Qavat 0–250 oralig‘ida butun son bo‘lishi kerak')
    if (raw.rooms && (roomsValue === null || !Number.isFinite(roomsValue) || roomsValue <= 0 || roomsValue > 20 || !Number.isInteger(roomsValue * 2))) errors.push('Xonalar soni 0.5–20 oralig‘ida bo‘lishi kerak')
    if (raw.area_m2 && (areaValue === null || !Number.isFinite(areaValue) || areaValue <= 0 || areaValue > 10000)) errors.push('Maydon 0–10 000 m² oralig‘ida bo‘lishi kerak')
    if (raw.price && (priceValue === null || !Number.isFinite(priceValue) || priceValue < 0 || priceValue > 1000000000000)) errors.push('Narx noto‘g‘ri')
    const currency = (raw.currency || 'USD').toUpperCase()
    if (!CURRENCIES.includes(currency)) errors.push('Valyuta USD, UZS yoki EUR bo‘lishi kerak')
    const planUrl = (raw.plan_url || '').trim()
    if (planUrl && (!/^https?:\/\//i.test(planUrl) || planUrl.length > 1000)) errors.push('Reja URL manzili noto‘g‘ri')

    const current = {
      row: rowNumber,
      unit_no: unitNo,
      floor: raw.floor ? floorValue as number : null,
      rooms: raw.rooms ? roomsValue as number : null,
      area_m2: raw.area_m2 ? areaValue as number : null,
      price: raw.price ? priceValue as number : null,
      currency,
      plan_url: planUrl || null,
      errors,
    }
    if (prior) Object.assign(prior, current)
    else rows.push(current)
  }

  if (!rows.length) throw new Error('NO_DATA_ROWS')
  if (rows.length > MAX_ROWS) throw new Error('TOO_MANY_ROWS')

  const duplicates = new Map<string, number[]>()
  rows.forEach(row => {
    if (!row.unit_no) return
    const key = row.unit_no.toLocaleLowerCase()
    duplicates.set(key, [...(duplicates.get(key) || []), row.row])
  })
  for (const [unitNo, rowNumbers] of duplicates) {
    if (rowNumbers.length > 1) {
      rows.filter(row => row.unit_no.toLocaleLowerCase() === unitNo)
        .forEach(row => row.errors.push('Fayl ichida takroriy xonadon raqami'))
    }
  }
  return rows
}

export async function POST(request: Request) {
  const context = await getDeveloper()
  if ('error' in context) return context.error

  const form = await request.formData()
  const buildingId = String(form.get('building_id') || '')
  const action = String(form.get('action') || 'preview')
  const file = form.get('file')
  if (!buildingId || !(file instanceof File)) {
    return NextResponse.json({ error: 'BUILDING_AND_FILE_REQUIRED' }, { status: 400 })
  }
  if (!['preview', 'import'].includes(action)) {
    return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
  }

  const { data: complexes, error: complexError } = await context.db.from('residential_complexes')
    .select('id').eq('developer_id', context.developer.id)
  if (complexError) return NextResponse.json({ error: 'OWNERSHIP_LOOKUP_FAILED' }, { status: 500 })
  const complexIds = (complexes || []).map(item => item.id)
  if (!complexIds.length) return NextResponse.json({ error: 'BUILDING_NOT_FOUND' }, { status: 404 })

  const { data: building, error: buildingError } = await context.db.from('residential_buildings')
    .select('id,name,complex_id').eq('id', buildingId).in('complex_id', complexIds).maybeSingle()
  if (buildingError) return NextResponse.json({ error: 'BUILDING_LOOKUP_FAILED' }, { status: 500 })
  if (!building) return NextResponse.json({ error: 'BUILDING_NOT_FOUND' }, { status: 404 })

  let rows: UnitImportRow[]
  try {
    rows = await parseImportFile(file)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INVALID_FILE'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const existingNumbers = new Set<string>()
  for (let offset = 0; offset < 100000; offset += 1000) {
    const { data: existingUnits, error: existingError } = await context.db.from('complex_units')
      .select('unit_no').eq('building_id', buildingId).not('unit_no', 'is', null)
      .range(offset, offset + 999)
    if (existingError) return NextResponse.json({ error: 'EXISTING_UNITS_LOOKUP_FAILED' }, { status: 500 })
    for (const item of existingUnits || []) existingNumbers.add(String(item.unit_no).trim().toLocaleLowerCase())
    if (!existingUnits || existingUnits.length < 1000) break
    if (offset === 99000) return NextResponse.json({ error: 'TOO_MANY_EXISTING_UNITS_TO_VALIDATE' }, { status: 409 })
  }
  rows.forEach(row => {
    if (row.unit_no && existingNumbers.has(row.unit_no.toLocaleLowerCase())) {
      row.errors.push('Bu xonadon raqami bazada allaqachon mavjud')
    }
  })

  const invalidRows = rows.filter(row => row.errors.length)
  const preview = {
    building: { id: building.id, name: building.name },
    totalRows: rows.length,
    validRows: rows.length - invalidRows.length,
    invalidRows: invalidRows.length,
    rows: rows.map(({ errors, ...row }) => ({ ...row, errors })),
  }
  if (invalidRows.length) {
    return NextResponse.json({ ...preview, imported: false }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  }
  if (action === 'preview') {
    return NextResponse.json({ ...preview, imported: false, readyToImport: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const payload = rows.map(row => ({
    building_id: buildingId,
    unit_no: row.unit_no,
    floor: row.floor,
    rooms: row.rooms,
    area_m2: row.area_m2,
    price: row.price,
    currency: row.currency,
    plan_url: row.plan_url,
    status: 'available',
  }))
  const { data, error } = await context.db.from('complex_units').insert(payload).select('id')
  if (error) return NextResponse.json({ error: 'IMPORT_INSERT_FAILED' }, { status: 500 })
  return NextResponse.json({ ...preview, imported: true, importedCount: data?.length || payload.length }, {
    status: 201,
    headers: { 'Cache-Control': 'no-store' },
  })
}
