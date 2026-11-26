import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, serviceClient } from '@/utils/admin/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const { admin, error } = await requireSuperAdmin()
  if (error || !admin) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const db = serviceClient()
    // Load the live catalog independently from the optional audit table.
    // This keeps existing tariffs visible before the additive audit migration is applied.
    const { data: products, error: productsError } = await db.from('monetization_products')
      .select('code,name,name_ru,description,description_ru,price_uzs,duration_days,product_type,audience,unit,quantity,active,updated_at')
      .order('product_type', { ascending: true })
      .order('price_uzs', { ascending: true })
    if (productsError) throw productsError

    const { data: history, error: historyError } = await db.from('monetization_price_audit')
      .select('id,product_code,admin_user_id,old_price_uzs,new_price_uzs,old_duration_days,new_duration_days,old_active,new_active,created_at')
      .order('created_at', { ascending: false })
      .limit(30)

    const auditReady = !historyError
    const auditMissing = historyError?.code === '42P01' || historyError?.code === 'PGRST205'
    if (historyError && !auditMissing) throw historyError

    return NextResponse.json({
      products: products ?? [],
      history: history ?? [],
      auditReady,
      auditMessage: auditReady ? null : 'Tariflar yuklandi. Narxlarni saqlash uchun audit migratsiyasini qo‘llash kerak.',
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Tariflar yuklanmadi' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { admin, error } = await requireSuperAdmin()
  if (error || !admin) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const body = await request.json()
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const priceUzs = Number(body.priceUzs)
    const durationDays = Number(body.durationDays)
    const active = body.active
    if (!code || code.length > 100) return NextResponse.json({ error: 'Tarif kodi noto‘g‘ri.' }, { status: 400 })
    if (!Number.isFinite(priceUzs) || priceUzs < 0 || priceUzs > 1_000_000_000) return NextResponse.json({ error: 'Narx 0 dan 1 000 000 000 so‘mgacha bo‘lishi kerak.' }, { status: 400 })
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) return NextResponse.json({ error: 'Muddat 1–3650 kun oralig‘ida bo‘lishi kerak.' }, { status: 400 })
    if (typeof active !== 'boolean') return NextResponse.json({ error: 'Tarif holati noto‘g‘ri.' }, { status: 400 })
    if (active && priceUzs === 0) return NextResponse.json({ error: 'Narxi 0 so‘m bo‘lgan tarifni faollashtirib bo‘lmaydi.' }, { status: 400 })

    const db = serviceClient()
    const { data, error: updateError } = await db.rpc('admin_update_monetization_product_price', {
      p_product_code: code,
      p_price_uzs: priceUzs,
      p_duration_days: durationDays,
      p_active: active,
      p_admin_user_id: admin.user.id,
    })
    if (updateError) throw updateError
    return NextResponse.json({ ok: true, result: data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Tarif saqlanmadi' }, { status: 500 })
  }
}
