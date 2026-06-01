import type { ReactNode } from 'react'

export type LegalDocumentKey = 'terms' | 'privacy'

type LegalSection = {
  title: string
  items: string[]
}

type LegalDocumentConfig = {
  eyebrow: string
  title: string
  summary: string
  updatedAt: string
  content: ReactNode
}

const termsSections: LegalSection[] = [
  {
    title: '1. Aceite e finalidade da plataforma',
    items: [
      'A GenFlix e uma plataforma educacional digital dedicada a oferta de cursos, trilhas, materiais de apoio e recursos interativos para estudo e desenvolvimento profissional.',
      'Ao acessar, navegar, criar conta, contratar cursos ou utilizar qualquer funcionalidade da plataforma, o usuario declara que leu, compreendeu e aceitou estes Termos de Uso.',
      'Se o usuario n?o concordar com este documento, n?o deve utilizar a plataforma.',
    ],
  },
  {
    title: '2. Natureza do servi?o',
    items: [
      'A GenFlix oferece acesso a conte?dos educacionais, experiencias de estudo, avalia??es, materiais complementares e recursos digitais vinculados a aprendizagem.',
      'A contratacao de cursos, assinaturas e produtos digitais ocorre nos termos apresentados na propria plataforma, podendo haver ofertas avulsas, planos recorrentes ou acesso por campanhas promocionais.',
      'O uso da plataforma n?o cria vinculo empregaticio, societario, de representacao ou exclusividade entre a GenFlix e seus usuarios.',
    ],
  },
  {
    title: '3. Conta, acesso e responsabilidade do usuario',
    items: [
      'O usuario e responsavel por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.',
      'As informacoes fornecidas no cadastro devem ser verdadeiras, atualizadas e completas.',
      'A GenFlix pode restringir, suspender ou cancelar contas que violem estes Termos, a legisla??o aplicavel ou a seguranca da plataforma.',
    ],
  },
  {
    title: '4. Conte?do, licencas e uso permitido',
    items: [
      'Todo conte?do disponibilizado na GenFlix, incluindo aulas, videos, textos, audios, quizzes, materiais em PDF e demais recursos, e protegido por direitos autorais e de propriedade intelectual.',
      'O acesso concedido ao usuario e pessoal, limitado e intransferivel, salvo disposicao expressa em contrario.',
      'E proibido copiar, distribuir, gravar, republicar, revender, compartilhar credenciais ou explorar comercialmente qualquer conte?do da plataforma sem autorizacao previa e por escrito.',
    ],
  },
  {
    title: '5. Assinaturas, pagamentos e reembolsos',
    items: [
      'Pagamentos podem ser processados por parceiros especializados e estarao sujeitos as condicoes comerciais informadas na oferta vigente.',
      'Planos recorrentes podem ser renovados automaticamente ate cancelamento, de acordo com as condicoes apresentadas no momento da contratacao.',
      'Pedidos de reembolso observarao a legisla??o aplicavel e a pol?tica comercial vigente para cada produto ou assinatura.',
    ],
  },
  {
    title: '6. Disponibilidade e alteracoes da plataforma',
    items: [
      'A GenFlix pode atualizar, alterar, descontinuar ou reorganizar funcionalidades, cursos, layouts, planos e politicas internas a qualquer momento.',
      'A plataforma pode passar por manutencoes, indisponibilidades tecnicas ou ajustes operacionais sem garantia de funcionamento ininterrupto.',
      'Sempre que relevante, mudancas materiais serao refletidas nesta documentacao ou nas p?ginas oficiais do servi?o.',
    ],
  },
  {
    title: '7. Limitacao de responsabilidade',
    items: [
      'Na maxima extensao permitida pela legisla??o, a GenFlix n?o garante resultado academico, aprovacao em processos seletivos, progressao profissional ou performance especifica a partir do uso dos conte?dos.',
      'A eventual responsabilidade da plataforma fica limitada aos danos diretos comprovadamente decorrentes de falha propria do servi?o digital, excluidos lucros cessantes e danos indiretos.',
      'O usuario e responsavel por avaliar se o conte?do e adequado ao seu contexto de estudo, pratica ou carreira.',
    ],
  },
  {
    title: '8. Privacidade e protecao de dados',
    items: [
      'O tratamento de dados pessoais segue a legisla??o aplicavel, especialmente a LGPD, e esta detalhado na Pol?tica de Privacidade da GenFlix.',
      'Os dados sao utilizados para autenticacao, operacao da plataforma, melhoria da experi?ncia, seguranca, comunicacao com o usuario e cumprimento de obrigacoes legais.',
      'A GenFlix n?o vende dados pessoais e limita o compartilhamento ao que for necessario para a operacao legitima do servi?o.',
    ],
  },
  {
    title: '9. Contato e disposicoes finais',
    items: [
      'Estes Termos sao regidos pela legisla??o brasileira.',
      'Sempre que possivel, duvidas e conflitos serao tratados inicialmente pelos canais oficiais de atendimento da GenFlix.',
      'Caso seja necessario, controversias serao submetidas ao foro competente na forma da legisla??o aplicavel.',
    ],
  },
]

