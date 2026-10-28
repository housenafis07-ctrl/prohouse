import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function AccountCompanyProfileRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/register?redirect=/account/company-profile')

  const { data: plan } = await supabase.rpc('get_active_partner_plan', { p_user_id: user.id })
  const activePlan = Array.isArray(plan) && plan[0] ? plan[0] : null
  if (!activePlan?.company_profile) redirect('/account/monetization')

  const { data: partner } = await supabase
    .from('partner_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!partner) redirect('/account/monetization')
  redirect(`/partners/${partner.id}`)
}
