import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot'
import { genflixNavLinks } from '@/features/public/genflix-public-shell-content'
import { EditableButton, EditableText } from '@/features/site-editor/visual-editor'

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
      <GenflixPublicHeader navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="global" placementKey="hero" />

      <div className="public-site-container pt-4">
        <div className="overflow-hidden rounded-t-[30px] border border-[#D8E6EB] bg-white shadow-[0_24px_56px_rgba(21,50,59,0.05)]">
          <div className="border-b border-[#D8E6EB] bg-[#F2F8FA] px-6 py-10 sm:px-10 lg:px-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-[760px]">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#1398B7]">
                  <EditableText entryKey={`legal.${title}.eyebrow`} fallback={eyebrow} label="Chamada da página legal" />
                </p>
                <h1 className="mt-4 text-[2.6rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#183139] sm:text-[3.25rem]">
                  <EditableText entryKey={`legal.${title}.title`} fallback={title} label="Título da página legal" />
                </h1>
                <p className="mt-4 max-w-[640px] text-sm leading-7 text-[#183139] sm:text-base">
                  <EditableText entryKey={`legal.${title}.summary`} fallback={summary} label="Resumo da página legal" />
                </p>
              </div>

              <div className="rounded-[22px] border border-[#D8E6EB] bg-white px-5 py-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#97a6ab]">
                  Atualizado em <EditableText entryKey={`legal.${title}.updatedAt`} fallback={updatedAt} label="Data de atualização" />
                </p>
                <EditableButton
                  entryKey={`legal.${title}.backLoginButton`}
                  fallback={{ label: 'Voltar ao login', href: '/login', isInternal: true, tone: 'surface', isHidden: false }}
                  label="Botão voltar ao login"
                >
                  {(buttonValue) => buttonValue.isHidden === true ? null : (
                    <GenflixCtaButton asChild tone={buttonValue.tone === 'ghost' || buttonValue.tone === 'solid' ? buttonValue.tone : 'surface'} className="mt-4 px-4 py-2 text-xs font-black uppercase tracking-[0.2em]">
                      <Link to={typeof buttonValue.href === 'string' ? buttonValue.href : '/login'}>
                        {typeof buttonValue.label === 'string' ? buttonValue.label : 'Voltar ao login'}
                      </Link>
                    </GenflixCtaButton>
                  )}
                </EditableButton>
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
    </main>
  )
}
