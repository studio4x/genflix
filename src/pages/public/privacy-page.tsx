import { PublicLegalPageShell } from '@/pages/public/public-legal-page-shell'

const privacyTopics = [
  'Os dados pessoais tratados na GenFlix seguem a legislação aplicável, especialmente a LGPD, e são utilizados para autenticação, matrícula, acesso ao conteúdo, suporte, segurança e melhoria da experiência.',
  'Informações cadastrais, dados de navegação, histórico de progresso, respostas a atividades e interações com o ambiente podem ser usados para operação legítima da plataforma.',
  'A GenFlix não vende dados pessoais. O compartilhamento acontece apenas quando necessário para a operação do serviço, cumprimento legal, prevenção à fraude ou defesa de direitos.',
  'Sempre que aplicável, o usuário poderá exercer seus direitos de acesso, correção, atualização e demais prerrogativas previstas em lei pelos canais oficiais da plataforma.',
]

export function PrivacyPage() {
  return (
    <PublicLegalPageShell
      eyebrow="Privacidade"
      title="Privacidade e Proteção de Dados"
      summary="Esta página resume como a GenFlix coleta, utiliza, protege e trata dados pessoais no contexto do acesso à plataforma, aos cursos e aos recursos educacionais."
      updatedAt="10/04/2026"
    >
      <section className="space-y-4">
        <h2 className="text-xl font-black tracking-tight text-[#183139]">
          Como tratamos seus dados
        </h2>
        <ul className="space-y-3">
          {privacyTopics.map((topic) => (
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
