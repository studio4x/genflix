import { PublicLegalPageShell } from '@/pages/public/public-legal-page-shell'

const privacyTopics = [
  'Os dados pessoais tratados no LMS e nos demais ambientes da HomeCare Match seguem a Política de Privacidade da plataforma e a LGPD.',
  'Documentos de identificação, registros profissionais e dados eventualmente sensíveis são utilizados para cadastro, segurança, verificação, cumprimento legal e operação regular do serviço.',
  'A HomeCare Match não vende dados pessoais. O compartilhamento ocorre apenas quando necessário para operação, obrigação legal, proteção contra fraude ou exercício regular de direitos.',
  'Informações de contato, como WhatsApp, podem ser liberadas apenas para usuários logados e com interesse legítimo dentro da dinâmica da plataforma.',
]

export function PrivacyPage() {
  return (
    <PublicLegalPageShell
      eyebrow="Privacidade"
      title="Privacidade e Proteção de Dados"
      summary="Esta página resume os pontos centrais de privacidade aplicáveis ao ambiente LMS da HomeCare Match. A versão completa e a base legal detalhada permanecem regidas pela Política de Privacidade oficial da plataforma."
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
