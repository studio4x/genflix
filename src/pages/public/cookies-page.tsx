import { PublicLegalPageShell } from '@/pages/public/public-legal-page-shell'

const cookieTopics = [
  'A GenFlix pode utilizar cookies e tecnologias semelhantes para autenticação, manutenção de sessão, segurança, funcionamento técnico da plataforma e personalização básica da experiência.',
  'Também podem ser usados recursos de medição e desempenho para entender estabilidade, identificar falhas e melhorar a navegação, sempre conforme a base legal aplicável.',
  'Quando houver cookies não essenciais sujeitos a consentimento, o tratamento seguirá as configurações e controles disponibilizados pela plataforma.',
  'A desativação de cookies essenciais pode comprometer login, navegação, reprodução de conteúdo e outras funcionalidades indispensáveis do ambiente.',
]

export function CookiesPage() {
  return (
    <PublicLegalPageShell
      eyebrow="Cookies"
      title="Uso de Cookies"
      summary="Esta página explica, de forma objetiva, como a GenFlix pode utilizar cookies e tecnologias semelhantes para autenticação, segurança, desempenho e funcionamento do serviço."
      updatedAt="10/04/2026"
      currentPage="cookies"
    >
      <section className="space-y-4">
        <h2 className="text-xl font-black tracking-tight text-[#183139]">
          Regras gerais
        </h2>
        <ul className="space-y-3">
          {cookieTopics.map((topic) => (
            <li
              key={topic}
              className="rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3 text-sm leading-6 text-[#56696f]"
            >
              {topic}
            </li>
          ))}
        </ul>
      </section>
    </PublicLegalPageShell>
  )
}
