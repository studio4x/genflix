import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixNewsletterSection } from '@/components/public/genflix-newsletter-section'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot'
import { genflixNavLinks } from '@/features/public/genflix-site-content'
import {
  createResourcesItemsFallback,
  findResourceFallbackByLabel,
  normalizeResourcesItems,
  resolveResourceVideoUrl,
} from '@/features/public/genflix-resource-items-editor'
import {
  createSectionRegistryFallback,
  createSectionRegistrySchema,
  renderVisibleSectionList,
  resolveSectionRegistryEntryPrefix,
  resolveSectionRegistryPageKey,
  resolveSectionRegistryTemplateKey,
  SectionStructureControl,
} from '@/features/site-editor/section-registry'
import { renderSiteIconVisual } from '@/features/site-editor/site-icons'
import type { EditableListItem } from '@/features/site-editor/types'
import { EditableContainer, EditableList, EditableText, isEditableItemVisible, useEditableValue } from '@/features/site-editor/visual-editor'

type ResourcePopupItem = EditableListItem & {
  label: string
  description: string
  fallbackIcon: LucideIcon
}

type ResourceVideoModalState = {
  url: string
  title: string
}

const resourcesSectionTemplates = [
  {
    id: 'catalog',
    label: 'Catalogo de recursos',
    description: 'Bloco principal com titulo, descricao, cards e CTA.',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Bloco global de captacao compartilhado com outras paginas publicas.',
    pageKey: 'global' as const,
  },
]

const resourcesLayoutFallback = createSectionRegistryFallback(resourcesSectionTemplates)
const resourcesLayoutSchema = createSectionRegistrySchema({
  templates: resourcesSectionTemplates,
  instancePrefix: 'resources.sections',
  instancePageKey: 'resources',
})

function getItemMetadata(item: EditableListItem) {
  if (!item.metadata || typeof item.metadata !== 'object' || Array.isArray(item.metadata)) {
    return {} as Record<string, unknown>
  }
  return item.metadata as Record<string, unknown>
}

function renderResourceIcon(item: ResourcePopupItem, className: string) {
  const metadata = getItemMetadata(item)
  const iconKey = typeof metadata.iconKey === 'string' ? metadata.iconKey : null
  const iconImageUrl = typeof metadata.iconImageUrl === 'string' ? metadata.iconImageUrl : null
  const iconAlt = typeof metadata.iconImageAlt === 'string' ? metadata.iconImageAlt : null
  const iconColor = typeof metadata.iconColor === 'string' ? metadata.iconColor : null

  if (iconKey || iconImageUrl) {
    return renderSiteIconVisual({
      iconKey,
      iconImageUrl,
      iconAlt: iconAlt || item.label || item.title || 'Recurso',
      iconColor,
      className,
    })
  }

  const FallbackIcon = item.fallbackIcon
  return <FallbackIcon className={className} />
}

function sanitizeResourceRichText(rawValue: string) {
  return rawValue
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+="[^"]*"/gi, '')
    .replace(/\son[a-z]+='[^']*'/gi, '')
}

function hasHtmlMarkup(value: string) {
  return /<[^>]+>/.test(value)
}

function renderResourceTextContent(value: string, className: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return null
  }

  if (!hasHtmlMarkup(trimmedValue)) {
    return <p className={className}>{trimmedValue}</p>
  }

  return (
    <div
      className={`rich-text-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeResourceRichText(trimmedValue) }}
    />
  )
}

function isDirectVideoFile(url: string) {
  const normalized = url.toLowerCase()
  return ['.mp4', '.webm', '.ogg', '.m3u8'].some((extension) => normalized.includes(extension))
}

function resolveEmbeddableVideoUrl(url: string) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      if (host.includes('youtu.be')) {
        const id = parsed.pathname.replace('/', '').trim()
        return id ? `https://www.youtube.com/embed/${id}` : url
      }

      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?]+)/)
      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`
      }

      const id = parsed.searchParams.get('v')?.trim()
      if (id) {
        return `https://www.youtube.com/embed/${id}`
      }
    }

    if (host.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).at(-1)
      return id ? `https://player.vimeo.com/video/${id}` : url
    }
  } catch {
    return url
  }

  return url
}

