import type { Metadata } from 'next'
import SeoListingsPage, { getSeoListingsMetadata } from '@/app/listings/SeoListingsPage'

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = getSeoListingsMetadata('daily')

export default function DailyListingsPage(props: Props) {
  return <SeoListingsPage tab="daily" searchParams={props.searchParams} />
}
