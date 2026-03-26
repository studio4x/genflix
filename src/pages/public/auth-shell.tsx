import type { ReactNode } from 'react'

import { PlatformFooter } from '@/components/layout/platform-footer'

interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <div className="flex flex-1 items-center justify-center p-6">
        <section className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </section>
      </div>
      <div className="px-6 pb-6">
        <div className="mx-auto w-full max-w-6xl border-t border-slate-200 pt-5">
          <PlatformFooter compact />
        </div>
      </div>
    </main>
  )
}
