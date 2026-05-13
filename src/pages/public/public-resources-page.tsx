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
  resolveResourceVideoUrl,
} from '@/features/public/genflix-resource-items-editor'
import { renderSiteIconVisual } from '@/features/site-editor/site-icons'
import type { EditableListItem } from '@/features/site-editor/types'
import { EditableButton, EditableList, EditableText, isEditableItemVisible, useEditableValue } from '@/features/site-editor/visual-editor'

type ResourcePopupItem = EditableListItem & {
  label: string
  description: string
  fallbackIcon: LucideIcon
}

type ResourceVideoModalState = {
  url: string
  title: string
}

type ResourceReadMoreModalState = {
  title: string
  content: string
}

type ResourceCardStyleSettings = {
  cardBackgroundColor: string
  cardBorderColor: string
  cardBorderWidth: number
  cardBorderRadius: number
  cardShadow: string
  titleColor: string
  titleFontSize: number
  titleFontWeight: number
  descriptionColor: string
  descriptionFontSize: number
  descriptionLineHeight: number
  iconBackgroundColor: string
  iconColor: string
  buttonBackgroundColor: string
  buttonTextColor: string
  buttonBorderColor: string
  buttonRadius: number
}

const defaultCardStyle: ResourceCardStyleSettings = {
  cardBackgroundColor: '#F2F7F9',
  cardBorderColor: '#D8E6EB',
  cardBorderWidth: 1,
  cardBorderRadius: 18,
  cardShadow: '0 16px 36px rgba(21,50,59,0.04)',
  titleColor: '#183139',
  titleFontSize: 16,
  titleFontWeight: 700,
  descriptionColor: '#667980',
  descriptionFontSize: 14,
  descriptionLineHeight: 1.75,
  iconBackgroundColor: '#E8F6FA',
  iconColor: '#1398B7',
  buttonBackgroundColor: '#FFFFFF',
  buttonTextColor: '#0F7E99',
  buttonBorderColor: '#1398B7',
  buttonRadius: 999,
}

function getItemMetadata(item: EditableListItem) {
  if (!item.metadata || typeof item.metadata !== 'object' || Array.isArray(item.metadata)) {
    return {} as Record<string, unknown>
  }
  return item.metadata as Record<string, unknown>
}

