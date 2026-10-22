import type { Metadata } from 'next'
import SeoListingsPage, { getSeoListingsMetadata } from '@/app/listings/SeoListingsPage'

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = getSeoListingsMetadata('rent')

export default function RentalListingsPage(props: Props) {
  return <SeoListingsPage tab="rent" searchParams={props.searchParams} />
}
