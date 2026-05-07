import { type FormEvent, useState } from 'react'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { genflixNavLinks } from '@/features/public/genflix-public-shell-content'
import { EditableText } from '@/features/site-editor/visual-editor'

export function PublicTeachPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [emailConfirmation, setEmailConfirmation] = useState('')
  const [subject, setSubject] = useState('')
  const [courseIdea, setCourseIdea] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/public/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_type: 'teach',
          name: name.trim(),
          email: email.trim(),
          email_confirmation: emailConfirmation.trim(),
          subject: subject.trim(),
          message: courseIdea.trim(),
          source_path: window.location.pathname,
          source_url: window.location.href,
        }),
      })

      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Nao foi possivel enviar sua proposta agora.')
      }

      setName('')
      setEmail('')
      setEmailConfirmation('')
      setSubject('')
      setCourseIdea('')
      setMessage('Recebemos sua proposta. Em breve nosso time entra em contato.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel enviar sua proposta agora.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="global" placementKey="hero" />

      <section className="bg-white pb-16 pt-4">
        <div className="public-site-container">
          <div className="rounded-[28px] border border-[#D8E6EB] bg-[#F8FBFC] px-6 py-10 shadow-[0_20px_44px_rgba(21,50,59,0.04)] sm:px-10">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#1398B7]">
              <EditableText entryKey="global.teach.eyebrow" fallback="Parcerias com criadores" label="Chamada da página Ensine na GenFlix" pageKey="global" />
            </p>
            <h1 className="mt-4 max-w-[760px] text-[2.5rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
              <EditableText entryKey="global.teach.title" fallback="Ensine na GenFlix" label="Título da página Ensine na GenFlix" pageKey="global" />
            </h1>
            <p className="mt-4 max-w-[740px] text-base leading-7 text-[#5f7178]">
              <EditableText
                entryKey="global.teach.description"
                fallback="Se você é professor, especialista ou produtor de conteúdo, envie sua proposta para que a nossa equipe avalie a publicação do seu curso na plataforma."
                label="Descrição da página Ensine na GenFlix"
                pageKey="global"
              />
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-6">
              <article className="rounded-[24px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(21,50,59,0.04)] sm:px-8">
                <h2 className="text-[1.5rem] font-bold tracking-[-0.03em] text-[#183139]">
                  <EditableText entryKey="global.teach.partnership.title" fallback="Como a parceria funciona" label="Título da seção de parceria" pageKey="global" />
                </h2>
                <div className="mt-4 space-y-4 text-[15px] leading-8 text-[#5f7178]">
                  <p>
                    <EditableText entryKey="global.teach.partnership.paragraph1" fallback="Você apresenta a ideia do curso, explica para quem ele foi pensado e compartilha sua experiência no tema." label="Texto 1 da seção de parceria" pageKey="global" />
                  </p>
                  <p>
                    <EditableText entryKey="global.teach.partnership.paragraph2" fallback="A equipe GenFlix analisa o alinhamento pedagógico e comercial e retorna com os próximos passos para seguir com a publicação." label="Texto 2 da seção de parceria" pageKey="global" />
                  </p>
                </div>
              </article>

              <div className="grid gap-6 md:grid-cols-2">
                <article className="rounded-[24px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(21,50,59,0.04)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">
                    <EditableText entryKey="global.teach.pdf.eyebrow" fallback="Apresente seu projeto" label="Chamada do bloco PDF" pageKey="global" />
                  </p>
                  <h3 className="mt-4 text-xl font-bold text-[#183139]">
                    <EditableText entryKey="global.teach.pdf.title" fallback="Envie um resumo claro da sua proposta" label="Título do bloco PDF" pageKey="global" />
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#5f7178]">
                    <EditableText entryKey="global.teach.pdf.description" fallback="Conte o tema, o formato desejado, o público-alvo e o que você espera entregar para os alunos." label="Descrição do bloco PDF" pageKey="global" />
                  </p>
                </article>

                <article className="rounded-[24px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(21,50,59,0.04)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">
                    <EditableText entryKey="global.teach.flip.eyebrow" fallback="Próximos passos" label="Chamada do bloco FlipPDF" pageKey="global" />
                  </p>
                  <h3 className="mt-4 text-xl font-bold text-[#183139]">
                    <EditableText entryKey="global.teach.flip.title" fallback="Sua proposta passa por análise inicial" label="Título do bloco FlipPDF" pageKey="global" />
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#5f7178]">
                    <EditableText entryKey="global.teach.flip.description" fallback="Depois do envio, nossa equipe avalia a proposta e orienta sobre cadastro, estrutura do curso e produção do conteúdo." label="Descrição do bloco FlipPDF" pageKey="global" />
                  </p>
                </article>
              </div>
            </div>

            <aside className="rounded-[24px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(21,50,59,0.04)]">
              <h2 className="text-[1.4rem] font-bold tracking-[-0.03em] text-[#183139]">
                <EditableText entryKey="global.teach.form.title" fallback="Enviar proposta" label="Título do formulário Ensine na GenFlix" pageKey="global" />
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#5f7178]">
                <EditableText entryKey="global.teach.form.description" fallback="Preencha seus dados e descreva seu curso para iniciar a análise da parceria." label="Descrição do formulário Ensine na GenFlix" pageKey="global" />
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#4f656c]">
                    <EditableText entryKey="global.teach.form.nameLabel" fallback="Nome completo" label="Rótulo nome do formulário Ensine na GenFlix" pageKey="global" />
                  </span>
                  <input
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nome completo"
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#4f656c]">
                    <EditableText entryKey="global.teach.form.emailLabel" fallback="Seu e-mail" label="Rótulo e-mail do formulário Ensine na GenFlix" pageKey="global" />
                  </span>
                  <input
                    type="email"
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#4f656c]">
                    <EditableText entryKey="global.teach.form.emailConfirmationLabel" fallback="Reinsira seu e-mail" label="Rótulo confirmar e-mail do formulário Ensine na GenFlix" pageKey="global" />
                  </span>
                  <input
                    type="email"
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                    value={emailConfirmation}
                    onChange={(event) => setEmailConfirmation(event.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#4f656c]">
                    <EditableText entryKey="global.teach.form.subjectLabel" fallback="Assunto do curso" label="Rótulo assunto do formulário Ensine na GenFlix" pageKey="global" />
                  </span>
                  <input
                    type="text"
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Ex.: Saúde e educação"
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#4f656c]">
                    <EditableText entryKey="global.teach.form.messageLabel" fallback="Resumo da proposta" label="Rótulo proposta do formulário Ensine na GenFlix" pageKey="global" />
                  </span>
                  <textarea
                    className="min-h-[180px] w-full rounded-[16px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 py-3 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                    value={courseIdea}
                    onChange={(event) => setCourseIdea(event.target.value)}
                    placeholder="Explique seu curso, o público-alvo e o formato desejado."
                    required
                  />
                </label>

                {message ? (
                  <p className="rounded-[14px] border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3 text-sm font-medium text-[#5f7178]">
                    {message}
                  </p>
                ) : null}

                <GenflixCtaButton type="submit" disabled={isSubmitting} className="h-12 w-full px-5">
                  {isSubmitting ? 'Enviando...' : (
                    <EditableText entryKey="global.teach.form.submitLabel" fallback="Enviar proposta" label="Botão do formulário Ensine na GenFlix" pageKey="global" />
                  )}
                </GenflixCtaButton>
              </form>
            </aside>
          </div>
        </div>
      </section>

      <GenflixPublicFooter />
    </main>
  )
}
