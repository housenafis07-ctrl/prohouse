import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function AccountCompanyProfileRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/register?redirect=/account/company-profile')

  const { data: partner } = await supabase
    .from('partner_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!partner) redirect('/account/monetization')
  redirect(`/partners/${partner.id}`)
}
