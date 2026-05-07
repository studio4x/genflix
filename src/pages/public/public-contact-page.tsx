import { type FormEvent, useState } from 'react'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot'
import { genflixHeroImage } from '@/features/public/genflix-public-media'
import { genflixNavLinks } from '@/features/public/genflix-public-shell-content'
import {
  createSectionRegistryFallback,
  createSectionRegistrySchema,
  renderVisibleSectionList,
  resolveSectionRegistryTemplateKey,
  SectionStructureControl,
} from '@/features/site-editor/section-registry'
import { EditableText, useEditableValue } from '@/features/site-editor/visual-editor'

const contactSectionTemplates = [
  {
    id: 'form',
    label: 'Formulario de contato',
    description: 'Bloco principal com imagem lateral, textos e formulario publico.',
  },
]

const contactLayoutFallback = createSectionRegistryFallback(contactSectionTemplates)
const contactLayoutSchema = createSectionRegistrySchema({
  templates: contactSectionTemplates,
  instancePrefix: 'contact.sections',
  instancePageKey: 'contact',
})

function ContactFormSection({
  name,
  email,
  emailConfirmation,
  message,
  feedback,
  isSubmitting,
  namePlaceholder,
  emailPlaceholder,
  emailConfirmationPlaceholder,
  messagePlaceholder,
  onNameChange,
  onEmailChange,
  onEmailConfirmationChange,
  onMessageChange,
  onSubmit,
}: {
  name: string
  email: string
  emailConfirmation: string
  message: string
  feedback: string | null
  isSubmitting: boolean
  namePlaceholder: string
  emailPlaceholder: string
  emailConfirmationPlaceholder: string
  messagePlaceholder: string
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onEmailConfirmationChange: (value: string) => void
  onMessageChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="bg-white pb-0 pt-6">
      <div className="public-site-container">
        <div className="grid min-h-[620px] overflow-hidden rounded-[4px] border border-[#D8E6EB] bg-white shadow-[0_24px_56px_rgba(21,50,59,0.06)] lg:grid-cols-[1fr_1fr]">
          <div
            className="relative min-h-[360px] bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(10, 54, 64, 0.12) 0%, rgba(10, 54, 64, 0.42) 100%), url(${genflixHeroImage})`,
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.12),transparent_24%),radial-gradient(circle_at_78%_16%,rgba(255,255,255,0.18),transparent_20%)]" />
          </div>

          <div className="flex items-center px-6 py-12 sm:px-10 lg:px-12">
            <div className="w-full max-w-[420px]">
              <h1 className="text-[2.45rem] font-extrabold leading-[0.95] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
                <EditableText entryKey="contact.title" fallback="Fale com a gente." label="Titulo de contato" />
              </h1>
              <p className="mt-4 text-base leading-7 text-[#5f7178]">
                <EditableText
                  entryKey="contact.description"
                  fallback="Duvidas, sugestoes ou suporte - estamos aqui."
                  label="Descricao de contato"
                />
              </p>

              <form onSubmit={onSubmit} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="contact-name" className="mb-2 block text-sm font-medium text-[#4f656c]">
                    <EditableText entryKey="contact.form.name.label" fallback="Nome completo:" label="Rotulo do nome" />
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
                    required
                    placeholder={namePlaceholder}
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#9babb0] focus:border-[#1398B7] focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="contact-email" className="mb-2 block text-sm font-medium text-[#4f656c]">
                    <EditableText entryKey="contact.form.email.label" fallback="E-mail:" label="Rotulo do e-mail" />
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    required
                    placeholder={emailPlaceholder}
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#9babb0] focus:border-[#1398B7] focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="contact-email-confirmation" className="mb-2 block text-sm font-medium text-[#4f656c]">
                    <EditableText
                      entryKey="contact.form.email_confirmation.label"
                      fallback="Reinsira seu e-mail:"
                      label="Rotulo de reinsira e-mail"
                    />
                  </label>
                  <input
                    id="contact-email-confirmation"
                    type="email"
                    value={emailConfirmation}
                    onChange={(event) => onEmailConfirmationChange(event.target.value)}
                    required
                    placeholder={emailConfirmationPlaceholder}
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#9babb0] focus:border-[#1398B7] focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className="mb-2 block text-sm font-medium text-[#4f656c]">
                    <EditableText entryKey="contact.form.message.label" fallback="Assunto:" label="Rotulo do assunto" />
                  </label>
                  <textarea
                    id="contact-message"
                    value={message}
                    onChange={(event) => onMessageChange(event.target.value)}
                    required
                    rows={5}
                    placeholder={messagePlaceholder}
                    className="w-full rounded-[16px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 py-3 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#9babb0] focus:border-[#1398B7] focus:bg-white"
                  />
                </div>

                <GenflixCtaButton type="submit" disabled={isSubmitting} className="px-5 py-3">
                  {isSubmitting ? 'Enviando...' : <EditableText entryKey="contact.form.submit" fallback="Enviar" label="Botao de envio" />}
                </GenflixCtaButton>
                {feedback ? <p className="text-sm font-semibold text-[#5f7178]">{feedback}</p> : null}
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function PublicContactPage() {
  const { isLoading, user, roles } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [emailConfirmation, setEmailConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const contactSections = useEditableValue('contact.layout.sections', contactLayoutFallback)
  const namePlaceholder = useEditableValue('contact.form.name.placeholder', 'Seu nome')
  const emailPlaceholder = useEditableValue('contact.form.email.placeholder', 'Seu@e-mail.com')
  const emailConfirmationPlaceholder = useEditableValue('contact.form.email_confirmation.placeholder', 'Seu@e-mail.com')
  const messagePlaceholder = useEditableValue('contact.form.message.placeholder', 'Escreva sua mensagem')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedEmailConfirmation = emailConfirmation.trim().toLowerCase()

    if (normalizedEmail !== normalizedEmailConfirmation) {
      setFeedback('Os e-mails precisam ser iguais.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/public/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_type: 'contact',
          name: name.trim(),
          email: normalizedEmail,
          message: message.trim(),
          source_path: window.location.pathname,
          source_url: window.location.href,
        }),
      })

      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Nao foi possivel enviar sua mensagem.')
      }

      setName('')
      setEmail('')
      setEmailConfirmation('')
      setMessage('')
      setFeedback('Mensagem enviada com sucesso. Em breve entraremos em contato.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Nao foi possivel enviar sua mensagem.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader currentPage="contact" navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="contact" placementKey="hero" />
      <SectionStructureControl
        buttonLabel="Gerenciar blocos da pagina"
        pageKey="contact"
        entryKey="contact.layout.sections"
        label="Estrutura da pagina Contato"
        sections={contactSections}
        schema={contactLayoutSchema}
      />
      {renderVisibleSectionList(contactSections, (item) => {
        const templateKey = resolveSectionRegistryTemplateKey(item)

        if (templateKey === 'form') {
          return (
            <ContactFormSection
              name={name}
              email={email}
              emailConfirmation={emailConfirmation}
              message={message}
              feedback={feedback}
              isSubmitting={isSubmitting}
              namePlaceholder={namePlaceholder}
              emailPlaceholder={emailPlaceholder}
              emailConfirmationPlaceholder={emailConfirmationPlaceholder}
              messagePlaceholder={messagePlaceholder}
              onNameChange={setName}
              onEmailChange={setEmail}
              onEmailConfirmationChange={setEmailConfirmation}
              onMessageChange={setMessage}
              onSubmit={handleSubmit}
            />
          )
        }

        return null
      })}
      <GenflixPublicFooter />
    </main>
  )
}
