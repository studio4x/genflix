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
      'A GenFlix ? uma plataforma educacional digital dedicada ? oferta de cursos, trilhas, materiais de apoio e recursos interativos para estudo e desenvolvimento profissional.',
      'Ao acessar, navegar, criar conta, contratar cursos ou utilizar qualquer funcionalidade da plataforma, o usuario declara que leu, compreendeu e aceitou estes Termos de Uso.',
      'Se o usuário não concordar com este documento, não deve utilizar a plataforma.',
    ],
  },
  {
    title: '2. Natureza do serviço',
    items: [
      'A GenFlix oferece acesso a conteúdos educacionais, experiências de estudo, avaliações, materiais complementares e recursos digitais vinculados à aprendizagem.',
      'A contrata??o de cursos, assinaturas e produtos digitais ocorre nos termos apresentados na pr?pria plataforma, podendo haver ofertas avulsas, planos recorrentes ou acesso por campanhas promocionais.',
      'O uso da plataforma não cria vínculo empregatício, societário, de representação ou exclusividade entre a GenFlix e seus usuários.',
    ],
  },
  {
    title: '3. Conta, acesso e responsabilidade do usuario',
    items: [
      'O usu?rio ? respons?vel por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.',
      'As informações fornecidas no cadastro devem ser verdadeiras, atualizadas e completas.',
      'A GenFlix pode restringir, suspender ou cancelar contas que violem estes Termos, a legislação aplicável ou a segurança da plataforma.',
    ],
  },
  {
    title: '4. Conteúdo, licenças e uso permitido',
    items: [
      'Todo conteúdo disponibilizado na GenFlix, incluindo aulas, vídeos, textos, áudios, quizzes, materiais em PDF e demais recursos, é protegido por direitos autorais e de propriedade intelectual.',
      'O acesso concedido ao usuario e pessoal, limitado e intransferivel, salvo disposicao expressa em contrario.',
      'É proibido copiar, distribuir, gravar, republicar, revender, compartilhar credenciais ou explorar comercialmente qualquer conteúdo da plataforma sem autorização prévia e por escrito.',
    ],
  },
  {
    title: '5. Assinaturas, pagamentos e reembolsos',
    items: [
      'Pagamentos podem ser processados por parceiros especializados e estar?o sujeitos ?s condi??es comerciais informadas na oferta vigente.',
      'Planos recorrentes podem ser renovados automapr?ticamente até o cancelamento, de acordo com as condições apresentadas no momento da contratação.',
      'Pedidos de reembolso observarão a legislação aplicável e a polípr?tica comercial vigente para cada produto ou assinatura.',
    ],
  },
  {
    title: '6. Disponibilidade e alteracoes da plataforma',
    items: [
      'A GenFlix pode atualizar, alterar, descontinuar ou reorganizar funcionalidades, cursos, layouts, planos e pol?pr?ticas internas a qualquer momento.',
      'A plataforma pode passar por manuten??es, indisponibilidades t?cnicas ou ajustes operacionais sem garantia de funcionamento ininterrupto.',
      'Sempre que relevante, mudanças materiais serão refletidas nesta documentação ou nas páginas oficiais do serviço.',
    ],
  },
  {
    title: '7. Limitacao de responsabilidade',
    items: [
      'Na máxima extensão permitida pela legislação, a GenFlix não garante resultado acadêmico, aprovação em processos seletivos, progressão profissional ou performance específica a partir do uso dos conteúdos.',
      'A eventual responsabilidade da plataforma fica limitada aos danos diretos comprovadamente decorrentes de falha própria do serviço digital, excluídos lucros cessantes e danos indiretos.',
      'O usuário é responsável por avaliar se o conteúdo é adequado ao seu contexto de estudo, prápr?tica ou carreira.',
    ],
  },
  {
    title: '8. Privacidade e protecao de dados',
    items: [
      'O tratamento de dados pessoais segue a legislação aplicável, especialmente a LGPD, e está detalhado na Polípr?tica de Privacidade da GenFlix.',
      'Os dados são utilizados para autenpr?ticação, operação da plataforma, melhoria da experiência, segurança, comunicação com o usuário e cumprimento de obrigações legais.',
      'A GenFlix não vende dados pessoais e limita o compartilhamento ao que for necessário para a operação legítima do serviço.',
    ],
  },
  {
    title: '9. Contato e disposicoes finais',
    items: [
      'Estes Termos são regidos pela legislação brasileira.',
      'Sempre que possível, dúvidas e conflitos serão tratados inicialmente pelos canais oficiais de atendimento da GenFlix.',
      'Caso seja necessário, controvérsias serão submetidas ao foro competente na forma da legislação aplicável.',
    ],
  },
]

const privacyTopics = [
  'Os dados pessoais tratados na GenFlix seguem a legislação aplicável, especialmente a LGPD, e são utilizados para autenpr?ticação, matrícula, acesso ao conteúdo, suporte, segurança e melhoria da experiência.',
  'Informações cadastrais, dados de navegação, histórico de progresso, respostas a atividades e interações com o ambiente podem ser usados para operação legítima da plataforma.',
  'A GenFlix não vende dados pessoais. O compartilhamento acontece apenas quando necessário para a operação do serviço, cumprimento legal, prevenção a fraude ou defesa de direitos.',
  'Sempre que aplicável, o usuário poderá exercer seus direitos de acesso, correção, atualização e demais prerrogativas previstas em lei pelos canais oficiais da plataforma.',
]

function TermsDocumentContent() {
  return (
    <>
      <section className="rounded-3xl border border-[#BEE3EA] bg-[#F2F7F9] p-5">
        <h2 className="text-sm font-black uppercase tracking-[0.24em] text-[#1398B7]">
          Aviso importante
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#0A3640]">
          Ao continuar usando a GenFlix, você concorda com estas regras e reconhece
          que o acesso ao conteúdo é pessoal, sujeito às polípr?ticas comerciais e à
          legislação aplicável.
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
    summary: 'Este documento apresenta as regras de uso da GenFlix, os direitos e deveres dos usu?rios e os limites de responsabilidade aplic?veis ao ambiente digital da plataforma.',
    updatedAt: '10/04/2026',
    content: <TermsDocumentContent />,
  },
  privacy: {
    eyebrow: 'Privacidade',
    title: 'Privacidade e Protecao de Dados',
    summary: 'Esta página resume como a GenFlix coleta, utiliza, protege e trata dados pessoais no contexto do acesso à plataforma, aos cursos e aos recursos educacionais.',
    updatedAt: '10/04/2026',
    content: <PrivacyDocumentContent />,
  },
}