const privacyTopics = [
  'Os dados pessoais tratados na GenFlix seguem a legisla??o aplicavel, especialmente a LGPD, e sao utilizados para autenticacao, matr?cula, acesso ao conte?do, suporte, seguranca e melhoria da experi?ncia.',
  'Informacoes cadastrais, dados de navega??o, hist?rico de progresso, respostas a atividades e interacoes com o ambiente podem ser usados para operacao legitima da plataforma.',
  'A GenFlix n?o vende dados pessoais. O compartilhamento acontece apenas quando necessario para a operacao do servi?o, cumprimento legal, prevencao a fraude ou defesa de direitos.',
  'Sempre que aplicavel, o usuario podera exercer seus direitos de acesso, correcao, atualizacao e demais prerrogativas previstas em lei pelos canais oficiais da plataforma.',
]

function TermsDocumentContent() {
  return (
    <>
      <section className="rounded-3xl border border-[#BEE3EA] bg-[#F2F7F9] p-5">
        <h2 className="text-sm font-black uppercase tracking-[0.24em] text-[#1398B7]">
          Aviso importante
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#0A3640]">
          Ao continuar usando a GenFlix, voce concorda com estas regras e reconhece
          que o acesso ao conteudo e pessoal, sujeito as politicas comerciais e a
          legislacao aplicavel.
        </p>
      </section>

      {termsSections.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-xl font-black tracking-tight text-[#183139]">
            {section.title}
          </h2>
          <ul className="space-y-3">
            {section.items.map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3 text-sm leading-6 text-[#56696f]"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

function PrivacyDocumentContent() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-black tracking-tight text-[#183139]">
        Como tratamos seus dados
      </h2>
      <ul className="space-y-3">
        {privacyTopics.map((topic) => (
          <li
            key={topic}
            className="rounded-2xl border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3 text-sm leading-6 text-[#56696f]"
          >
            {topic}
          </li>
        ))}
      </ul>
    </section>
  )
}

export const legalDocuments: Record<LegalDocumentKey, LegalDocumentConfig> = {
  terms: {
    eyebrow: 'Termos de Uso',
    title: 'Termos de Uso da GenFlix',
    summary: 'Este documento apresenta as regras de uso da GenFlix, os direitos e deveres dos usuarios e os limites de responsabilidade aplicaveis ao ambiente digital da plataforma.',
    updatedAt: '10/04/2026',
    content: <TermsDocumentContent />,
  },
  privacy: {
    eyebrow: 'Privacidade',
    title: 'Privacidade e Protecao de Dados',
    summary: 'Esta p?gina resume como a GenFlix coleta, utiliza, protege e trata dados pessoais no contexto do acesso a plataforma, aos cursos e aos recursos educacionais.',
    updatedAt: '10/04/2026',
    content: <PrivacyDocumentContent />,
  },
}
