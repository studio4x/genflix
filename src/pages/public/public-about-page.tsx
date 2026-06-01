import { useAuth } from '@/app/providers/auth-provider'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { GenflixNewsletterSection } from '@/components/public/genflix-newsletter-section'
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
import { EditableContainer, EditableRichText, EditableText, isEditableItemVisible, useEditableValue } from '@/features/site-editor/visual-editor'
import type { EditableListItem } from '@/features/site-editor/types'

const aboutParagraphs = [
  'Ha quem prefira abrir o livro, sublinhar, fazer anotacoes e avancar p?gina por p?gina. Ha tambem quem se envolva mais com videos, aulas curtas e recursos interativos.',
  'A plataforma GenFlix nasce para unir esses dois mundos e ir alem.',
  'GenFlix e uma plataforma que reune cursos, aulas e conte?dos digitais criados por especialistas e professores, com a curadoria e a qualidade editorial do GEN Grupo Editorial Nacional, maior conglomerado editorial de publicacoes academicas e que reune editoras como Guanabara Koogan, LTC, Forense e Saraiva, referencias na formacao de professores e profissionais.',
  'Agora, esse conhecimento ganha uma experi?ncia digital completa.',
  'A GenFlix e fruto de uma parceria entre o GEN e a e-Clix Solucoes em Conte?do Educacional, comandada por uma equipe com mais de 50 anos de atuacao no desenvolvimento de conte?dos educacionais e projetos de aprendizagem para organizacoes no Brasil e no exterior.',
  'O resultado e uma plataforma construida sobre tres pilares essenciais: conte?do confiavel e atual, experi?ncia digital moderna e intuitiva e aplicacao pratica do conhecimento.',
  'Na GenFlix, aprender vai muito alem de assistir a videos. A plataforma integra uma ampla variedade de recursos didaticos contemporaneos, pensados para facilitar a compreensao, manter o ritmo de estudo, reduzir a evasao e transformar conte?do em conhecimento util no dia a dia academico e profissional.',
  'Tudo isso com um proposito central que consideramos ser a nossa missao.',
]

const aboutSectionTemplates = [
  {
    id: 'hero',
    label: 'Hero institucional',
    description: 'Bloco de abertura com titulo e subtitulo da p?gina Sobre.',
  },
  {
    id: 'story',
    label: 'Historia e proposta',
    description: 'Bloco editorial principal com os paragrafos da marca.',
  },
  {
    id: 'mission',
    label: 'Missao',
    description: 'Bloco com logo, proposito e frase de apoio.',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Bloco global de captacao compartilhado com outras p?ginas publicas.',
    pageKey: 'global' as const,
  },
]

const aboutLayoutFallback = createSectionRegistryFallback(aboutSectionTemplates)
const aboutLayoutSchema = createSectionRegistrySchema({
  templates: aboutSectionTemplates,
  instancePrefix: 'about.sections',
  instancePageKey: 'about',
})

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paragraphsToHtml(paragraphs: string[]) {
  return paragraphs
    .filter((paragraph) => typeof paragraph === 'string' && paragraph.trim() !== '')
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('')
}

function legacyParagraphsToRichText(items: EditableListItem[]) {
  return items
    .map((item) => (typeof item.description === 'string' ? item.description.trim() : ''))
    .filter((chunk) => chunk !== '')
    .join('')
}

function AboutHeroSection() {
  return (
    <section className="bg-white pb-10 pt-8">
      <div className="public-site-container">
        <EditableContainer entryKey="about.hero.card" label="Container interno do Hero" pageKey="about">
          <div className="rounded-[30px] bg-[#F2F7F9] px-8 py-14 text-center shadow-[0_20px_44px_rgba(21,50,59,0.04)] sm:px-12">
            <h1 className="text-[2.65rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
              <EditableText entryKey="about.hero.title" fallback="GenFlix" label="Titulo da p?gina Sobre" />
            </h1>
            <p className="mt-4 text-base font-medium text-[#1398B7]">
              <EditableText
                entryKey="about.hero.subtitle"
                fallback="Porque aprender e ensinar n?o precisa ser complicado."
                label="Subtitulo da p?gina Sobre"
              />
            </p>
          </div>
        </EditableContainer>
      </div>
    </section>
  )
}

