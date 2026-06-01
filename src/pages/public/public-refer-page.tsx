import { type FormEvent, useMemo, useState } from 'react'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { genflixNavLinks } from '@/features/public/genflix-public-shell-content'

export function PublicReferPage() {
  const [referrerName, setReferrerName] = useState('')
  const [referrerEmail, setReferrerEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return 'https://genflix-omega.vercel.app/'
    }

    return `${window.location.origin}/`
  }, [])

  const whatsappShareUrl = useMemo(() => {
    const text = `Conheca a GenFlix: ${shareUrl}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }, [shareUrl])

  async function handleCopyLink() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = shareUrl
        textArea.setAttribute('readonly', 'true')
        textArea.style.position = 'absolute'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }

      setFeedback('Link copiado com sucesso.')
    } catch {
      setFeedback('N?o foi possivel copiar o link agora.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/public/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_type: 'refer',
          name: referrerName.trim(),
          email: referrerEmail.trim().toLowerCase(),
          recipient_name: recipientName.trim(),
          recipient_email: recipientEmail.trim().toLowerCase(),
          message: message.trim(),
          source_path: window.location.pathname,
          source_url: window.location.href,
        }),
      })

      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error ?? 'N?o foi possivel enviar a indicacao.')
      }

      setReferrerName('')
      setReferrerEmail('')
      setRecipientName('')
      setRecipientEmail('')
      setMessage('')
      setFeedback('Indicacao enviada com sucesso.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'N?o foi possivel enviar a indicacao.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-white font-manrope text-[#163138]">
      <GenflixPublicHeader navLinks={genflixNavLinks} />

      <section className="border-b border-[#D8E6EB] bg-[#F2F7F9] py-14 sm:py-16">
        <div className="public-site-container">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Compartilhe a GenFlix</p>
          <h1 className="mt-4 max-w-[760px] text-[2.5rem] font-extrabold leading-[0.95] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
            Indique a GenFlix
          </h1>
          <p className="mt-4 max-w-[760px] text-base leading-7 text-[#5f7178]">
            Compartilhe o link da plataforma e envie uma indicacao direta para alguem conhecer os cursos e recursos da GenFlix.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <GenflixCtaButton type="button" className="px-5 py-3" onClick={handleCopyLink}>
              Copiar link de compartilhamento
            </GenflixCtaButton>
            <GenflixCtaButton asChild tone="surface" className="px-5 py-3">
              <a href={whatsappShareUrl} target="_blank" rel="noreferrer">Compartilhar no WhatsApp</a>
            </GenflixCtaButton>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="public-site-container">
          <div className="mx-auto max-w-[760px] rounded-[20px] border border-[#D8E6EB] bg-white p-6 shadow-[0_20px_48px_rgba(21,50,59,0.06)] sm:p-8">
            <h2 className="text-[1.7rem] font-bold tracking-[-0.03em] text-[#183139]">Enviar indicacao por e-mail</h2>
            <p className="mt-2 text-sm leading-6 text-[#5f7178]">Preencha os dados e enviaremos um e-mail para o contato indicado.</p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#4f656c]">Seu nome</span>
                  <input
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                    value={referrerName}
                    onChange={(event) => setReferrerName(event.target.value)}
                    placeholder="Nome completo"
                    required
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#4f656c]">Seu e-mail</span>
                  <input
                    type="email"
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                    value={referrerEmail}
                    onChange={(event) => setReferrerEmail(event.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#4f656c]">Nome de quem sera indicado</span>
                  <input
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                    value={recipientName}
                    onChange={(event) => setRecipientName(event.target.value)}
                    placeholder="Nome completo"
                    required
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#4f656c]">E-mail de quem sera indicado</span>
                  <input
                    type="email"
                    className="h-12 w-full rounded-[12px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 text-sm text-[#183139] outline-none placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    placeholder="contato@email.com"
                    required
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-[#4f656c]">Mensagem (opcional)</span>
                <textarea
                  className="min-h-[120px] w-full rounded-[16px] border border-[#D8E6EB] bg-[#EDF4F6] px-4 py-3 text-sm text-[#183139] outline-none placeholder:text-[#8BA0A7] focus:border-[#1398B7] focus:bg-white"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Escreva uma mensagem curta para acompanhar a indicacao."
                />
              </label>

              <GenflixCtaButton type="submit" disabled={isSubmitting} className="px-5 py-3">
                {isSubmitting ? 'Enviando...' : 'Enviar indicacao'}
              </GenflixCtaButton>
              {feedback ? <p className="text-sm font-semibold text-[#5f7178]">{feedback}</p> : null}
            </form>
          </div>
        </div>
      </section>

      <GenflixPublicFooter />
    </main>
  )
}
