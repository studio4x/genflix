import { PublicGenericPage } from '@/components/public/public-generic-page'

export function PublicReferPage() {
  return (
    <PublicGenericPage
      entryPrefix="global.institutional.refer"
      eyebrow="Programa futuro"
      title="Indique a GenFlix"
      description="Estamos preparando uma frente dedicada a recomendações, convites e ações de indicação da plataforma."
      backgroundClassName="bg-white"
      sections={[
        {
          title: 'O que esta página vai receber',
          paragraphs: [
            'A estrutura definitiva desta área deverá concentrar campanha de indicação, benefícios, regras de participação e materiais de compartilhamento.',
            'Nesta etapa, a página entra como placeholder navegável para que o rodapé já reflita a arquitetura final desejada.',
          ],
        },
        {
          title: 'Como participar por enquanto',
          paragraphs: [
            'Se você quer indicar a GenFlix ou falar sobre parcerias de divulgação, use o canal de contato até que o fluxo próprio de indicação seja publicado.',
          ],
        },
      ]}
      cta={{ label: 'Falar com a equipe', href: '/contato', isInternal: true }}
    />
  )
}
