import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: categories, error: categoryError }, { data: attributes, error: attributeError }] = await Promise.all([
    supabase
      .from('listing_categories')
      .select('code,parent_code,name_uz,name_ru,section_code,listing_type,property_type,entity_type,is_listable,is_mortgage_filter,is_new_construction_filter,sort_order')
      .eq('is_active', true)
      .eq('is_listable', true)
      .order('section_code')
      .order('sort_order'),
    supabase
      .from('category_attributes')
      .select('id,category_code,code,name_uz,name_ru,data_type,options,unit,is_required,sort_order')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  if (categoryError || attributeError) {
    return NextResponse.json({ error: categoryError?.message || attributeError?.message }, { status: 500 })
  }

  let partnerType: string | null = null
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('account_type,partner_type').eq('id', user.id).maybeSingle()
    if (profile?.account_type === 'individual') partnerType = 'owner'
    else if (profile?.account_type === 'partner') partnerType = profile.partner_type
  }

  let allowedCodes: Set<string> | null = null
  if (partnerType) {
    const { data: permissions } = await supabase
      .from('partner_category_permissions')
      .select('category_code')
      .eq('partner_type', partnerType)
      .eq('can_create', true)
    allowedCodes = new Set((permissions || []).map((x) => x.category_code))
  }

  const filtered = (categories || []).filter((c) => !allowedCodes || allowedCodes.has(c.code))
  const filteredAttributes = (attributes || []).filter((a) => filtered.some((c) => c.code === a.category_code))

  return NextResponse.json({ categories: filtered, attributes: filteredAttributes, partnerType })
}
