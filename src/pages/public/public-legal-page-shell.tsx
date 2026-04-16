import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { genflixNavLinks } from '@/features/public/genflix-site-content'

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
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <section className="bg-[#F2F7F9] pt-4">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-6">
          <GenflixPublicHeader navLinks={genflixNavLinks} />

          <div className="mt-4 overflow-hidden rounded-t-[30px] border border-[#D8E6EB] bg-white shadow-[0_24px_56px_rgba(21,50,59,0.05)]">
            <div className="border-b border-[#D8E6EB] bg-[linear-gradient(180deg,#F8FBFC_0%,#F2F7F9_100%)] px-6 py-10 sm:px-10 lg:px-12">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-[760px]">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#1398B7]">
                    {eyebrow}
                  </p>
                  <h1 className="mt-4 text-[2.6rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#183139] sm:text-[3.25rem]">
                    {title}
                  </h1>
                  <p className="mt-4 max-w-[640px] text-sm leading-7 text-[#66787f] sm:text-base">
                    {summary}
                  </p>
                </div>

                <div className="rounded-[22px] border border-[#D8E6EB] bg-white px-5 py-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#97a6ab]">
                    Atualizado em {updatedAt}
                  </p>
                  <Link
                    className="mt-4 inline-flex items-center rounded-full border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#0A3640] transition-colors hover:border-[#1398B7] hover:text-[#1398B7]"
                    to="/login"
                  >
                    Voltar ao login
                  </Link>
                </div>
              </div>
            </div>

            <section className="px-6 py-8 sm:px-10 lg:px-12 lg:py-10">
              <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-sm sm:p-8 lg:p-10">
                <div className="space-y-8">{children}</div>
              </article>
            </section>
          </div>

          <GenflixPublicFooter />
        </div>
      </section>
    </main>
  )
}
