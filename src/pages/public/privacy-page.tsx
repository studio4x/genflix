import { PublicGenericPage } from '@/components/public/public-generic-page'

export function PrivacyPage() {
  return (
    <PublicGenericPage
      entryPrefix="global.institutional.privacy"
      eyebrow="Privacidade"
      title="Privacidade e Protecao de Dados"
      description="Esta p?gina resume como a GenFlix coleta, utiliza, protege e trata dados pessoais no contexto do acesso a plataforma, aos cursos e aos recursos educacionais."
      backgroundClassName="bg-white"
      sections={[
        {
          title: 'Como tratamos seus dados',
          paragraphs: [
            'Os dados pessoais tratados na GenFlix seguem a legisla??o aplicavel, especialmente a LGPD, e sao utilizados para autenticacao, matr?cula, acesso ao conte?do, suporte, seguranca e melhoria da experi?ncia.',
            'Informacoes cadastrais, dados de navega??o, hist?rico de progresso, respostas a atividades e interacoes com o ambiente podem ser usados para operacao legitima da plataforma.',
          ],
        },
        {
          title: 'Compartilhamento e direitos',
          paragraphs: [
            'A GenFlix n?o vende dados pessoais. O compartilhamento acontece apenas quando necessario para a operacao do servi?o, cumprimento legal, prevencao a fraude ou defesa de direitos.',
            'Sempre que aplicavel, o usuario podera exercer seus direitos de acesso, correcao, atualizacao e demais prerrogativas previstas em lei pelos canais oficiais da plataforma.',
          ],
        },
      ]}
    />
  )
}
