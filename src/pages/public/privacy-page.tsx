import { PublicLegalPageShell } from '@/pages/public/public-legal-page-shell'

const privacyTopics = [
  'Os dados pessoais tratados no LMS e nos demais ambientes da HomeCare Match seguem a Politica de Privacidade da plataforma e a LGPD.',
  'Documentos de identificacao, registros profissionais e dados eventualmente sensiveis sao utilizados para cadastro, seguranca, verificacao, cumprimento legal e operacao regular do servico.',
  'A HomeCare Match nao vende dados pessoais. O compartilhamento ocorre apenas quando necessario para operacao, obrigacao legal, protecao contra fraude ou exercicio regular de direitos.',
  'Informacoes de contato, como WhatsApp, podem ser liberadas apenas para usuarios logados e com interesse legitimo dentro da dinamica da plataforma.',
]

export function PrivacyPage() {
  return (
    <PublicLegalPageShell
      eyebrow="Privacidade"
      title="Privacidade e Protecao de Dados"
      summary="Esta pagina resume os pontos centrais de privacidade aplicaveis ao ambiente LMS da HomeCare Match. A versao completa e a base legal detalhada permanecem regidas pela Politica de Privacidade oficial da plataforma."
      updatedAt="26/03/2026"
    >
      <section className="space-y-4">
        <h2 className="text-xl font-black tracking-tight text-slate-900">
          Como tratamos seus dados
        </h2>
        <ul className="space-y-3">
          {privacyTopics.map((topic) => (
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
