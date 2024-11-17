'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

export default function LoginButton() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    })
    router.refresh()
  }

  return (
    <button
      className="bg-black text-white px-4 py-2 rounded"
      onClick={handleLogin}
    >
      Login with GitHub
    </button>
  )
}