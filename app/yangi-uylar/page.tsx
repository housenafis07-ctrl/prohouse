import type { Metadata } from 'next'
import SeoListingsPage, { getSeoListingsMetadata } from '@/app/listings/SeoListingsPage'

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = getSeoListingsMetadata('new_building')

export default function NewBuildingListingsPage(props: Props) {
  return <SeoListingsPage tab="new_building" searchParams={props.searchParams} />
}
