import { PublicGenericPage } from '@/components/public/public-generic-page';
export function PublicHelpPage() {
    return (<PublicGenericPage entryPrefix="global.institutional.help" eyebrow="Central de ajuda" title="Ajuda / Como usar" description="Esta seção será a base da futura central de ajuda com orientações práticas de uso da plataforma." sections={[
            {
                title: 'Conteúdo previsto',
                paragraphs: [
                    'Aqui entraremos com tutoriais de navegação, uso da conta, recuperação de acesso, acompanhamento de cursos, recursos didáticos e boas práticas para aproveitar melhor a plataforma.',
                ],
            },
            {
                title: 'Status atual',
                paragraphs: [
                    'A página já está publicada como placeholder institucional, com estrutura pronta para evoluir para uma central de ajuda completa sem quebrar navegação nem links do rodapé.',
                ],
            },
        ]} cta={{ label: 'Criar conta', href: '/criar-conta', isInternal: true }}/>);
}
