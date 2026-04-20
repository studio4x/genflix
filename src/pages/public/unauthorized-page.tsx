import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixAuthLayout } from '@/components/public/genflix-auth-layout'
import { genflixHeroImage } from '@/features/public/genflix-site-content'

export function UnauthorizedPage() {
  return (
    <GenflixAuthLayout
      title="Acesso restrito"
      subtitle="Esta área do GenFlix exige permissão específica para continuar."
      imageUrl={genflixHeroImage}
    >
      <div className="rounded-[24px] border border-[#D8E6EB] bg-[#F2F7F9] p-6 text-[#163138] shadow-[0_18px_36px_rgba(22,49,56,0.06)]">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#1398B7] shadow-[0_12px_24px_rgba(19,152,183,0.16)]">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <h2 className="mt-5 font-readex text-[1.7rem] font-medium text-[#163138]">
          Você não tem acesso a esta página
        </h2>

        <p className="mt-3 text-sm leading-7 text-[#5f7077]">
          Seu perfil atual não possui permissão para visualizar este conteúdo. Se você acredita que isso
          é um engano, tente entrar com outra conta ou volte para as páginas públicas da plataforma.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <GenflixCtaButton asChild tone="surface" className="h-12 px-5">
            <Link to="/">Voltar ao início</Link>
          </GenflixCtaButton>

          <GenflixCtaButton asChild className="h-12 px-5">
            <Link to="/login">Entrar com outra conta</Link>
          </GenflixCtaButton>
        </div>
      </div>
    </GenflixAuthLayout>
  )
}
