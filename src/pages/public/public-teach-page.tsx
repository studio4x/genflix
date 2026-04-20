import { type FormEvent, useState } from 'react'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { genflixNavLinks } from '@/features/public/genflix-site-content'

export function PublicTeachPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
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
      <section className="bg-[#F2F7F9] pt-4">
        <div className="public-site-container">
          <GenflixPublicHeader navLinks={genflixNavLinks} />
        </div>
      </section>

      <section className="bg-white pb-16 pt-4">
        <div className="public-site-container">
          <div className="rounded-[28px] border border-[#D8E6EB] bg-[linear-gradient(180deg,#F8FBFC_0%,#F2F7F9_100%)] px-6 py-10 shadow-[0_20px_44px_rgba(21,50,59,0.04)] sm:px-10">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Parcerias educacionais</p>
            <h1 className="mt-4 max-w-[760px] text-[2.5rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
              Ensine na GenFlix
            </h1>
            <p className="mt-4 max-w-[740px] text-base leading-7 text-[#5f7178]">
              Esta landing foi preparada para receber autores, professores e especialistas que desejam oferecer cursos dentro da plataforma.
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-6">
              <article className="rounded-[24px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(21,50,59,0.04)] sm:px-8">
                <h2 className="text-[1.5rem] font-bold tracking-[-0.03em] text-[#183139]">Como a parceria vai funcionar</h2>
                <div className="mt-4 space-y-4 text-[15px] leading-8 text-[#5f7178]">
                  <p>
                    A página já está pronta para concentrar a proposta comercial e editorial da frente “Ensine na GenFlix”, com espaço para materiais institucionais e captação de novos cursos.
                  </p>
                  <p>
                    Nesta primeira entrega, o conteúdo é institucional e os ativos finais ainda entram como placeholders configuráveis para PDF e FlipPDF.
                  </p>
                </div>
              </article>

              <div className="grid gap-6 md:grid-cols-2">
                <article className="rounded-[24px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(21,50,59,0.04)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Apresentação em PDF</p>
                  <h3 className="mt-4 text-xl font-bold text-[#183139]">Slot pronto para PDF institucional</h3>
                  <p className="mt-3 text-sm leading-7 text-[#5f7178]">
                    O link final do PDF ainda não foi fornecido. Esta área fica pronta para receber o download assim que o material oficial chegar.
                  </p>
                  <GenflixCtaButton type="button" tone="surface" disabled className="mt-5 px-5 py-3 text-sm font-semibold">
                    PDF em breve
                  </GenflixCtaButton>
                </article>

                <article className="rounded-[24px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(21,50,59,0.04)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Apresentação interativa</p>
                  <h3 className="mt-4 text-xl font-bold text-[#183139]">Slot pronto para FlipPDF</h3>
                  <p className="mt-3 text-sm leading-7 text-[#5f7178]">
                    O embed definitivo do FlipPDF ainda será conectado. A estrutura visual e o espaço da vitrine já ficam reservados nesta entrega.
                  </p>
                  <div className="mt-5 rounded-[20px] border border-dashed border-[#D8E6EB] bg-[#F2F7F9] px-4 py-10 text-center text-sm font-semibold text-[#7c8e94]">
                    Embed FlipPDF em breve
                  </div>
                </article>
              </div>
            </div>

            <aside className="rounded-[24px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(21,50,59,0.04)]">
              <h2 className="text-[1.4rem] font-bold tracking-[-0.03em] text-[#183139]">Ofereça seu curso</h2>
              <p className="mt-3 text-sm leading-7 text-[#5f7178]">
                Envie uma apresentação inicial do curso, área de atuação e contexto da proposta.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#4f656c]">Nome</span>
                  <input
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Seu nome"
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#4f656c]">E-mail</span>
                  <input
                    type="email"
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Seu@e-mail.com"
                    required
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#4f656c]">Resumo da proposta</span>
                  <textarea
                    className="min-h-[180px] w-full rounded-[16px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 py-3 text-sm text-[#183139] outline-none transition-colors placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                    value={courseIdea}
                    onChange={(event) => setCourseIdea(event.target.value)}
                    placeholder="Conte qual curso você quer oferecer, para quem ele é e que formato imagina."
                    required
                  />
                </label>

                {message ? (
                  <p className="rounded-[14px] border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3 text-sm font-medium text-[#5f7178]">
                    {message}
                  </p>
                ) : null}

                <GenflixCtaButton type="submit" disabled={isSubmitting} className="h-12 w-full px-5">
                  {isSubmitting ? 'Enviando...' : 'Enviar proposta'}
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
