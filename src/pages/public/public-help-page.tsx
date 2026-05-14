import { CircleHelp, LifeBuoy } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot'
import { genflixNavLinks } from '@/features/public/genflix-public-shell-content'
import {
  EditableButton,
  EditableContainer,
  EditableList,
  EditableText,
  isEditableItemVisible,
} from '@/features/site-editor/visual-editor'
import type { EditableListItem } from '@/features/site-editor/types'

const helpSectionsFallback: EditableListItem[] = [
  {
    id: 'conteudo-previsto',
    label: 'Conteúdo previsto',
    title: 'Conteúdo previsto',
    description: 'Aqui entraremos com tutoriais de navegação, uso da conta, recuperação de acesso, acompanhamento de cursos, recursos didáticos e boas práticas para aproveitar melhor a plataforma.',
  },
  {
    id: 'status-atual',
    label: 'Status atual',
    title: 'Status atual',
    description: 'A página já está publicada como placeholder institucional, com estrutura pronta para evoluir para uma central de ajuda completa sem quebrar navegação nem links do rodapé.',
  },
]

function HelpHeroSection() {
  return (
    <section className="bg-white pb-12 pt-6">
      <div className="public-site-container">
        <EditableContainer entryKey="global.institutional.help.hero.card" label="Container interno do Hero de ajuda" pageKey="global">
          <div className="overflow-hidden rounded-[32px] border border-[#D8E6EB] bg-[linear-gradient(180deg,#F8FBFC_0%,#EEF6F8_100%)] shadow-[0_22px_50px_rgba(21,50,59,0.05)]">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
              <div className="px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">
                  <EditableText
                    entryKey="global.institutional.help.eyebrow"
                    fallback="Central de ajuda"
                    label="Chamada da pagina de ajuda"
                    pageKey="global"
                  />
                </p>

                <h1 className="mt-4 max-w-[660px] text-[2.5rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
                  <EditableText
                    entryKey="global.institutional.help.title"
                    fallback="Ajuda / Como usar"
                    label="Titulo da pagina de ajuda"
                    pageKey="global"
                  />
                </h1>

                <p className="mt-4 max-w-[640px] text-base leading-8 text-[#5F7077]">
                  <EditableText
                    entryKey="global.institutional.help.description"
                    fallback="Esta seção será a base da futura central de ajuda com orientações práticas de uso da plataforma."
                    label="Descricao da pagina de ajuda"
                    pageKey="global"
                  />
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <EditableButton
                    entryKey="global.institutional.help.primary_button"
                    fallback={{ label: 'Criar conta', href: '/criar-conta', isInternal: true, tone: 'solid' }}
                    label="Botao principal da ajuda"
                    pageKey="global"
                  >
                    {(buttonValue) => (
                      <GenflixCtaButton asChild className="h-12 px-5">
                        {buttonValue.isInternal === true ? (
                          <Link to={typeof buttonValue.href === 'string' ? buttonValue.href : '/criar-conta'}>
                            {typeof buttonValue.label === 'string' ? buttonValue.label : 'Criar conta'}
                          </Link>
                        ) : (
                          <a
                            href={typeof buttonValue.href === 'string' ? buttonValue.href : '/criar-conta'}
                            target={buttonValue.openInNewTab === true ? '_blank' : undefined}
                            rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}
                          >
                            {typeof buttonValue.label === 'string' ? buttonValue.label : 'Criar conta'}
                          </a>
                        )}
                      </GenflixCtaButton>
                    )}
                  </EditableButton>
                </div>
              </div>

              <div className="flex items-stretch bg-[#0A3640] px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
                <div className="flex w-full items-center justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/10 text-white">
                    <LifeBuoy className="h-10 w-10" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </EditableContainer>
      </div>
    </section>
  )
}

function HelpContentSection() {
  return (
    <section id="conteudo-da-ajuda" className="bg-[#F2F7F9] py-4">
      <div className="public-site-container">
        <EditableContainer entryKey="global.institutional.help.content.card" label="Container interno do conteúdo da ajuda" pageKey="global">
          <div className="rounded-[30px] border border-[#D8E6EB] bg-white px-6 py-8 shadow-[0_18px_42px_rgba(21,50,59,0.04)] sm:px-8 sm:py-10">
            <div className="grid gap-5 lg:grid-cols-2">
              <EditableList
                entryKey="global.institutional.help.sections"
                fallback={helpSectionsFallback}
                label="Seções da pagina de ajuda"
                pageKey="global"
                schema={{
                  kind: 'default',
                  itemName: 'seção',
                  addLabel: 'Adicionar seção',
                  templates: helpSectionsFallback.map((item) => ({
                    id: item.id,
                    label: item.label ?? item.title ?? 'Seção',
                    description: item.description,
                    item,
                  })),
                }}
              >
                {(items) => items.filter(isEditableItemVisible).map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] px-6 py-6 shadow-[0_14px_30px_rgba(21,50,59,0.04)]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                      <CircleHelp className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-xl font-bold tracking-[-0.03em] text-[#183139]">
                      {item.title ?? item.label ?? 'Seção'}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-[#5F7077]">{item.description ?? ''}</p>
                  </article>
                ))}
              </EditableList>
            </div>
          </div>
        </EditableContainer>
      </div>
    </section>
  )
}

export function PublicHelpPage() {
  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="global" placementKey="hero" />
      <HelpHeroSection />
      <HelpContentSection />
      <GenflixPublicFooter />
    </main>
  )
}
