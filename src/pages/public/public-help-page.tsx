import { CircleHelp, LifeBuoy, MessageCircleMore } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot'
import { genflixNavLinks } from '@/features/public/genflix-public-shell-content'
import {
  createSectionRegistryFallback,
  createSectionRegistrySchema,
  renderVisibleSectionList,
  resolveSectionRegistryEntryPrefix,
  resolveSectionRegistryPageKey,
  resolveSectionRegistryTemplateKey,
  SectionStructureControl,
} from '@/features/site-editor/section-registry'
import {
  EditableButton,
  EditableContainer,
  EditableList,
  EditableText,
  isEditableItemVisible,
  useEditableValue,
} from '@/features/site-editor/visual-editor'
import { cn } from '@/lib/utils'

const helpSectionTemplates = [
  {
    id: 'hero',
    label: 'Hero da ajuda',
    description: 'Bloco de abertura com titulo, descricao e atalhos principais.',
  },
  {
    id: 'topics',
    label: 'Tópicos rápidos',
    description: 'Cards com orientacoes rápidas para os principais caminhos da plataforma.',
  },
  {
    id: 'support',
    label: 'Encaminhamento para suporte',
    description: 'Chamada final para suporte por ticket e contato institucional.',
  },
]

const helpLayoutFallback = createSectionRegistryFallback(helpSectionTemplates)
const helpLayoutSchema = createSectionRegistrySchema({
  templates: helpSectionTemplates,
  instancePrefix: 'global.institutional.help.sections',
  instancePageKey: 'global',
})

