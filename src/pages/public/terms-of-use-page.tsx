import { PublicLegalPageShell } from '@/pages/public/public-legal-page-shell'

const sections = [
  {
    title: '1. Aceite e finalidade da plataforma',
    items: [
      'A GenFlix é uma plataforma tecnológica de cursos e treinamento voltada à capacitação de profissionais e à distribuição de conteúdo digital.',
      'Ao acessar, navegar, criar cadastro ou contratar qualquer funcionalidade da plataforma, o usuário declara que leu, compreendeu e aceitou estes Termos de Uso e Risco Legal.',
      'Se o usuário não concordar com este documento, não deve utilizar a plataforma.',
    ],
  },
  {
    title: '2. Natureza do serviço e ausência de vínculo',
    items: [
      'A GenFlix atua exclusivamente como ambiente digital de aprendizado e comercialização de cursos.',
      'A plataforma não é agência de empregos, não realiza recrutamento sob encomenda, não gerencia escalas, não supervisiona atendimentos nem intermedeia relações de trabalho presenciais.',
      'A GenFlix não cobra taxa de agenciamento nem percentual sobre o valor negociado fora do checkout de seus próprios produtos digitais.',
      'Toda negociação sobre acesso, conteúdo, duração, cancelamentos e forma de pagamento acontece diretamente entre o usuário e a plataforma, conforme as regras exibidas no checkout.',
      'O uso da plataforma não cria qualquer relação societária, empregatícia, de subordinação, representação, preposição, parceria operacional ou exclusividade entre a GenFlix e os usuários.',
    ],
  },
  {
    title: '3. Contratação e responsabilidade pela escolha',
    items: [
      'A decisão de contratar um profissional é de risco exclusivo da família ou da empresa contratante.',
      'A GenFlix não participa de decisões externas ao seu ambiente digital, não garante resultado profissional futuro nem promete benefício específico fora do escopo do conteúdo adquirido.',
      'Antes da contratação ou aquisição de qualquer curso, recomendamos que o usuário leia atentamente a descrição, o escopo e as condições comerciais exibidas na plataforma.',
    ],
  },
  {
    title: '4. Selo de verificação e confiança',
    items: [
      'Quando exibido, o selo de verificação indica apenas que a GenFlix conferiu documentos cadastrais e de identificação apresentados pelo usuário, quando aplicável.',
      'Esse selo não representa garantia de conduta futura, qualidade técnica, idoneidade absoluta, experiência prática, aptidão comportamental ou adequação ao caso concreto.',
      'Mesmo em perfis verificados, a contratação ou matrícula deve ser precedida de avaliação própria pelo usuário.',
    ],
  },
  {
    title: '5. Limite de responsabilidade e risco legal',
    items: [
      'A GenFlix não responde civil ou criminalmente por acidentes, omissões, negligência, imprudência, imperícia, violência, danos materiais, furtos, extravios, condutas antiéticas, descumprimentos contratuais ou quaisquer fatos ocorridos fora do ambiente digital da plataforma.',
      'A responsabilidade pela formalização contratual, verificação de antecedentes, ambiente seguro de atendimento e cumprimento das obrigações legais entre as partes é exclusivamente dos usuários que contratam entre si, quando aplicável.',
      'Na máxima extensão permitida pela legislação aplicável, eventual responsabilidade da GenFlix fica limitada aos danos diretos comprovadamente causados por falha própria da plataforma digital, excluídos lucros cessantes, danos morais indiretos e fatos decorrentes de terceiros.',
    ],
  },
  {
    title: '6. Planos, cursos, renovação e reembolso',
    items: [
      'Usuários podem contratar assinaturas mensais ou anuais para obter visibilidade, acesso a funcionalidades exclusivas e recursos educacionais da GenFlix.',
      'A cobrança das assinaturas é processada por parceiro de pagamento, atualmente o Asaas, com renovação automática até cancelamento pelo próprio usuário ou até encerramento regular do plano.',
      'Cursos e treinamentos podem ser oferecidos também em compras avulsas, conforme disponibilidade na plataforma.',
      'O reembolso ou estorno é garantido quando solicitado em até 7 dias contados da confirmação do pagamento, nos termos do Código de Defesa do Consumidor, desde que o pedido seja realizado pelos canais oficiais de atendimento da plataforma.',
      'Após esse prazo, pedidos de devolução serão analisados conforme a natureza do produto adquirido, o histórico de uso e a legislação aplicável.',
    ],
  },
  {
    title: '7. Regras de conduta, denúncias e banimento',
    items: [
      'Os usuários devem agir com boa-fé, urbanidade, veracidade das informações, respeito à privacidade e observância das regras aplicáveis da plataforma.',
      'É proibido cadastrar informações falsas, usar documentos de terceiros, praticar assédio, discriminação, fraude, ameaça, extorsão, divulgação indevida de dados pessoais ou qualquer conduta ilícita.',
      'A GenFlix mantém canais de denúncia e suporte para recebimento de relatos sobre comportamentos inadequados, suspeitos ou ilegais.',
      'A plataforma poderá suspender, restringir, remover conteúdos, bloquear acessos ou banir definitivamente usuários que violem estes Termos, a legislação ou a segurança do ecossistema.',
      'Em casos graves com indícios de crime ou risco relevante a terceiros, os registros e relatos recebidos no suporte poderão ser encaminhados às autoridades competentes, sempre que juridicamente cabível.',
    ],
  },
  {
    title: '8. Privacidade, LGPD e documentos sensíveis',
    items: [
      'O tratamento de dados pessoais, dados sensíveis e documentos enviados à GenFlix segue a Política de Privacidade da plataforma e a legislação aplicável, especialmente a LGPD.',
      'Os dados não são vendidos. O compartilhamento interno e externo ocorre apenas quando necessário para operação da plataforma, cumprimento legal, prevenção à fraude, defesa de direitos ou mediante base legal válida.',
      'O WhatsApp e outras informações de contato sensíveis podem ser exibidos apenas a usuários logados e efetivamente interessados, conforme as regras internas da plataforma.',
    ],
  },
  {
    title: '9. Disponibilidade da plataforma e atualizações',
    items: [
      'A GenFlix pode alterar funcionalidades, requisitos de acesso, planos, layout, critérios de verificação, políticas internas e estes Termos a qualquer momento, mediante publicação da versão atualizada na plataforma.',
      'A continuidade de uso após a atualização será interpretada como ciência da nova versão, respeitados os direitos do usuário previstos em lei.',
      'A plataforma pode sofrer indisponibilidades, manutenções ou falhas técnicas sem que isso gere garantia de continuidade ininterrupta do serviço.',
    ],
  },
  {
    title: '10. Foro e disposições finais',
    items: [
      'Estes Termos devem ser interpretados de acordo com a legislação brasileira.',
      'Sempre que possível, controvérsias serão tratadas inicialmente pelos canais de atendimento da GenFlix, com tentativa de solução administrativa.',
      'Sem prejuízo das regras legais de competência, fica eleito o foro permitido pela legislação brasileira aplicável para discutir eventuais disputas relacionadas ao uso da plataforma.',
    ],
  },
]

export function TermsOfUsePage() {
  return (
    <PublicLegalPageShell
      eyebrow="Termos e Risco Legal"
      title="Termos de Uso da GenFlix"
      summary="Este documento estabelece as regras de uso da plataforma, define os limites de responsabilidade da GenFlix e explica como funciona a navegação, compra e acesso aos cursos."
      updatedAt="26/03/2026"
    >
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-black uppercase tracking-[0.24em] text-amber-700">
          Aviso importante
        </h2>
        <p className="mt-3 text-sm leading-6 text-amber-900">
          A GenFlix não executa atendimentos presenciais. A contratação de
          qualquer serviço externo ocorre por conta e risco das partes envolvidas.
        </p>
      </section>

      {sections.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-xl font-black tracking-tight text-slate-900">
            {section.title}
          </h2>
          <ul className="space-y-3">
            {section.items.map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PublicLegalPageShell>
  )
}
