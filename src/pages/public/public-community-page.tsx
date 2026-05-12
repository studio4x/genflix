import { CirclePlay } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixNewsletterSection } from '@/components/public/genflix-newsletter-section'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot'
import {
  genflixCommunityItems,
  genflixNavLinks,
} from '@/features/public/genflix-site-content'
import {
  createSectionRegistryFallback,
  createSectionRegistrySchema,
  renderVisibleSectionList,
  resolveSectionRegistryEntryPrefix,
  resolveSectionRegistryPageKey,
  resolveSectionRegistryTemplateKey,
  SectionStructureControl,
} from '@/features/site-editor/section-registry'
import { EditableContainer, EditableList, EditableText, isEditableItemVisible, useEditableValue } from '@/features/site-editor/visual-editor'
import type { EditableListItem } from '@/features/site-editor/types'

const communitySectionTemplates = [
  {
    id: 'hero',
    label: 'Hero da comunidade',
    description: 'Abertura com titulo, descricao e grade de comunidades.',
  },
  {
    id: 'support',
    label: 'Bloco de apoio',
    description: 'Area com video institucional, textos de apoio e CTA.',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Bloco global de captacao compartilhado com outras paginas publicas.',
    pageKey: 'global' as const,
  },
]

const communityLayoutFallback = createSectionRegistryFallback(communitySectionTemplates)
const communityLayoutSchema = createSectionRegistrySchema({
  templates: communitySectionTemplates,
  instancePrefix: 'community.sections',
  instancePageKey: 'community',
})

function CommunityHeroSection({ communityItems }: { communityItems: EditableListItem[] }) {
  return (
    <section className="bg-white pb-14 pt-4">
      <div className="public-site-container">
        <div className="mx-auto max-w-[760px] text-center">
          <h1 className="text-[2.35rem] font-extrabold leading-[0.96] tracking-[-0.05em] text-[#183139] sm:text-[2.8rem]">
            <EditableText
              entryKey="community.hero.title"
              fallback="Tire duvidas, troque experiencias e aprofunde o que aprendeu."
              label="Titulo da comunidade"
            />
          </h1>
          <p className="mx-auto mt-4 max-w-[720px] text-base leading-7 text-[#61737a]">
            <EditableText
              entryKey="community.hero.description"
              fallback="Escolha sua comunidade, entre na conversa e leve o aprendizado alem da tela. Aqui as duvidas viram debate e o debate vira conhecimento."
              label="Descricao da comunidade"
            />
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <EditableList entryKey="community.items" fallback={communityItems} label="Comunidades">
            {(items) => items.filter(isEditableItemVisible).map((item) => {
              const fallback = genflixCommunityItems.find((community) => community.label === item.label) ?? genflixCommunityItems[0]
              const Icon = fallback.icon

              return (
                <article
                  key={item.id}
                  className="group rounded-[14px] bg-[linear-gradient(180deg,#1398B7_0%,#0A3640_100%)] px-4 py-4 text-white shadow-[0_10px_20px_rgba(10,54,64,0.18)] transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/24 bg-white/10">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="mt-5 text-sm font-semibold leading-5">{item.label}</h2>
                </article>
              )
            })}
          </EditableList>
        </div>
      </div>
    </section>
  )
}

function CommunitySupportSection() {
  return (
    <section className="bg-white pb-16">
      <div className="public-site-container">
        <div className="grid gap-8 overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-[0_20px_46px_rgba(21,50,59,0.05)] lg:grid-cols-[1fr_0.9fr] lg:p-8">
          <div className="relative overflow-hidden rounded-[22px] bg-[#173039]">
            <img
              src="/images/genflix/home/featured-6.jpg"
              alt="Comunidade GenFlix"
              className="h-full w-full object-cover grayscale"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,31,36,0.18)_0%,rgba(11,31,36,0.5)_100%)]" />
            <button
              type="button"
              aria-label="Assistir video institucional"
              className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/36 bg-white/12 text-white backdrop-blur-sm transition-transform hover:scale-105"
            >
              <CirclePlay className="h-8 w-8 fill-current" />
            </button>
          </div>

          <div className="flex items-center">
            <div className="max-w-[460px]">
              <h2 className="text-[1.9rem] font-bold tracking-[-0.04em] text-[#183139] sm:text-[2.1rem]">
                <EditableText entryKey="community.support.title" fallback="Texto de apoio" label="Titulo do texto de apoio" />
              </h2>
              <p className="mt-4 text-[15px] leading-8 text-[#5f7178]">
                <EditableText
                  entryKey="community.support.paragraph1"
                  fallback="Oferecer a profissionais e estudantes universitarios conteudos modernos, objetivos e praticos, a precos justos, para que a compreensao aconteca de verdade. Nas comunidades da GenFlix, esse conhecimento ganha continuidade em conversas, trocas e repertorio compartilhado."
                  label="Texto de apoio 1"
                />
              </p>
              <p className="mt-4 text-[15px] leading-8 text-[#5f7178]">
                <EditableText
                  entryKey="community.support.paragraph2"
                  fallback="O espaco foi pensado para aproximar quem aprende, estimular o debate e transformar duvidas em avanco concreto. Cada area reune temas, experiencias e perspectivas que ajudam a estender o estudo para alem da aula."
                  label="Texto de apoio 2"
                />
              </p>

              <div className="mt-8">
                <GenflixCtaButton asChild className="px-5 py-3">
                  <Link to="/login">
                    <EditableText entryKey="community.support.cta" fallback="Entrar para participar" label="CTA da comunidade" />
                  </Link>
                </GenflixCtaButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function PublicCommunityPage() {
  const { isLoading, user, roles } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const communitySections = useEditableValue('community.layout.sections', communityLayoutFallback)
  const communityItems = useEditableValue(
    'community.items',
    genflixCommunityItems.map((item) => ({
      id: item.label,
      label: item.label,
      description: item.description,
    })),
  )

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  return (
    <EditableContainer entryKey="community.page.layout" label="Layout geral da página Comunidade" pageKey="community" className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader currentPage="community" navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="community" placementKey="hero" />
      <SectionStructureControl
        buttonLabel="Gerenciar blocos da pagina"
        pageKey="community"
        entryKey="community.layout.sections"
        label="Estrutura da pagina Comunidade"
        sections={communitySections}
        schema={communityLayoutSchema}
      />
      {renderVisibleSectionList(communitySections.filter(isEditableItemVisible), (item) => {
        const templateKey = resolveSectionRegistryTemplateKey(item)
        const sectionPageKey = resolveSectionRegistryPageKey(item, 'community')
        const sectionEntryPrefix = resolveSectionRegistryEntryPrefix(item, `community.sections.${templateKey}`)

        if (templateKey === 'hero') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco Hero da página Comunidade" pageKey={sectionPageKey}>
              <CommunityHeroSection communityItems={communityItems} />
            </EditableContainer>
          )
        }

        if (templateKey === 'support') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco Apoio da página Comunidade" pageKey={sectionPageKey}>
              <CommunitySupportSection />
            </EditableContainer>
          )
        }

        if (templateKey === 'newsletter') {
          return <GenflixNewsletterSection />
        }

        return null
      })}
      <GenflixPublicFooter />
    </EditableContainer>
  )
}