function AboutStorySection({ richTextFallback }: { richTextFallback: string }) {
  return (
    <section className="bg-white pb-16 pt-4">
      <div className="public-site-container">
        <EditableContainer entryKey="about.story.card" label="Container interno da Historia" pageKey="about">
          <div className="rounded-[28px] border border-[#D8E6EB] bg-white px-8 py-10 shadow-[0_18px_42px_rgba(21,50,59,0.03)] sm:px-10 lg:px-12">
            <EditableContainer entryKey="about.story.contentWrap" label="Container de conte?do da Historia" pageKey="about">
              <div className="mx-auto max-w-[960px] border-t border-[#BEE3EA] pt-10">
                <EditableRichText
                  entryKey="about.storyContent"
                  fallback={richTextFallback}
                  label="Conte?do da p?gina Sobre"
                  pageKey="about"
                  className="rich-text-content space-y-5 text-[15px] leading-8 text-[#4f666d]"
                />
              </div>
            </EditableContainer>
          </div>
        </EditableContainer>
      </div>
    </section>
  )
}

function AboutMissionSection() {
  return (
    <section className="bg-white pb-20">
      <div className="public-site-container">
        <EditableContainer entryKey="about.mission.card" label="Container interno da Missao" pageKey="about">
          <div className="grid gap-8 overflow-hidden rounded-[30px] bg-[#F2F7F9] px-8 py-8 shadow-[0_22px_46px_rgba(21,50,59,0.05)] lg:grid-cols-[360px_minmax(0,1fr)] lg:items-center lg:px-10 lg:py-10">
          <div className="flex min-h-[240px] items-center justify-center rounded-[24px] bg-white shadow-[0_18px_40px_rgba(21,50,59,0.06)]">
            <div className="scale-[2.3]">
              <GenflixLogo />
            </div>
          </div>

          <div className="max-w-[520px]">
            <h2 className="text-[2rem] font-bold tracking-[-0.04em] text-[#183139] sm:text-[2.2rem]">
              <EditableText entryKey="about.mission.title" fallback="Nossa missao" label="Titulo da missao" />
            </h2>
            <p className="mt-4 text-[15px] leading-8 text-[#5f7178]">
              <EditableText
                entryKey="about.mission.description"
                fallback="Oferecer a estudantes universitarios, concurseiros e profissionais conte?dos modernos, objetivos, praticos, de qualidade e a precos adequados, com materiais que proporcionem compreensao rapida e efetiva daquilo que os usuarios desejam aprender."
                label="Descricao da missao"
              />
            </p>
            <p className="mt-5 text-sm font-semibold text-[#1398B7]">
              <EditableText
                entryKey="about.mission.tagline"
                fallback="Porque aprender e ensinar n?o precisa ser complicado."
                label="Frase final da missao"
              />
            </p>
            <div className="mt-7 h-px w-full max-w-[260px] bg-[#8FCAD8]" />
          </div>
        </div>
        </EditableContainer>
      </div>
    </section>
  )
}

export function PublicAboutPage() {
  const { isLoading, user, roles } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const aboutSections = useEditableValue('about.layout.sections', aboutLayoutFallback)
  const legacyParagraphs = useEditableValue(
    'about.paragraphs',
    aboutParagraphs.map((paragraph, index) => ({
      id: `paragraph-${index + 1}`,
      description: paragraph,
    })),
  )

  const storyRichTextFallback = Array.isArray(legacyParagraphs)
    ? legacyParagraphsToRichText(legacyParagraphs)
    : paragraphsToHtml(aboutParagraphs)

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader currentPage="about" navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="about" placementKey="hero" />
      <SectionStructureControl
        buttonLabel="Gerenciar blocos da p?gina"
        pageKey="about"
        entryKey="about.layout.sections"
        label="Estrutura da p?gina Sobre"
        sections={aboutSections}
        schema={aboutLayoutSchema}
      />
      {renderVisibleSectionList(aboutSections.filter(isEditableItemVisible), (item) => {
        const templateKey = resolveSectionRegistryTemplateKey(item)
        const sectionPageKey = resolveSectionRegistryPageKey(item, 'about')
        const sectionEntryPrefix = resolveSectionRegistryEntryPrefix(item, `about.sections.${templateKey}`)

        if (templateKey === 'hero') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco Hero da página Sobre" pageKey={sectionPageKey}>
              <AboutHeroSection />
            </EditableContainer>
          )
        }

        if (templateKey === 'story') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco História da página Sobre" pageKey={sectionPageKey}>
              <AboutStorySection richTextFallback={storyRichTextFallback} />
            </EditableContainer>
          )
        }

        if (templateKey === 'mission') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco Missão da página Sobre" pageKey={sectionPageKey}>
              <AboutMissionSection />
            </EditableContainer>
          )
        }

        if (templateKey === 'newsletter') {
          return <GenflixNewsletterSection />
        }

        return null
      })}
      <GenflixPublicFooter />
    </main>
  )
}

