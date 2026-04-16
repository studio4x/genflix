import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { PlatformFooter } from '@/components/layout/platform-footer'

interface PublicLegalPageShellProps {
  eyebrow: string
  title: string
  summary: string
  updatedAt: string
  children: ReactNode
}

export function PublicLegalPageShell({
  eyebrow,
  title,
  summary,
  updatedAt,
  children,
}: PublicLegalPageShellProps) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1398B7] to-[#0A3640] text-lg font-black text-white shadow-[0_10px_30px_rgba(10,54,64,0.18)]">
              GF
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-blue-600">
                {eyebrow}
              </p>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                {summary}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
              Atualizado em {updatedAt}
            </p>
            <Link
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-600 transition-colors hover:border-blue-200 hover:text-blue-600"
              to="/login"
            >
              Voltar ao login
            </Link>
          </div>
        </header>

        <section className="flex-1 py-8">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
            <div className="space-y-8">{children}</div>
          </article>
        </section>

        <PlatformFooter className="border-t border-slate-200 pt-6" />
      </div>
    </main>
  )
}
