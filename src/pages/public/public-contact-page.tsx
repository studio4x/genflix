import { type FormEvent, useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { genflixNavLinks } from '@/features/public/genflix-site-content'
import { EditableText, useEditableValue } from '@/features/site-editor/visual-editor'

export function PublicContactPage() {
  const { isLoading, user, roles } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const namePlaceholder = useEditableValue('contact.form.name.placeholder', 'Seu nome')
  const emailPlaceholder = useEditableValue('contact.form.email.placeholder', 'Seu@e-mail.com')
  const messagePlaceholder = useEditableValue('contact.form.message.placeholder', 'Escreva sua mensagem')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/public/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_type: 'contact',
          name: name.trim(),
          email: email.trim(),
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
      <section className="bg-[#F2F7F9]">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-6">
          <GenflixPublicHeader currentPage="contact" navLinks={genflixNavLinks} />
        </div>
      </section>

      <section className="bg-white pb-0 pt-4">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-6">
          <div className="grid min-h-[620px] overflow-hidden rounded-t-[30px] border border-[#D8E6EB] bg-white shadow-[0_24px_56px_rgba(21,50,59,0.05)] lg:grid-cols-[1.02fr_0.98fr]">
            <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_32%_22%,rgba(54,211,188,0.22),transparent_38%),radial-gradient(circle_at_72%_30%,rgba(19,152,183,0.18),transparent_30%),linear-gradient(180deg,#F8FBFC_0%,#F2F7F9_100%)] px-8 py-14">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[12%] top-[20%] h-40 w-28 rotate-[18deg] rounded-[28px] bg-[#39d0be]/38 blur-[2px]" />
                <div className="absolute left-[22%] top-[18%] h-40 w-28 -rotate-[18deg] rounded-[28px] bg-[#1398B7]/34 blur-[2px]" />
                <div className="absolute left-[18%] top-[36%] h-44 w-32 rounded-[32px] bg-[#4baee9]/34 blur-[2px]" />
                <div className="absolute left-[15%] top-[23%] h-52 w-32 rotate-[18deg] rounded-[30px] border border-[#1bb6b2]/40 bg-[#1bb6b2]/18 shadow-[0_24px_40px_rgba(27,182,178,0.18)]" />
                <div className="absolute left-[25%] top-[21%] h-52 w-32 -rotate-[18deg] rounded-[30px] border border-[#1398B7]/34 bg-[#1398B7]/18 shadow-[0_24px_40px_rgba(19,152,183,0.12)]" />
                <div className="absolute left-[19%] top-[38%] h-56 w-36 rounded-[34px] border border-[#41a8e2]/34 bg-[#41a8e2]/18 shadow-[0_24px_40px_rgba(65,168,226,0.14)]" />
              </div>

              <div className="relative z-10 flex items-center gap-6 sm:gap-8">
                <div className="relative h-48 w-40 shrink-0 sm:h-56 sm:w-48">
                  <span className="absolute left-2 top-1 h-28 w-20 rotate-[18deg] rounded-[24px] bg-[#39d0be]/30 shadow-[0_20px_45px_rgba(27,182,178,0.16)] sm:h-32 sm:w-24" />
                  <span className="absolute right-3 top-0 h-28 w-20 -rotate-[18deg] rounded-[24px] bg-[#1398B7]/28 shadow-[0_20px_45px_rgba(19,152,183,0.14)] sm:h-32 sm:w-24" />
                  <span className="absolute bottom-0 left-8 h-32 w-24 rounded-[28px] bg-[#4ab2ea]/28 shadow-[0_20px_45px_rgba(65,168,226,0.14)] sm:h-36 sm:w-28" />
                  <span className="absolute left-4 top-4 h-28 w-20 rotate-[18deg] rounded-[24px] border border-[#1bb6b2]/45 bg-[#1bb6b2]/18 backdrop-blur-[1px] sm:h-32 sm:w-24" />
                  <span className="absolute right-5 top-3 h-28 w-20 -rotate-[18deg] rounded-[24px] border border-[#1398B7]/40 bg-[#1398B7]/16 backdrop-blur-[1px] sm:h-32 sm:w-24" />
                  <span className="absolute bottom-2 left-10 h-32 w-24 rounded-[28px] border border-[#41a8e2]/40 bg-[#41a8e2]/16 backdrop-blur-[1px] sm:h-36 sm:w-28" />
                </div>

                <div className="text-[#17323a] drop-shadow-[0_10px_20px_rgba(21,50,59,0.18)]">
                  <p className="font-readex text-[3.2rem] font-medium tracking-[-0.06em] sm:text-[4.3rem]">GenFlix</p>
                </div>
              </div>
            </div>

            <div className="flex items-center px-6 py-12 sm:px-10 lg:px-12">
              <div className="w-full max-w-[420px]">
                <h1 className="text-[2.45rem] font-extrabold leading-[0.95] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
                  <EditableText entryKey="contact.title" fallback="Fale com a gente." label="Título de contato" />
                </h1>
                <p className="mt-4 text-base leading-7 text-[#5f7178]">
                  <EditableText
                    entryKey="contact.description"
                    fallback="Dúvidas, sugestões ou suporte — estamos aqui."
                    label="Descrição de contato"
                  />
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div>
                    <label htmlFor="contact-name" className="mb-2 block text-sm font-medium text-[#4f656c]">
                      <EditableText entryKey="contact.form.name.label" fallback="Nome completo:" label="Rótulo do nome" />
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      placeholder={namePlaceholder}
                      className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#9babb0] focus:border-[#1398B7] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-email" className="mb-2 block text-sm font-medium text-[#4f656c]">
                      <EditableText entryKey="contact.form.email.label" fallback="E-mail:" label="Rótulo do e-mail" />
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      placeholder={emailPlaceholder}
                      className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#9babb0] focus:border-[#1398B7] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="mb-2 block text-sm font-medium text-[#4f656c]">
                      <EditableText entryKey="contact.form.message.label" fallback="Assunto:" label="Rótulo do assunto" />
                    </label>
                    <textarea
                      id="contact-message"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      required
                      rows={5}
                      placeholder={messagePlaceholder}
                      className="w-full rounded-[16px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 py-3 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#9babb0] focus:border-[#1398B7] focus:bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-full bg-[#1398B7] px-5 py-3 font-readex text-sm font-medium text-white shadow-[0_12px_30px_rgba(19,152,183,0.28)] transition-colors hover:bg-[#0A3640] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? 'Enviando...' : <EditableText entryKey="contact.form.submit" fallback="Enviar" label="Botão de envio" />}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  {feedback ? <p className="text-sm font-semibold text-[#5f7178]">{feedback}</p> : null}
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      <GenflixPublicFooter />
    </main>
  )
}
