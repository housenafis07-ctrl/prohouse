import type { Metadata } from 'next'
import MortgageMarketPage from '@/app/ipoteka/_components/MortgageMarketPage'
export const metadata: Metadata = {title:'Ипотека на вторичном рынке в Узбекистане | Royalhouse',description:'Ikkilamchi bozordan uy-joy sotib olish uchun bank ipoteka dasturlari, shartlar, mos obyektlar va kalkulyator.',alternates:{canonical:'/ipoteka/vtorichnyy-rynok'},openGraph:{title:'Ипотека на вторичном рынке | Royalhouse',description:'Bank ipoteka dasturlarini solishtiring va mos uylarni ko‘ring.'}}
export default function Page(){return <MortgageMarketPage market="secondary" />}
