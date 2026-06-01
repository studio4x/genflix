import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import { GenflixCtaButton, normalizeGenflixCtaTone } from '@/components/public/genflix-cta-button'
import { genflixCategoryTiles } from '@/features/public/genflix-site-content'
import { genflixNewsletterImage } from '@/features/public/genflix-public-media'
import { EditableButton, EditableImage, EditableText, getEditableImagePresentation, useEditableValue } from '@/features/site-editor/visual-editor'
import type { SitePageKey } from '@/features/site-editor/types'

type GenflixNewsletterSectionVariant = 'form' | 'cta'

const newsletterInterestAreas = genflixCategoryTiles.map((category) => category.label)
const hiddenNewsletterAreas = new Set(['Psicanálise / Psicologia', 'Interesse Geral'])
const newsletterSelectableAreas = newsletterInterestAreas.filter((area) => !hiddenNewsletterAreas.has(area))

export function GenflixNewsletterSection({
  id = 'newsletter',
  entryPrefix = 'global.newsletter',
  pageKey = 'global',
  variant = 'form',
  ctaHref = '/cursos',
}: {
  id?: string
  entryPrefix?: string
  pageKey?: SitePageKey
  variant?: GenflixNewsletterSectionVariant
  ctaHref?: string
}) {
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [selectedInterestAreas, setSelectedInterestAreas] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const image = useEditableValue(`${entryPrefix}.image`, { src: genflixNewsletterImage, alt: 'Newsletter GenFlix' }, { pageKey })
  const placeholder = useEditableValue(`${entryPrefix}.placeholder`, 'Seu@e-mail.com', { pageKey })
  const legacyButtonLabel = useEditableValue(
    `${entryPrefix}.button.label`,
    variant === 'cta' ? 'Ver cursos' : 'Quero me inscrever',
    { pageKey },
  )

  function toggleInterestArea(area: string) {
    setSelectedInterestAreas((currentAreas) =>
      currentAreas.includes(area)
        ? currentAreas.filter((currentArea) => currentArea !== area)
        : [...currentAreas, area],
    )
  }

  function setAllInterestAreas(selected: boolean) {
    setSelectedInterestAreas(selected ? [...newsletterSelectableAreas] : [])
  }

  const areAllInterestAreasSelected =
    newsletterSelectableAreas.length > 0 &&
    newsletterSelectableAreas.every((area) => selectedInterestAreas.includes(area))

  async function handleNewsletterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/public/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_type: 'newsletter',
          email: newsletterEmail.trim(),
          interest_areas: selectedInterestAreas,
          source_path: window.location.pathname,
          source_url: window.location.href,
        }),
      })

      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error ?? 'N?o foi possivel cadastrar seu e-mail.')
      }

      setNewsletterEmail('')
      setSelectedInterestAreas([])
      setMessage('Cadastro recebido. Obrigado por se inscrever!')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'N?o foi possivel cadastrar seu e-mail.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id={id} className="relative overflow-hidden bg-[#10242B]">
      <EditableImage entryKey={`${entryPrefix}.image`} fallback={image} label="Imagem da newsletter" pageKey={pageKey}>
        {(editableImage) => (
          <div
            className="relative"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(7, 20, 26, 0.7) 0%, rgba(7, 20, 26, 0.76) 100%), url(${typeof editableImage.src === 'string' ? editableImage.src : genflixNewsletterImage})`,
              backgroundPosition: getEditableImagePresentation(editableImage).backgroundPosition,
              backgroundSize: getEditableImagePresentation(editableImage).fit === 'contain' ? 'contain' : 'cover',
            }}
          >
            <div className="public-site-container py-20 sm:py-24">
              <div className="mx-auto flex max-w-[760px] flex-col items-center text-center">
                <h2 className="mx-auto w-full max-w-[760px] text-center text-[2.2rem] font-bold leading-[1.02] tracking-[-0.05em] text-white sm:text-[2.8rem]">
                  <EditableText
                    entryKey={`${entryPrefix}.title`}
                    fallback={variant === 'cta' ? 'Veja em detalhes a mais completa plataforma EAD.' : 'Assine nossa newsletter'}
                    label="Título da newsletter"
                    pageKey={pageKey}
                  />
                </h2>
                <p className="mt-4 max-w-[620px] text-sm leading-7 text-white/74 sm:text-base">
                  <EditableText
                    entryKey={`${entryPrefix}.description`}
                    fallback={
                      variant === 'cta'
                        ? 'Conheça cursos, trilhas e recursos para estudar no seu ritmo.'
                        : 'Cadastre-se para receber atualizações sobre nossos cursos e conteúdo.'
                    }
                    label="Descrição da newsletter"
                    pageKey={pageKey}
                  />
                </p>

                {variant === 'cta' ? (
                  <EditableButton
                    entryKey={`${entryPrefix}.button`}
                    fallback={{ label: legacyButtonLabel, href: ctaHref, isInternal: true, tone: 'solid' }}
                    label="Botão da newsletter"
                    pageKey={pageKey}
                  >
                    {(buttonValue) => buttonValue.isHidden === true ? null : (
                      <GenflixCtaButton
                        asChild
                        className="mt-8 min-h-[50px] justify-between px-5 md:min-w-[220px]"
                        tone={normalizeGenflixCtaTone(buttonValue.tone)}
                      >
                        {buttonValue.isInternal === true ? (
                          <Link to={typeof buttonValue.href === 'string' ? buttonValue.href : ctaHref}>
                            {typeof buttonValue.label === 'string' ? buttonValue.label : 'Ver cursos'}
                          </Link>
                        ) : (
                          <a
                            href={typeof buttonValue.href === 'string' ? buttonValue.href : ctaHref}
                            target={buttonValue.openInNewTab === true ? '_blank' : undefined}
                            rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}
                          >
                            {typeof buttonValue.label === 'string' ? buttonValue.label : 'Ver cursos'}
                          </a>
                        )}
                      </GenflixCtaButton>
                    )}
                  </EditableButton>
                ) : (
                  <form
                    onSubmit={handleNewsletterSubmit}
                    className="relative mt-8 w-full max-w-[640px] overflow-hidden rounded-[36px] border border-white/14 bg-[#08141d]/72 p-4 text-left shadow-[0_32px_90px_rgba(0,0,0,0.38)] backdrop-blur-md sm:p-5"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(118,223,240,0.16),transparent_42%),linear-gradient(180deg,rgba(8,20,29,0.18)_0%,rgba(8,20,29,0.68)_100%)]"
                    />

                    <div className="relative space-y-4">
                      <div className="rounded-[24px] border border-white/12 bg-white/6 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] !text-white">
                              <EditableText
                                entryKey={`${entryPrefix}.form.interest.title`}
                                fallback="Areas de interesse"
                                label="Titulo das areas da newsletter"
                                pageKey={pageKey}
                              />
                            </p>
                            <p className="mt-2 text-sm leading-6 !text-white">
                              <EditableText
                                entryKey={`${entryPrefix}.form.interest.description`}
                                fallback="Selecione as areas que mais combinam com o seu foco de estudos."
                                label="Descricao das areas da newsletter"
                                pageKey={pageKey}
                              />
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <label
                            className={[
                              'flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors sm:col-span-2 !text-white',
                              areAllInterestAreasSelected
                                ? 'border-white/40 bg-white/12 text-white'
                                : 'border-white/14 bg-white/8 text-white/92 hover:border-white/28 hover:bg-white/12',
                            ].join(' ')}
                          >
                            <input
                              type="checkbox"
                              checked={areAllInterestAreasSelected}
                              onChange={(event) => setAllInterestAreas(event.target.checked)}
                              className="h-4 w-4 rounded border-white/40 text-[#1398B7] focus:ring-[#1398B7]"
                            />
                            <span className="!text-white">
                              <EditableText
                                entryKey={`${entryPrefix}.form.interest.all_label`}
                                fallback="Todas as areas"
                                label="Rotulo todas as areas da newsletter"
                                pageKey={pageKey}
                              />
                            </span>
                          </label>

                          {newsletterSelectableAreas.map((area) => {
                            const isSelected = selectedInterestAreas.includes(area)

                            return (
                              <label
                                key={area}
                                className={[
                                  'flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors !text-white',
                                  isSelected
                                    ? 'border-white/40 bg-white/12 text-white'
                                    : 'border-white/14 bg-white/8 text-white/92 hover:border-white/28 hover:bg-white/12',
                                ].join(' ')}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleInterestArea(area)}
                                  className="h-4 w-4 rounded border-white/40 text-[#1398B7] focus:ring-[#1398B7]"
                                />
                                <span className="!text-white">
                                  <EditableText
                                    entryKey={`${entryPrefix}.form.interest.option.${area.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`}
                                    fallback={area}
                                    label={`Rotulo da area ${area}`}
                                    pageKey={pageKey}
                                  />
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 rounded-full border border-white/14 bg-white/10 p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.18)] backdrop-blur-sm md:flex-row md:items-center">
                        <div className="flex min-h-[50px] flex-1 items-center rounded-full bg-white px-5 shadow-[inset_0_1px_0_rgba(16,36,43,0.06)]">
                          <input
                            type="email"
                            value={newsletterEmail}
                            onChange={(event) => setNewsletterEmail(event.target.value)}
                            required
                            placeholder={placeholder}
                            className="w-full border-0 bg-transparent text-sm font-medium text-[#183139] outline-none placeholder:text-[#8BA0A7]"
                          />
                        </div>

                        <EditableButton
                          entryKey={`${entryPrefix}.button`}
                          fallback={{ label: legacyButtonLabel, tone: 'solid' }}
                          label="Botão da newsletter"
                          pageKey={pageKey}
                        >
                          {(buttonValue) => (
                            <GenflixCtaButton
                              type="submit"
                              disabled={isSubmitting}
                              className="min-h-[50px] justify-between px-5 md:min-w-[220px]"
                              tone={normalizeGenflixCtaTone(buttonValue.tone)}
                            >
                              {isSubmitting ? 'Enviando...' : (typeof buttonValue.label === 'string' ? buttonValue.label : 'Quero me inscrever')}
                            </GenflixCtaButton>
                          )}
                        </EditableButton>
                      </div>
                    </div>
                  </form>
                )}

                {variant === 'form' && message ? <p className="mt-4 text-sm font-semibold !text-white">{message}</p> : null}
              </div>
            </div>
          </div>
        )}
      </EditableImage>
    </section>
  )
}
