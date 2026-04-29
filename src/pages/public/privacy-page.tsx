import { PublicGenericPage } from '@/components/public/public-generic-page'

export function PrivacyPage() {
  return (
    <PublicGenericPage
      entryPrefix="global.institutional.privacy"
      eyebrow="Privacidade"
      title="Privacidade e Protecao de Dados"
      description="Esta pagina resume como a GenFlix coleta, utiliza, protege e trata dados pessoais no contexto do acesso a plataforma, aos cursos e aos recursos educacionais."
      sections={[
        {
          title: 'Como tratamos seus dados',
          paragraphs: [
            'Os dados pessoais tratados na GenFlix seguem a legislacao aplicavel, especialmente a LGPD, e sao utilizados para autenticacao, matricula, acesso ao conteudo, suporte, seguranca e melhoria da experiencia.',
            'Informacoes cadastrais, dados de navegacao, historico de progresso, respostas a atividades e interacoes com o ambiente podem ser usados para operacao legitima da plataforma.',
          ],
        },
        {
          title: 'Compartilhamento e direitos',
          paragraphs: [
            'A GenFlix nao vende dados pessoais. O compartilhamento acontece apenas quando necessario para a operacao do servico, cumprimento legal, prevencao a fraude ou defesa de direitos.',
            'Sempre que aplicavel, o usuario podera exercer seus direitos de acesso, correcao, atualizacao e demais prerrogativas previstas em lei pelos canais oficiais da plataforma.',
          ],
        },
      ]}
    />
  )
}
