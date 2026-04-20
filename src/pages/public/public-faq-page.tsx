import { PublicGenericPage } from '@/components/public/public-generic-page'

export function PublicFaqPage() {
  return (
    <PublicGenericPage
      eyebrow="Ajuda rápida"
      title="Perguntas frequentes"
      description="Reunimos aqui os principais tópicos que serão expandidos conforme a central de ajuda pública da GenFlix evoluir."
      sections={[
        {
          title: 'O que você vai encontrar aqui',
          paragraphs: [
            'Esta área será usada para responder dúvidas recorrentes sobre acesso, conta, navegação, compras, recursos didáticos e participação nas iniciativas da plataforma.',
            'Nesta primeira entrega, a página entra como placeholder institucional para garantir navegação consistente a partir do novo rodapé global.',
          ],
        },
        {
          title: 'Enquanto o FAQ completo não entra',
          paragraphs: [
            'Se você precisar de suporte imediato, use a página de contato. Ela continua sendo o canal principal para dúvidas operacionais e solicitações específicas.',
          ],
        },
      ]}
      cta={{ label: 'Abrir contato', href: '/contato', isInternal: true }}
    />
  )
}
