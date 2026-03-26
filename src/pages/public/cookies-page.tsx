import { PublicLegalPageShell } from '@/pages/public/public-legal-page-shell'

const cookieTopics = [
  'A HomeCare Match pode utilizar cookies e tecnologias semelhantes estritamente necessárias para autenticação, segurança da sessão, navegação e funcionamento técnico do LMS.',
  'Também podem ser usados recursos de medição técnica e desempenho para manter estabilidade, prevenir fraude e melhorar a experiência de uso, sempre de acordo com a base legal aplicável.',
  'Quando houver cookies não essenciais sujeitos a consentimento, o tratamento seguirá as configurações e controles disponibilizados pela plataforma.',
  'A desativação de cookies essenciais pode comprometer o login, a navegação e outras funcionalidades indispensáveis do ambiente.',
]

export function CookiesPage() {
  return (
    <PublicLegalPageShell
      eyebrow="Cookies"
      title="Uso de Cookies"
      summary="Esta página explica, de forma objetiva, como o ambiente HomeCare Match pode usar cookies e tecnologias semelhantes para autenticação, segurança e funcionamento do serviço."
      updatedAt="26/03/2026"
    >
      <section className="space-y-4">
        <h2 className="text-xl font-black tracking-tight text-slate-900">
          Regras gerais
        </h2>
        <ul className="space-y-3">
          {cookieTopics.map((topic) => (
            <li
              key={topic}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
            >
              {topic}
            </li>
          ))}
        </ul>
      </section>
    </PublicLegalPageShell>
  )
}
