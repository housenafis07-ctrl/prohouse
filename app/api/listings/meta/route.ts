import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const referer = request.headers.get('referer') || ''
  const requestedFlow = new URL(request.url).searchParams.get('flow')
  const flow = requestedFlow === 'service' || requestedFlow === 'property' ? requestedFlow : (referer.includes('/listings/new/service') ? 'service' : 'property')
  const editMatch = referer.match(/\/account\/listings\/([^/?#]+)\/edit(?:[/?#]|$)/)

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

  // When editing, scope metadata from the listing itself rather than the
  // partner's create permissions. This preserves the taxonomy already saved
  // on the listing and prevents steps 1–2 from becoming empty.
  if (editMatch && user) {
    const listingId = editMatch[1]
    const { data: listingForScope } = await supabase
      .from('listings')
      .select('taxonomy_code')
      .eq('id', listingId)
      .eq('owner_id', user.id)
      .maybeSingle()

    const existingCategory = (categories || []).find((c) => c.code === listingForScope?.taxonomy_code)
    if (existingCategory) {
      const scopedCategories = (categories || []).filter((c) => c.entity_type === existingCategory.entity_type)
      const scopedAttributes = (attributes || []).filter((a) => scopedCategories.some((c) => c.code === a.category_code))
      return NextResponse.json(
        { categories: scopedCategories, attributes: scopedAttributes, partnerType: null, scope: existingCategory.entity_type },
        { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      )
    }
  }

  let partnerType: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_type,partner_type')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.account_type === 'individual') {
      partnerType = 'owner'
    } else if (profile?.account_type === 'partner') {
      const { data: partnerProfile } = await supabase
        .from('partner_profiles')
        .select('partner_type')
        .eq('user_id', user.id)
        .maybeSingle()

      partnerType = partnerProfile?.partner_type || (
        ['owner', 'realtor', 'agency', 'developer', 'contractor', 'service_provider'].includes(profile.partner_type || '')
          ? profile.partner_type
          : null
      )
    }
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

  // These are separate listing flows. The property wizard must always receive
  // the active/listable property taxonomy; partner_category_permissions currently
  // contains service-provider-only permissions for some accounts, which otherwise
  // makes the property wizard's section picker completely empty. Service taxonomy
  // is returned only to the dedicated service wizard.
  const filtered = (categories || []).filter((c) => {
    const isServiceCategory = c.entity_type === 'service' && c.section_code === 'services'
    if (flow === 'service') return isServiceCategory
    return c.entity_type === 'property' && c.section_code !== 'services'
  })
  const filteredAttributes = (attributes || []).filter((a) => filtered.some((c) => c.code === a.category_code))

  return NextResponse.json(
    { categories: filtered, attributes: filteredAttributes, partnerType },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  )
}