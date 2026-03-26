import { PublicLegalPageShell } from '@/pages/public/public-legal-page-shell'

const cookieTopics = [
  'A HomeCare Match pode utilizar cookies e tecnologias semelhantes estritamente necessarias para autenticacao, seguranca da sessao, navegacao e funcionamento tecnico do LMS.',
  'Tambem podem ser usados recursos de medicao tecnica e desempenho para manter estabilidade, prevenir fraude e melhorar a experiencia de uso, sempre de acordo com a base legal aplicavel.',
  'Quando houver cookies nao essenciais sujeitos a consentimento, o tratamento seguira as configuracoes e controles disponibilizados pela plataforma.',
  'A desativacao de cookies essenciais pode comprometer o login, a navegacao e outras funcionalidades indispensaveis do ambiente.',
]

export function CookiesPage() {
  return (
    <PublicLegalPageShell
      eyebrow="Cookies"
      title="Uso de Cookies"
      summary="Esta pagina explica, de forma objetiva, como o ambiente HomeCare Match pode usar cookies e tecnologias semelhantes para autenticacao, seguranca e funcionamento do servico."
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
