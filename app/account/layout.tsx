import Link from 'next/link'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="border-b border-slate-100 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2">
          <Link href="/account" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Kabinet</Link>
          <Link href="/account/wallet" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700 hover:bg-emerald-100">Hisob va tranzaksiyalar</Link>
        </div>
      </nav>
      {children}
    </div>
  )
}
