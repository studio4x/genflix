import { PublicGenericPage } from '@/components/public/public-generic-page'

export function PublicRefundPolicyPage() {
  return (
    <PublicGenericPage
      entryPrefix="global.institutional.refund"
      eyebrow="Política institucional"
      title="Política de reembolso"
      description="Esta página organiza, de forma clara e objetiva, como a GenFlix tratará solicitações de cancelamento e reembolso."
      sections={[
        {
          title: 'Como funciona hoje',
          paragraphs: [
            'A política comercial definitiva desta frente ainda está em consolidação jurídica e operacional. Por isso, esta página funciona como placeholder navegável da área institucional.',
            'Enquanto isso, qualquer pedido de reembolso ou revisão de compra deve ser encaminhado pelo canal oficial de contato da plataforma para análise individual.',
          ],
        },
        {
          title: 'Próximos passos',
          paragraphs: [
            'A versão final desta política detalhará prazos, critérios aplicáveis, exceções e o fluxo de atendimento relacionado a pagamentos, assinaturas e compras avulsas.',
          ],
        },
      ]}
      cta={{ label: 'Falar com a GenFlix', href: '/contato', isInternal: true }}
    />
  )
}