const helpTopicsFallback = [
  {
    id: 'access',
    label: 'Acesso e conta',
    title: 'Acesso e conta',
    description: 'Saiba como entrar, recuperar senha e ajustar os dados da sua conta.',
  },
  {
    id: 'courses',
    label: 'Cursos e progresso',
    title: 'Cursos e progresso',
    description: 'Entenda onde encontrar seus cursos, trilhas e o acompanhamento de estudos.',
  },
  {
    id: 'purchase',
    label: 'Pagamento e compra',
    title: 'Pagamento e compra',
    description: 'Veja como funciona a compra, a confirmação e o acesso após a inscrição.',
  },
  {
    id: 'support-ticket',
    label: 'Suporte por ticket',
    title: 'Suporte por ticket',
    description: 'Quando a ajuda precisar de análise, o caminho certo é abrir um chamado logado.',
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
                    fallback="Encontre orientacoes praticas sobre acesso, navegação, cursos, compras e suporte na GenFlix."
                    label="Descricao da pagina de ajuda"
                    pageKey="global"
                  />
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <GenflixCtaButton asChild className="h-12 px-5">
                    <Link to="/suporte">
                      <EditableText
                        entryKey="global.institutional.help.primary_button.label"
                        fallback="Abrir suporte"
                        label="Botao principal da ajuda"
                        pageKey="global"
                      />
                    </Link>
                  </GenflixCtaButton>

                  <GenflixCtaButton asChild tone="surface" className="h-12 px-5 text-[#0A3640]">
                    <a href="#topicos-rapidos">
                      <EditableText
                        entryKey="global.institutional.help.secondary_button.label"
                        fallback="Ver tópicos rápidos"
                        label="Botao secundario da ajuda"
                        pageKey="global"
                      />
                    </a>
                  </GenflixCtaButton>
                </div>
              </div>

              <div className="flex items-stretch bg-[#0A3640] px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
                <div className="flex w-full flex-col justify-between gap-8 text-white">
                  <div className="space-y-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
                      <LifeBuoy className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/72">Atalhos úteis</p>
                      <p className="mt-2 max-w-[320px] text-sm leading-7 text-white/74">
                        A ajuda da GenFlix foi pensada para resolver as dúvidas mais comuns sem quebrar o fluxo da experiência pública.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {[
                      'Recuperar acesso à conta',
                      'Encontrar cursos e progresso',
                      'Entender pagamento e suporte',
                    ].map((item) => (
                      <div key={item} className="rounded-[18px] border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-white/90">
                        {item}
                      </div>
                    ))}
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

function HelpTopicsSection() {
  return (
    <section id="topicos-rapidos" className="bg-[#F2F7F9] py-4">
      <div className="public-site-container">
        <EditableContainer entryKey="global.institutional.help.topics.wrap" label="Container interno dos topicos rapidos" pageKey="global">
          <div className="rounded-[30px] border border-[#D8E6EB] bg-white px-6 py-8 shadow-[0_18px_42px_rgba(21,50,59,0.04)] sm:px-8 sm:py-10">
            <div className="max-w-[720px]">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Tópicos rápidos</p>
              <h2 className="mt-2 text-[2rem] font-bold tracking-[-0.04em] text-[#183139] sm:text-[2.2rem]">
                <EditableText
                  entryKey="global.institutional.help.topics.title"
                  fallback="Por onde começar"
                  label="Titulo dos topicos da ajuda"
                  pageKey="global"
                />
              </h2>
              <p className="mt-3 text-base leading-7 text-[#5F7077]">
                <EditableText
                  entryKey="global.institutional.help.topics.description"
                  fallback="Escolha um caminho rápido e encontre a orientação que faz mais sentido para o seu momento."
                  label="Descricao dos topicos da ajuda"
                  pageKey="global"
                />
              </p>
            </div>

            <EditableList
              entryKey="global.institutional.help.topics.items"
              fallback={helpTopicsFallback}
              label="Cards de topicos rapidos"
              pageKey="global"
              schema={{
                kind: 'default',
                itemName: 'card',
                addLabel: 'Adicionar card',
                templates: helpTopicsFallback.map((item) => ({
                  id: item.id,
                  label: item.label,
                  description: item.description,
                  item,
                })),
              }}
            >
              {(items) => (
                <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  {items.filter(isEditableItemVisible).map((item, index) => (
                    <article
                      key={item.id}
                      className={cn(
                        'rounded-[22px] border border-[#D8E6EB] px-5 py-5 shadow-[0_14px_30px_rgba(21,50,59,0.04)]',
                        index % 2 === 0 ? 'bg-[#F8FBFC]' : 'bg-white',
                      )}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                        <CircleHelp className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-[#183139]">{item.title ?? item.label ?? 'Card'}</h3>
                      <p className="mt-3 text-sm leading-7 text-[#5F7077]">{item.description ?? ''}</p>
                    </article>
                  ))}
                </div>
              )}
            </EditableList>
          </div>
        </EditableContainer>
      </div>
    </section>
  )
}

function HelpSupportSection() {
  return (
    <section className="bg-[#F2F7F9] pb-16 pt-0">
      <div className="public-site-container">
        <EditableContainer entryKey="global.institutional.help.support.card" label="Container interno da chamada para suporte" pageKey="global">
          <div className="overflow-hidden rounded-[30px] border border-[#D8E6EB] bg-[linear-gradient(180deg,#0A3640_0%,#102A31_100%)] shadow-[0_20px_46px_rgba(21,50,59,0.08)]">
            <div className="grid gap-0 lg:grid-cols-[10px_minmax(0,1fr)]">
              <div className="bg-[linear-gradient(180deg,#1398B7_0%,#8FD9E8_100%)]" />
              <div className="flex flex-col gap-6 px-6 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl text-white">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                      <MessageCircleMore className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/72">Ainda precisa de ajuda?</p>
                      <h2 className="mt-1 text-[1.9rem] font-bold tracking-[-0.04em] text-white sm:text-[2.1rem]">
                        <EditableText
                          entryKey="global.institutional.help.support.title"
                          fallback="Fale com o suporte ou siga para a central completa"
                          label="Titulo do bloco de suporte"
                          pageKey="global"
                        />
                      </h2>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-white/78">
                    <EditableText
                      entryKey="global.institutional.help.support.description"
                      fallback="Quando a dúvida precisar de atendimento humano, o caminho certo é a página de suporte. Lá você encontra FAQ, ticket e orientações mais detalhadas."
                      label="Descricao do bloco de suporte"
                      pageKey="global"
                    />
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <EditableButton
                    entryKey="global.institutional.help.support.primary_button"
                    fallback={{ label: 'Ir para suporte', href: '/suporte', isInternal: true, tone: 'solid' }}
                    label="Botao principal do bloco de suporte"
                    pageKey="global"
                  >
                    {(buttonValue) => (
                      <GenflixCtaButton asChild className="h-12 px-5">
                        {buttonValue.isInternal === true ? (
                          <Link to={typeof buttonValue.href === 'string' ? buttonValue.href : '/suporte'}>
                            {typeof buttonValue.label === 'string' ? buttonValue.label : 'Ir para suporte'}
                          </Link>
                        ) : (
                          <a
                            href={typeof buttonValue.href === 'string' ? buttonValue.href : '/suporte'}
                            target={buttonValue.openInNewTab === true ? '_blank' : undefined}
                            rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}
                          >
                            {typeof buttonValue.label === 'string' ? buttonValue.label : 'Ir para suporte'}
                          </a>
                        )}
                      </GenflixCtaButton>
                    )}
                  </EditableButton>

                  <GenflixCtaButton asChild tone="surface" className="h-12 px-5 text-[#0A3640]">
                    <Link to="/contato">Falar com a equipe</Link>
                  </GenflixCtaButton>
                </div>
              </div>
            </div>
          </div>
        </EditableContainer>
      </div>
    </section>
  )
}

export function PublicHelpPage() {
  const helpSections = useEditableValue('global.institutional.help.sections', helpLayoutFallback, { pageKey: 'global' })

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="global" placementKey="hero" />

      <SectionStructureControl
        buttonLabel="Gerenciar blocos da pagina"
        pageKey="global"
        entryKey="global.institutional.help.sections"
        label="Estrutura da pagina Ajuda"
        sections={helpSections}
        schema={helpLayoutSchema}
      />

      {renderVisibleSectionList(helpSections.filter(isEditableItemVisible), (item) => {
        const templateKey = resolveSectionRegistryTemplateKey(item)
        const sectionPageKey = resolveSectionRegistryPageKey(item, 'global')
        const sectionEntryPrefix = resolveSectionRegistryEntryPrefix(item, `global.institutional.help.sections.${templateKey}`)

        if (templateKey === 'hero') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco Hero da pagina Ajuda" pageKey={sectionPageKey}>
              <HelpHeroSection />
            </EditableContainer>
          )
        }

        if (templateKey === 'topics') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco Topicos da pagina Ajuda" pageKey={sectionPageKey}>
              <HelpTopicsSection />
            </EditableContainer>
          )
        }

        if (templateKey === 'support') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco Suporte da pagina Ajuda" pageKey={sectionPageKey}>
              <HelpSupportSection />
            </EditableContainer>
          )
        }

        return null
      })}

      <GenflixPublicFooter />
    </main>
  )
}
