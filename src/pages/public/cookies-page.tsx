import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GenflixCookiePreferencesModal } from '@/components/public/genflix-cookie-preferences-modal';
import { PublicGenericPage } from '@/components/public/public-generic-page';
const cookieTopics = [
    "A GenFlix pode utilizar cookies e tecnologias semelhantes para autenticação, manutenção de sessão, segurança, funcionamento técnico da plataforma e personalização básica da experiência.",
    "Também podem ser usados recursos de medição e desempenho para entender estabilidade, identificar falhas e melhorar a navegação, sempre conforme a base legal aplicável.",
    "Quando houver cookies não essenciais sujeitos a consentimento, o tratamento seguirá as configurações e controles disponibilizados pela plataforma.",
    "A desativação de cookies essenciais pode comprometer login, navegação, reprodução de conteúdo e outras funcionalidades indispensáveis do ambiente.",
];
export function CookiesPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const isPreferencesOpen = searchParams.get('preferences') === '1';
    const sections = useMemo(() => ([
        {
            title: 'Regras gerais',
            paragraphs: cookieTopics,
        },
    ]), []);
    function handleClosePreferences() {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('preferences');
        setSearchParams(nextParams, { replace: true });
    }
    return (<>
      <PublicGenericPage entryPrefix="global.institutional.cookies" eyebrow="Cookies" title="Uso de Cookies" description="Esta página explica, de forma objetiva, como a GenFlix pode utilizar cookies e tecnologias semelhantes para autenticação, segurança, desempenho e funcionamento do serviço." backgroundClassName="bg-white" sections={sections} cta={{
            label: 'Gerenciar preferências',
            href: "/cookies?preferences=1",
            isInternal: true,
        }}/>

      <GenflixCookiePreferencesModal isOpen={isPreferencesOpen} onClose={handleClosePreferences}/>
    </>);
}
