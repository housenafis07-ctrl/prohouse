import MobileAccountMenu from './MobileAccountMenu'
import PasskeyPrompt from './PasskeyPrompt'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <><MobileAccountMenu /><PasskeyPrompt />{children}</>
}
