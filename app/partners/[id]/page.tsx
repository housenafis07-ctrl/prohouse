import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { serviceClient } from '@/utils/admin/auth'
import { getListingCardImageUrl } from '@/lib/listing-image'

const SITE_URL = 'https://royalhouse.uz'

type Partner = {
  id: string
  user_id: string
  partner_type: string | null
  legal_form: string | null
  display_name: string | null
  company_name: string | null
  description: string | null
  logo_url: string | null
  website: string | null
  service_regions: string[] | null
  verification_status: string | null
  trusted_partner_status: string | null
}

type Listing = {
  id: string
  title: string
  title_ru: string | null
  price: number
  currency: string
  city: string | null
  district: string | null
  property_type: string | null
  listing_type: string | null
  primary_image_url: string | null
  is_verified: boolean
  is_trusted_seller: boolean
  published_at: string | null
}

async function getCompanyProfile(id: string) {
  const db = serviceClient()
  const { data: partner, error } = await db
    .from('partner_profiles')
    .select('id,user_id,partner_type,legal_form,display_name,company_name,description,logo_url,website,service_regions,verification_status,trusted_partner_status')
    .eq('id', id)
    .maybeSingle()

  if (error || !partner) return null

  const now = new Date().toISOString()
  const { data: entitlement } = await db
    .from('monetization_entitlements')
    .select('id,product_code,status,starts_at,ends_at')
    .eq('user_id', partner.user_id)
    .eq('product_code', 'partner_business')
    .eq('status', 'active')
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order('ends_at', { ascending: false, nullsFirst: true })
    .limit(1)
    .maybeSingle()

  if (!entitlement) return null

  const { data: listings } = await db
    .from('listings')
    .select('id,title,title_ru,price,currency,city,district,property_type,listing_type,primary_image_url,is_verified,is_trusted_seller,published_at')
    .eq('owner_id', partner.user_id)
    .eq('status', 'active')
    .order('published_at', { ascending: false })
    .limit(24)

  return { partner: partner as Partner, listings: (listings || []) as Listing[] }
}

function money(value: number, currency: string) {
  const formatted = new Intl.NumberFormat('uz-UZ').format(Number(value))
  return currency === 'USD' ? `$${formatted}` : `${formatted} so‘m`
}

function imageUrl(value: string | null) {
  if (!value) return '/royalhouse-icon.svg'
  const url = getListingCardImageUrl(value)
  return url.startsWith('http') ? url : url
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const result = await getCompanyProfile(id)
  if (!result) return { title: 'Firma profili — Royalhouse', robots: { index: false, follow: true } }

  const name = result.partner.company_name || result.partner.display_name || 'Royalhouse hamkori'
  return {
    title: `${name} — Firma profili | Royalhouse`,
    description: result.partner.description || `${name}ning Royalhouse'dagi professional firma profili va faol e'lonlari.`,
    alternates: { canonical: `${SITE_URL}/partners/${encodeURIComponent(id)}` },
    robots: { index: true, follow: true },
  }
}

export default async function CompanyProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getCompanyProfile(id)
  if (!result) notFound()

  const { partner, listings } = result
  const name = partner.company_name || partner.display_name || 'Royalhouse hamkori'
  const isTrusted = partner.trusted_partner_status === 'verified'
  const regions = Array.isArray(partner.service_regions) ? partner.service_regions.filter(Boolean) : []

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm font-bold text-emerald-700">← Royalhouse</Link>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="h-36 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 sm:h-48" />
          <div className="px-5 pb-7 sm:px-8">
            <div className="-mt-12 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-white shadow-lg sm:h-32 sm:w-32">
                  {partner.logo_url ? <img src={partner.logo_url} alt={name} className="h-full w-full object-cover" /> : <span className="text-3xl font-black text-emerald-600">{name.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-4xl">{name}</h1>
                    {isTrusted && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">✓ Ishonchli hamkor</span>}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-500">Professional BUSINESS hamkor profili</p>
                </div>
              </div>
              {partner.website && <a href={partner.website} target="_blank" rel="noreferrer" className="rounded-2xl bg-slate-950 px-5 py-3 text-center text-sm font-black text-white hover:bg-slate-800">Website →</a>}
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4"><span className="text-xs font-bold text-slate-400">E'lonlar</span><b className="mt-1 block text-2xl font-black text-slate-950">{listings.length}+</b></div>
              <div className="rounded-2xl bg-slate-50 p-4"><span className="text-xs font-bold text-slate-400">Hamkor turi</span><b className="mt-1 block text-lg font-black text-slate-950">{partner.partner_type || 'Professional'}</b></div>
              <div className="rounded-2xl bg-slate-50 p-4"><span className="text-xs font-bold text-slate-400">Faoliyat hududi</span><b className="mt-1 block text-lg font-black text-slate-950">{regions.length ? regions.slice(0, 2).join(', ') : 'O‘zbekiston'}</b></div>
            </div>

            {(partner.description || regions.length) && <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_320px]">
              {partner.description && <div><h2 className="text-lg font-black text-slate-950">Firma haqida</h2><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{partner.description}</p></div>}
              {regions.length > 0 && <div><h2 className="text-lg font-black text-slate-950">Xizmat hududlari</h2><div className="mt-3 flex flex-wrap gap-2">{regions.map(region => <span key={region} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{region}</span>)}</div></div>}
            </div>}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4"><div><span className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">BUSINESS</span><h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Faol e'lonlar</h2></div><span className="text-sm font-bold text-slate-400">{listings.length} ta</span></div>
          {listings.length === 0 ? <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Hozircha faol e'lonlar mavjud emas.</div> : <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{listings.map(listing => <Link key={listing.id} href={`/listings/${listing.id}`} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="aspect-[4/3] overflow-hidden bg-slate-100"><img src={imageUrl(listing.primary_image_url)} alt={listing.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /></div>
            <div className="p-4"><div className="flex flex-wrap gap-2">{listing.is_trusted_seller && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">✓ Ishonchli</span>}{listing.is_verified && <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black text-blue-700">✓ Tasdiqlangan</span>}</div><h3 className="mt-2 line-clamp-2 text-base font-black text-slate-950">{listing.title}</h3><p className="mt-2 text-sm font-black text-emerald-700">{money(listing.price, listing.currency)}</p><p className="mt-1 text-xs font-semibold text-slate-400">{[listing.district, listing.city].filter(Boolean).join(', ')}</p></div>
          </Link>)}</div>}
        </section>
      </div>
    </main>
  )
}
