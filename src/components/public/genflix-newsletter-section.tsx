import { type FormEvent, useState } from 'react'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { genflixNewsletterImage } from '@/features/public/genflix-site-content'
import { EditableButton, EditableImage, EditableText, useEditableValue } from '@/features/site-editor/visual-editor'
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
    <section id={id} className="bg-[#F2F7F9] pb-0 pt-2">
      <div className="public-site-container">
        <EditableImage entryKey={`${entryPrefix}.image`} fallback={image} label="Imagem da newsletter" pageKey={pageKey}>
          {(editableImage) => (
            <div
              className="overflow-hidden rounded-t-[30px] bg-cover bg-center"
              style={{ backgroundImage: `linear-gradient(180deg, rgba(14,31,37,0.72) 0%, rgba(14,31,37,0.84) 100%), url(${typeof editableImage.src === 'string' ? editableImage.src : genflixNewsletterImage})` }}
            >
              <div className="flex min-h-[360px] items-center justify-center px-6 py-12 text-center sm:px-10">
                <div className="max-w-[720px]">
                  <h2 className="mx-auto max-w-[440px] text-[2.2rem] font-extrabold leading-[1.02] tracking-[-0.05em] text-white sm:text-[2.8rem]">
                    <EditableText
                      entryKey={`${entryPrefix}.title`}
                      fallback="Fique por dentro com nossa newsletter"
                      label="Título da newsletter"
                      pageKey={pageKey}
                    />
                  </h2>
                  <p className="mx-auto mt-4 max-w-[620px] text-base leading-7 text-white/78">
                    <EditableText
                      entryKey={`${entryPrefix}.description`}
                      fallback="Cadastre-se para receber atualizações sobre nossos cursos e conteúdo."
                      label="Descrição da newsletter"
                      pageKey={pageKey}
                    />
                  </p>

                  <form
                    onSubmit={handleNewsletterSubmit}
                    className="mx-auto mt-8 flex max-w-[720px] flex-col gap-3 rounded-[20px] bg-white/10 p-3 backdrop-blur-sm md:flex-row"
                  >
                    <div className="flex min-h-[54px] flex-1 items-center rounded-[16px] bg-white px-5 text-left shadow-sm">
                      <input
                        type="email"
                        value={newsletterEmail}
                        onChange={(event) => setNewsletterEmail(event.target.value)}
                        required
                        placeholder={placeholder}
                        className="w-full border-0 bg-transparent text-sm font-medium text-[#183139] outline-none placeholder:text-[#8ba0a7]"
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
                          className="min-h-[54px] px-6"
                          tone={buttonValue.tone === 'surface' || buttonValue.tone === 'ghost' ? buttonValue.tone : 'solid'}
                        >
                          {isSubmitting ? 'Enviando...' : (typeof buttonValue.label === 'string' ? buttonValue.label : 'Quero me inscrever')}
                        </GenflixCtaButton>
                      )}
                    </EditableButton>
                  </form>
                  {message ? <p className="mt-4 text-sm font-bold text-white/85">{message}</p> : null}
                </div>
              </div>
            </div>
          )}
        </EditableImage>
      </div>
    </section>
  )
}