function renderResourceIcon(item: ResourcePopupItem, className: string, forcedColor?: string | null) {
  const metadata = getItemMetadata(item)
  const iconKey = typeof metadata.iconKey === 'string' ? metadata.iconKey : null
  const iconImageUrl = typeof metadata.iconImageUrl === 'string' ? metadata.iconImageUrl : null
  const iconAlt = typeof metadata.iconImageAlt === 'string' ? metadata.iconImageAlt : null
  const metadataIconColor = typeof metadata.iconColor === 'string' ? metadata.iconColor : null
  const iconColor = typeof forcedColor === 'string' && forcedColor.trim() !== '' ? forcedColor : metadataIconColor

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

function resolveReadMoreContent(item: EditableListItem | null | undefined) {
  if (!item) return ''
  const metadata = getItemMetadata(item)
  if (metadata.readMoreEnabled !== true) return ''
  return typeof metadata.readMoreContent === 'string' ? metadata.readMoreContent.trim() : ''
}

function parseCardStyle(rawValue: unknown): ResourceCardStyleSettings {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return { ...defaultCardStyle }
  }
  const value = rawValue as Record<string, unknown>
  const fromNumber = (field: keyof ResourceCardStyleSettings, fallback: number) => {
    const current = value[field]
    return typeof current === 'number' && Number.isFinite(current) ? current : fallback
  }
  const fromString = (field: keyof ResourceCardStyleSettings, fallback: string) => {
    const current = value[field]
    return typeof current === 'string' && current.trim() !== '' ? current.trim() : fallback
  }
  return {
    cardBackgroundColor: fromString('cardBackgroundColor', defaultCardStyle.cardBackgroundColor),
    cardBorderColor: fromString('cardBorderColor', defaultCardStyle.cardBorderColor),
    cardBorderWidth: fromNumber('cardBorderWidth', defaultCardStyle.cardBorderWidth),
    cardBorderRadius: fromNumber('cardBorderRadius', defaultCardStyle.cardBorderRadius),
    cardShadow: fromString('cardShadow', defaultCardStyle.cardShadow),
    titleColor: fromString('titleColor', defaultCardStyle.titleColor),
    titleFontSize: fromNumber('titleFontSize', defaultCardStyle.titleFontSize),
    titleFontWeight: fromNumber('titleFontWeight', defaultCardStyle.titleFontWeight),
    descriptionColor: fromString('descriptionColor', defaultCardStyle.descriptionColor),
    descriptionFontSize: fromNumber('descriptionFontSize', defaultCardStyle.descriptionFontSize),
    descriptionLineHeight: fromNumber('descriptionLineHeight', defaultCardStyle.descriptionLineHeight),
    iconBackgroundColor: fromString('iconBackgroundColor', defaultCardStyle.iconBackgroundColor),
    iconColor: fromString('iconColor', defaultCardStyle.iconColor),
    buttonBackgroundColor: fromString('buttonBackgroundColor', defaultCardStyle.buttonBackgroundColor),
    buttonTextColor: fromString('buttonTextColor', defaultCardStyle.buttonTextColor),
    buttonBorderColor: fromString('buttonBorderColor', defaultCardStyle.buttonBorderColor),
    buttonRadius: fromNumber('buttonRadius', defaultCardStyle.buttonRadius),
  }
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

function ResourceReadMoreModal({
  state,
  onClose,
}: {
  state: ResourceReadMoreModalState
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#061b21]/78 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resource-read-more-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="relative max-h-[80vh] w-full max-w-[760px] overflow-y-auto rounded-[18px] border border-[#D8E6EB] bg-white p-6 shadow-[0_30px_80px_rgba(6,27,33,0.38)]">
        <h2 id="resource-read-more-modal-title" className="pr-10 text-xl font-extrabold text-[#183139]">
          {state.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E6EB] bg-white text-[#15323b] shadow-sm transition hover:bg-[#F2F7F9]"
          aria-label="Fechar leia mais"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mt-4 text-sm leading-7 text-[#425f68] [&_p]:mb-3 [&_p:last-child]:mb-0">
          {renderResourceTextContent(state.content, '')}
        </div>
      </div>
    </div>
  )
}

function ResourcesCatalogSection({
  cardStyle,
  onOpenVideo,
  onOpenReadMore,
}: {
  cardStyle: ResourceCardStyleSettings
  onOpenVideo: (state: ResourceVideoModalState) => void
  onOpenReadMore: (state: ResourceReadMoreModalState) => void
}) {
  return (
    <section className="bg-white pb-16 pt-4">
      <div className="public-site-container">
        <div className="mx-auto max-w-[680px] text-center">
          <h1 className="text-[2.35rem] font-extrabold leading-[0.96] tracking-[-0.05em] text-[#183139] sm:text-[2.8rem]">
            <EditableText
              entryKey="resources.title"
              fallback="Muito alem do video"
              label="Titulo da secao de recursos"
            />
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-base leading-7 text-[#61737a]">
            <EditableText
              entryKey="resources.description"
              fallback="Ferramentas pensadas para voce aprender, fixar e revisar do seu jeito."
              label="Descricao da secao de recursos"
            />
          </p>
        </div>

        <EditableList
          entryKey="resources.items"
          fallback={createResourcesItemsFallback()}
          label="Cards de recursos"
        >
          {(resourceItems) => (
            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {resourceItems.filter(isEditableItemVisible).map((item) => {
                const fallback = findResourceFallbackByLabel(item.label)
                const popupItem: ResourcePopupItem = {
                  ...item,
                  label: item.label ?? item.title ?? item.id,
                  description: item.description ?? '',
                  fallbackIcon: fallback.icon,
                }
                const videoUrl = resolveResourceVideoUrl(popupItem)
                const readMoreContent = resolveReadMoreContent(popupItem)

                const metadata = getItemMetadata(popupItem)
                const itemColor = typeof metadata.itemColor === 'string' ? metadata.itemColor : cardStyle.iconColor

                return (
                  <article
                    key={item.id}
                    className="rounded-[18px] border border-[#D8E6EB] bg-[#F2F7F9] px-5 py-5 text-left shadow-[0_16px_36px_rgba(21,50,59,0.04)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(19,152,183,0.12)]"
                    style={{
                      borderColor: cardStyle.cardBorderColor,
                      borderWidth: `${cardStyle.cardBorderWidth}px`,
                      borderRadius: `${cardStyle.cardBorderRadius}px`,
                      backgroundColor: cardStyle.cardBackgroundColor,
                      boxShadow: cardStyle.cardShadow,
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-2xl"
                        style={{
                          backgroundColor: cardStyle.iconBackgroundColor,
                          color: itemColor || cardStyle.iconColor,
                        }}
                      >
                        {renderResourceIcon(popupItem, 'h-4.5 w-4.5', itemColor)}
                      </div>
                    </div>

                    <h2
                      className="mt-5 leading-6"
                      style={{
                        color: cardStyle.titleColor,
                        fontSize: `${cardStyle.titleFontSize}px`,
                        fontWeight: cardStyle.titleFontWeight,
                      }}
                    >
                      {item.label}
                    </h2>
                    <div
                      className="mt-3 [&_p]:m-0"
                      style={{
                        color: cardStyle.descriptionColor,
                        fontSize: `${cardStyle.descriptionFontSize}px`,
                        lineHeight: String(cardStyle.descriptionLineHeight),
                      }}
                    >
                      {renderResourceTextContent(item.description ?? '', '')}
                    </div>
                    {videoUrl || readMoreContent ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {videoUrl ? (
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
                            style={{
                              backgroundColor: cardStyle.buttonBackgroundColor,
                              color: cardStyle.buttonTextColor,
                              borderColor: cardStyle.buttonBorderColor,
                              borderRadius: `${cardStyle.buttonRadius}px`,
                            }}
                          >
                            Ver video de instrucao
                          </button>
                        ) : null}
                        {readMoreContent ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onOpenReadMore({
                                title: popupItem.label || 'Leia mais',
                                content: readMoreContent,
                              })
                            }}
                            className="inline-flex items-center rounded-full border border-[#15323B]/20 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#15323B] hover:bg-[#EAF2F5]"
                            style={{
                              backgroundColor: cardStyle.buttonBackgroundColor,
                              color: cardStyle.buttonTextColor,
                              borderColor: cardStyle.buttonBorderColor,
                              borderRadius: `${cardStyle.buttonRadius}px`,
                            }}
                          >
                            Leia mais
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </EditableList>
 
        <div className="mt-12 flex justify-center">
          <EditableButton
            entryKey="resources.cta"
            fallback={{
              label: 'Entrar para explorar tudo',
              href: '/login',
              isInternal: true,
              tone: 'solid',
            }}
            label="Botao principal da secao de recursos"
          >
            {(buttonValue) => buttonValue.isHidden === true ? null : (
              <GenflixCtaButton asChild className="px-5 py-3">
                {buttonValue.isInternal === true ? (
                  <Link to={typeof buttonValue.href === 'string' ? buttonValue.href : '/login'}>
                    {typeof buttonValue.label === 'string' ? buttonValue.label : 'Entrar para explorar tudo'}
                  </Link>
                ) : (
                  <a
                    href={typeof buttonValue.href === 'string' ? buttonValue.href : '/login'}
                    target={buttonValue.openInNewTab === true ? '_blank' : undefined}
                    rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}
                  >
                    {typeof buttonValue.label === 'string' ? buttonValue.label : 'Entrar para explorar tudo'}
                  </a>
                )}
              </GenflixCtaButton>
            )}
          </EditableButton>
        </div>
      </div>
    </section>
  )
}
 
export function PublicResourcesPage() {
  const { isLoading, user, roles } = useAuth()
  const [activeVideo, setActiveVideo] = useState<ResourceVideoModalState | null>(null)
  const [activeReadMore, setActiveReadMore] = useState<ResourceReadMoreModalState | null>(null)
  const waitingRoleResolution = !!user && roles.length === 0
  const rawCardStyle = useEditableValue('resources.cardStyle', defaultCardStyle)
  const cardStyle = useMemo(() => parseCardStyle(rawCardStyle), [rawCardStyle])
 
  useEffect(() => {
    if (!activeVideo && !activeReadMore) {
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
  }, [activeVideo, activeReadMore])
 
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
      <ResourcesCatalogSection
        cardStyle={cardStyle}
        onOpenVideo={setActiveVideo}
        onOpenReadMore={setActiveReadMore}
      />
      <GenflixNewsletterSection />
      <GenflixPublicFooter />
      {activeVideo ? (
        <ResourceVideoModal state={activeVideo} onClose={() => setActiveVideo(null)} />
      ) : null}
      {activeReadMore ? (
        <ResourceReadMoreModal state={activeReadMore} onClose={() => setActiveReadMore(null)} />
      ) : null}
    </main>
  )
}
