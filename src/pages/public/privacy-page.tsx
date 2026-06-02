import { PublicGenericPage } from '@/components/public/public-generic-page'

export function PrivacyPage() {
  return (
    <PublicGenericPage
      entryPrefix="global.institutional.privacy"
      eyebrow="Privacidade"
      title="Privacidade e Protecao de Dados"
      description="Esta página resume como a GenFlix coleta, utiliza, protege e trata dados pessoais no contexto do acesso à plataforma, aos cursos e aos recursos educacionais."
      backgroundClassName="bg-white"
      sections={[
        {
          title: 'Como tratamos seus dados',
          paragraphs: [
            'Os dados pessoais tratados na GenFlix seguem a legislação aplicável, especialmente a LGPD, e são utilizados para autenticação, matrícula, acesso ao conteúdo, suporte, segurança e melhoria da experiência.',
            'Informações cadastrais, dados de navegação, histórico de progresso, respostas a atividades e interações com o ambiente podem ser usados para operação legítima da plataforma.',
          ],
        },
        {
          title: 'Compartilhamento e direitos',
          paragraphs: [
            'A GenFlix não vende dados pessoais. O compartilhamento acontece apenas quando necessário para a operação do serviço, cumprimento legal, prevenção a fraude ou defesa de direitos.',
            'Sempre que aplicável, o usuário poderá exercer seus direitos de acesso, correção, atualização e demais prerrogativas previstas em lei pelos canais oficiais da plataforma.',
          ],
        },
      ]}
    />
  )
}
