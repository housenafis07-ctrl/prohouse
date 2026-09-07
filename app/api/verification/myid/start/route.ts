import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 })

  const { error: requestError } = await supabase.rpc('request_trusted_profile')
  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 400 })

  // MyID uses a provider-specific redirect/Web SDK flow. Keep provider credentials
  // and endpoints server-side; never expose client secrets to the browser.
  const configured = Boolean(process.env.MYID_CLIENT_ID && process.env.MYID_REDIRECT_URI && process.env.MYID_AUTH_URL)

  if (!configured) {
    return NextResponse.json({
      configured: false,
      message: 'MyID ulanishi hali konfiguratsiya qilinmagan. Prohouse MyID credentials va redirect manzilini olgach, shu endpoint real MyID oqimiga ulanadi.',
    })
  }

  // The exact MyID redirect parameters are intentionally not guessed here.
  // After commercial/test access is issued by MyID, map their current Redirect/Web SDK
  // parameters here and persist the returned verification reference server-side.
  return NextResponse.json({
    configured: true,
    message: 'MyID konfiguratsiyasi topildi, lekin provider oqimi hali yakuniy parametrlar bilan ulanmadi.',
  }, { status: 501 })
}
