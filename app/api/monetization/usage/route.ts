import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const [{ data: profile }, { count, error }] = await Promise.all([
    supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle(),
    // Only ACTIVE free listings consume the individual 3-listing allowance.
    // Drafts and listings waiting for moderation must never consume the quota.
    supabase.from('listings').select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id)
      .eq('status', 'active')
      .eq('is_free_listing', true),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const isIndividual = profile?.account_type === 'individual'
  const freeLimit = 3
  const used = isIndividual ? (count ?? 0) : 0
  return NextResponse.json({
    accountType: profile?.account_type ?? null,
    isIndividual,
    used,
    freeLimit,
    remaining: isIndividual ? Math.max(0, freeLimit - used) : null,
  })
}
