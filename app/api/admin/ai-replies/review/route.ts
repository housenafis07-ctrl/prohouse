import { NextRequest, NextResponse } from 'next/server'
import { getCurrentAdmin, serviceClient } from '@/utils/admin/auth'

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const draftId = String(body?.draftId || '').trim()
    const action = String(body?.action || '')
    if (!draftId) return NextResponse.json({ error: 'draftId talab qilinadi.' }, { status: 400 })
    if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'Noto‘g‘ri amal.' }, { status: 400 })

    const db = serviceClient()
    const nextStatus = action === 'approve' ? 'approved' : 'rejected'
    const { data, error } = await db.from('ai_reply_drafts')
      .update({
        status: nextStatus,
        reviewed_by: admin.user.id,
        reviewed_at: new Date().toISOString(),
        send_error: null,
      })
      .eq('id', draftId)
      .eq('status', 'pending_review')
      .select('id,support_message_id,generated_reply,status,language,model,evidence,reviewed_at')
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Loyiha topilmadi yoki avval ko‘rib chiqilgan.' }, { status: 409 })
    return NextResponse.json({ draft: data })
  } catch (error) {
    console.error('RoyalHouse AI draft review failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'AI javob loyihasini saqlab bo‘lmadi.' }, { status: 500 })
  }
}