function ResourceVideoModal({
  state,
  onClose,
}: {
  state: ResourceVideoModalState
  onClose: () => void
}) {
  const embedUrl = resolveEmbeddableVideoUrl(state.url)
  const directFile = isDirectVideoFile(state.url)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#061b21]/78 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resource-video-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="relative h-[80vh] w-[70vw] max-w-[1280px] overflow-hidden rounded-[18px] border border-[#0f5b64]/40 bg-[#04171c] shadow-[0_30px_80px_rgba(6,27,33,0.38)]">
        <h2 id="resource-video-modal-title" className="sr-only">{state.title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-sm transition hover:bg-black/62"
          aria-label="Fechar video"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="h-full w-full">
          {directFile ? (
            <video
              controls
              autoPlay
              className="h-full w-full bg-black object-contain"
              src={state.url}
            >
              Seu navegador nao suporta reproducao de video.
            </video>
          ) : (
            <iframe
              title={state.title}
              src={embedUrl}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full border-0 bg-black"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ResourcesCatalogSection({
  resourceItems,
  onOpenVideo,
}: {
  resourceItems: EditableListItem[]
  onOpenVideo: (state: ResourceVideoModalState) => void
}) {
  return (
    <section className="bg-white pb-16 pt-4">
      <div className="public-site-container">
        <div className="mx-auto max-w-[680px] text-center">
          <h1 className="text-[2.35rem] font-extrabold leading-[0.96] tracking-[-0.05em] text-[#183139] sm:text-[2.8rem]">
            <EditableText entryKey="resources.title" fallback="Muito alem do video" label="Titulo de recursos" />
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-base leading-7 text-[#61737a]">
            <EditableText
              entryKey="resources.description"
              fallback="Ferramentas pensadas para voce aprender, fixar e revisar do seu jeito."
              label="Descricao de recursos"
            />
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <EditableList entryKey="resources.items" fallback={resourceItems} label="Cards de recursos">
            {(items) => items.filter(isEditableItemVisible).map((item) => {
              const fallback = findResourceFallbackByLabel(item.label)
              const popupItem: ResourcePopupItem = {
                ...item,
                label: item.label ?? item.title ?? item.id,
                description: item.description ?? '',
                fallbackIcon: fallback.icon,
              }
              const videoUrl = resolveResourceVideoUrl(popupItem)

              return (
                <article
                  key={item.id}
                  className="rounded-[18px] border border-[#D8E6EB] bg-[#F2F7F9] px-5 py-5 text-left shadow-[0_16px_36px_rgba(21,50,59,0.04)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(19,152,183,0.12)]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                      {renderResourceIcon(popupItem, 'h-4.5 w-4.5')}
                    </div>
                  </div>

                  <h2 className="mt-5 text-[1rem] font-bold leading-6 text-[#183139]">{item.label}</h2>
                  <div className="mt-3 text-sm leading-7 text-[#667980] [&_p]:m-0">
                    {renderResourceTextContent(item.description ?? '', '')}
                  </div>
                  {videoUrl ? (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenVideo({
                            url: videoUrl,
                            title: popupItem.label || 'Video de instrucao',
                          })
                        }}
                        className="inline-flex items-center rounded-full border border-[#1398B7]/30 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#0F7E99] hover:bg-[#E8F6FA]"
                      >
                        Ver video de instrucao
                      </button>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </EditableList>
        </div>

        <div className="mt-12 flex justify-center">
          <GenflixCtaButton asChild className="px-5 py-3">
            <Link to="/login">
              <EditableText entryKey="resources.cta" fallback="Entrar para explorar tudo" label="CTA de recursos" />
            </Link>
          </GenflixCtaButton>
        </div>
      </div>
    </section>
  )
}

export function PublicResourcesPage() {
  const { isLoading, user, roles } = useAuth()
  const [activeVideo, setActiveVideo] = useState<ResourceVideoModalState | null>(null)
  const waitingRoleResolution = !!user && roles.length === 0
  const resourcesSections = useEditableValue('resources.layout.sections', resourcesLayoutFallback)
  const resourceItemsRaw = useEditableValue(
    'resources.items',
    createResourcesItemsFallback(),
  )
  const resourceItems = useMemo(
    () => normalizeResourcesItems(resourceItemsRaw),
    [resourceItemsRaw],
  )

  useEffect(() => {
    if (!activeVideo) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveVideo(null)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeVideo])

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader currentPage="resources" navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="resources" placementKey="hero" />
      <SectionStructureControl
        buttonLabel="Gerenciar blocos da pagina"
        pageKey="resources"
        entryKey="resources.layout.sections"
        label="Estrutura da pagina Recursos"
        sections={resourcesSections}
        schema={resourcesLayoutSchema}
      />
      {renderVisibleSectionList(resourcesSections.filter(isEditableItemVisible), (item) => {
        const templateKey = resolveSectionRegistryTemplateKey(item)
        const sectionPageKey = resolveSectionRegistryPageKey(item, 'resources')
        const sectionEntryPrefix = resolveSectionRegistryEntryPrefix(item, `resources.sections.${templateKey}`)

        if (templateKey === 'catalog') {
          return (
            <EditableContainer entryKey={`${sectionEntryPrefix}.layout`} label="Bloco Catalogo da pagina Recursos" pageKey={sectionPageKey}>
              <ResourcesCatalogSection resourceItems={resourceItems} onOpenVideo={setActiveVideo} />
            </EditableContainer>
          )
        }

        if (templateKey === 'newsletter') {
          return <GenflixNewsletterSection />
        }

        return null
      })}
      <GenflixPublicFooter />
      {activeVideo ? (
        <ResourceVideoModal state={activeVideo} onClose={() => setActiveVideo(null)} />
      ) : null}
    </main>
  )
}
