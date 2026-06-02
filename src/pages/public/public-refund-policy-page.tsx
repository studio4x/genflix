import { PublicGenericPage } from '@/components/public/public-generic-page';
export function PublicRefundPolicyPage() {
    return (<PublicGenericPage entryPrefix="global.institutional.refund" eyebrow="Política institucional" title="Política de reembolso" description="Esta página organiza, de forma clara e objetiva, como a GenFlix tratará solicitações de cancelamento e reembolso." backgroundClassName="bg-white" sections={[
            {
                title: 'Como funciona hoje',
                paragraphs: [
                    "A pol\u00EDtica comercial definitiva dest frente ainda est\u00E1 em consolida\u00E7\u00E3o jur\u00EDdica e operacional. Por isso, est p\u00E1gina funciona como placeholder naveg\u00E1vel da \u00E1rea institucional.",
                    'Enquanto isso, qualquer pedido de reembolso ou revisão de compra deve ser encaminhado pelo canal oficial de contato da plataforma para análise individual.',
                ],
            },
            {
                title: 'Próximos passos',
                paragraphs: [
                    "A vers\u00E3o final dest pol\u00EDtica detalhar\u00E1 prazos, crit\u00E9rios aplic\u00E1veis, exce\u00E7\u00F5es e o fluxo de atendimento relacionado a pagamentos, assinaturas e compras avulsas.",
                ],
            },
        ]} cta={{ label: 'Falar com a GenFlix', href: '/contato', isInternal: true }}/>);
}
