import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceClient } from '@/utils/admin/auth'
import { ACCOUNT_SESSION_COOKIE, readAccountSession } from '@/utils/auth/account-session'

export async function GET() {
  const cookieStore = await cookies()
  const userId = readAccountSession(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value)
  if (!userId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const db = serviceClient()
  const { data: participants, error: participantError } = await db.from('conversation_participants').select('conversation_id').eq('user_id', userId)
  if (participantError) return NextResponse.json({ error: participantError.message }, { status: 500 })
  const ids = [...new Set((participants || []).map(row => row.conversation_id))]
  let conversations: any[] = []
  let messages: any[] = []
  if (ids.length) {
    const { data: rows, error } = await db.from('conversations').select('id,listing_id,updated_at,listings(title)').in('id', ids).order('updated_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const { data: messageRows, error: messageError } = await db.from('messages').select('id,conversation_id,sender_id,body,created_at,read_at').in('conversation_id', ids).order('created_at', { ascending: true })
    if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 })
    messages = messageRows || []
    conversations = (rows || []).map((row: any) => {
      const chatMessages = messages.filter(message => message.conversation_id === row.id)
      const last = chatMessages[chatMessages.length - 1]
      return { id: row.id, listing_id: row.listing_id, updated_at: row.updated_at, title: row.listings?.title || 'E’lon bo‘yicha chat', lastMessage: last?.body || 'Hali xabarlar yo‘q', unread: chatMessages.filter(message => message.sender_id !== userId && !message.read_at).length }
    })
  }
  const { data: notifications, error: notificationError } = await db.from('notifications').select('id,title,body,link,read_at,created_at,conversation_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
  if (notificationError) return NextResponse.json({ error: notificationError.message }, { status: 500 })
  return NextResponse.json({ userId, conversations, messages, notifications: notifications || [] }, { headers: { 'Cache-Control': 'no-store' } })
}
