import type { Metadata } from 'next'
import MortgageMarketPage from '@/app/ipoteka/_components/MortgageMarketPage'
export const metadata: Metadata = {title:'Ипотека на новостройку в Узбекистане | Royalhouse',description:'Yangi qurilish uchun ipoteka dasturlari, bank shartlari, mos obyektlar va Royalhouse kalkulyatori.',alternates:{canonical:'/ipoteka/novostroyka'},openGraph:{title:'Ипотека на новостройку | Royalhouse',description:'Yangi qurilish uchun bank ipoteka dasturlarini solishtiring.'}}
export default function Page(){return <MortgageMarketPage market="primary" />}
