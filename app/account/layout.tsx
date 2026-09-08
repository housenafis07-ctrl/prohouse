import AccountNavigation from './AccountNavigation'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AccountNavigation />
      {children}
    </div>
  )
}
