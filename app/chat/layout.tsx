import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/register?redirect=/chat')

  return children
}
