import type { ReactNode } from 'react'

import { AuthProvider } from '@/app/providers/auth-provider'
import { BrandingProvider } from '@/app/providers/branding-provider'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <BrandingProvider>{children}</BrandingProvider>
    </AuthProvider>
  )
}
