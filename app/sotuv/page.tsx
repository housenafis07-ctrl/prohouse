import type { Metadata } from 'next'
import SeoListingsPage, { getSeoListingsMetadata } from '@/app/listings/SeoListingsPage'

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = getSeoListingsMetadata('sale')

export default function SaleListingsPage(props: Props) {
  return <SeoListingsPage tab="sale" searchParams={props.searchParams} />
}
