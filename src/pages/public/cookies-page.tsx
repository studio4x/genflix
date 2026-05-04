import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { GenflixCookiePreferencesModal } from '@/components/public/genflix-cookie-preferences-modal'
import { PublicGenericPage } from '@/components/public/public-generic-page'

const cookieTopics = [
  'A GenFlix pode utilizar cookies e tecnologias semelhantes para autenticacao, manutencao de sessao, seguranca, funcionamento tecnico da plataforma e personalizacao basica da experiencia.',
  'Tambem podem ser usados recursos de medicao e desempenho para entender estabilidade, identificar falhas e melhorar a navegacao, sempre conforme a base legal aplicavel.',
  'Quando houver cookies nao essenciais sujeitos a consentimento, o tratamento seguira as configuracoes e controles disponibilizados pela plataforma.',
  'A desativacao de cookies essenciais pode comprometer login, navegacao, reproducao de conteudo e outras funcionalidades indispensaveis do ambiente.',
]

export function CookiesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const isPreferencesOpen = searchParams.get('preferences') === '1'

  const sections = useMemo(() => ([
    {
      title: 'Regras gerais',
      paragraphs: cookieTopics,
    },
  ]), [])

  function handleClosePreferences() {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('preferences')
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <>
      <PublicGenericPage
        entryPrefix="global.institutional.cookies"
        eyebrow="Cookies"
        title="Uso de Cookies"
        description="Esta pagina explica, de forma objetiva, como a GenFlix pode utilizar cookies e tecnologias semelhantes para autenticacao, seguranca, desempenho e funcionamento do servico."
        backgroundClassName="bg-white"
        sections={sections}
        cta={{
          label: 'Gerenciar preferencias',
          href: '/cookies?preferences=1',
          isInternal: true,
        }}
      />

      <GenflixCookiePreferencesModal
        isOpen={isPreferencesOpen}
        onClose={handleClosePreferences}
      />
    </>
  )
}

