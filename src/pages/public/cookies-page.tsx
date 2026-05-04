import { PublicGenericPage } from '@/components/public/public-generic-page'

const cookieTopics = [
  'A GenFlix pode utilizar cookies e tecnologias semelhantes para autenticação, manutenção de sessão, segurança, funcionamento técnico da plataforma e personalização básica da experiência.',
  'Também podem ser usados recursos de medição e desempenho para entender estabilidade, identificar falhas e melhorar a navegação, sempre conforme a base legal aplicável.',
  'Quando houver cookies não essenciais sujeitos a consentimento, o tratamento seguirá as configurações e controles disponibilizados pela plataforma.',
  'A desativação de cookies essenciais pode comprometer login, navegação, reprodução de conteúdo e outras funcionalidades indispensáveis do ambiente.',
]

export function CookiesPage() {
  return (
    <PublicGenericPage
      entryPrefix="global.institutional.cookies"
      eyebrow="Cookies"
      title="Uso de Cookies"
      description="Esta página explica, de forma objetiva, como a GenFlix pode utilizar cookies e tecnologias semelhantes para autenticação, segurança, desempenho e funcionamento do serviço."
      backgroundClassName="bg-white"
      sections={[
        {
          title: 'Regras gerais',
          paragraphs: cookieTopics,
        },
      ]}
    />
  )
}
