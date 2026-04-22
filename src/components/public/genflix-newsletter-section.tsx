import { type FormEvent, useState } from 'react'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { genflixNewsletterImage } from '@/features/public/genflix-public-media'
import { EditableButton, EditableImage, EditableText, getEditableImagePresentation, useEditableValue } from '@/features/site-editor/visual-editor'
import type { SitePageKey } from '@/features/site-editor/types'

export function GenflixNewsletterSection({
  id = 'newsletter',
  entryPrefix = 'global.newsletter',
  pageKey = 'global',
}: {
  id?: string
  entryPrefix?: string
  pageKey?: SitePageKey
}) {
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const image = useEditableValue(`${entryPrefix}.image`, { src: genflixNewsletterImage, alt: 'Newsletter GenFlix' }, { pageKey })
  const placeholder = useEditableValue(`${entryPrefix}.placeholder`, 'Seu@e-mail.com', { pageKey })
  const legacyButtonLabel = useEditableValue(`${entryPrefix}.button.label`, 'Quero me inscrever', { pageKey })

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
          source_path: window.location.pathname,
          source_url: window.location.href,
        }),
      })

      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Nao foi possivel cadastrar seu e-mail.')
      }

      setNewsletterEmail('')
      setMessage('Cadastro recebido. Obrigado por se inscrever!')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel cadastrar seu e-mail.')
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
                <h2 className="max-w-[420px] text-[2.2rem] font-bold leading-[0.98] tracking-[-0.05em] text-white sm:text-[2.8rem]">
                  <EditableText
                    entryKey={`${entryPrefix}.title`}
                    fallback="Assine nossa newsletter"
                    label="Título da newsletter"
                    pageKey={pageKey}
                  />
                </h2>
                <p className="mt-4 max-w-[620px] text-sm leading-7 text-white/74 sm:text-base">
                  <EditableText
                    entryKey={`${entryPrefix}.description`}
                    fallback="Cadastre-se para receber atualizações sobre nossos cursos e conteúdo."
                    label="Descrição da newsletter"
                    pageKey={pageKey}
                  />
                </p>

                <form
                  onSubmit={handleNewsletterSubmit}
                  className="mt-8 flex w-full max-w-[640px] flex-col gap-3 rounded-full bg-white/14 p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.18)] backdrop-blur-sm md:flex-row md:items-center"
                >
                  <div className="flex min-h-[50px] flex-1 items-center rounded-full bg-white px-5">
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
                        tone={buttonValue.tone === 'surface' || buttonValue.tone === 'ghost' ? buttonValue.tone : 'solid'}
                      >
                        {isSubmitting ? 'Enviando...' : (typeof buttonValue.label === 'string' ? buttonValue.label : 'Quero me inscrever')}
                      </GenflixCtaButton>
                    )}
                  </EditableButton>
                </form>

                {message ? <p className="mt-4 text-sm font-semibold text-white/86">{message}</p> : null}
              </div>
            </div>
          </div>
        )}
      </EditableImage>
    </section>
  )
}
