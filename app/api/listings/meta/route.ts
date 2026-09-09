import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

type TaxonomyRow = {
  code: string
  parent_code: string | null
  name_uz: string
  name_ru: string | null
  section_code: string
  listing_type: string | null
  property_type: string | null
  node_type: string
  allows_partner_listing: boolean
  is_mortgage_filter: boolean
  is_new_construction_filter: boolean
  sort_order: number
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: taxonomy, error: taxonomyError }, { data: attributes, error: attributeError }] = await Promise.all([
    supabase
      .from('partner_listing_taxonomy')
      .select('code,parent_code,name_uz,name_ru,section_code,listing_type,property_type,node_type,allows_partner_listing,is_mortgage_filter,is_new_construction_filter,sort_order')
      .eq('is_active', true)
      .eq('node_type', 'category')
      .eq('allows_partner_listing', true)
      .order('section_code')
      .order('sort_order'),
    supabase
      .from('category_attributes')
      .select('id,category_code,code,name_uz,name_ru,data_type,options,unit,is_required,sort_order')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  if (taxonomyError || attributeError) {
    return NextResponse.json({ error: taxonomyError?.message || attributeError?.message }, { status: 500 })
  }

  let partnerType: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_type,partner_type')
      .eq('id', user.id)
      .maybeSingle()

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

  const categories = (taxonomy || []) as TaxonomyRow[]
  const filtered = categories
    .filter((c) => !allowedCodes || allowedCodes.has(c.code))
    .map((c) => ({
      ...c,
      entity_type: c.property_type || c.node_type,
      is_listable: c.allows_partner_listing,
    }))

  const filteredAttributes = (attributes || []).filter((a) => filtered.some((c) => c.code === a.category_code))

  return NextResponse.json({
    categories: filtered,
    attributes: filteredAttributes,
    partnerType,
  })
}
