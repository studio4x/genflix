import { PublicLegalPageShell } from '@/pages/public/public-legal-page-shell'

const sections = [
  {
    title: '1. Aceite e finalidade da plataforma',
    items: [
      'A HomeCare Match é uma plataforma tecnológica que conecta profissionais da saúde, empresas de home care e famílias interessadas em atendimento domiciliar.',
      'Ao acessar, navegar, criar cadastro ou contratar qualquer funcionalidade da plataforma, o usuário declara que leu, compreendeu e aceitou estes Termos de Uso e Risco Legal.',
      'Se o usuário não concordar com este documento, não deve utilizar a plataforma.',
    ],
  },
  {
    title: '2. Natureza do serviço e ausência de vínculo',
    items: [
      'A HomeCare Match atua exclusivamente como ponte tecnológica para aproximação entre oferta e demanda de serviços.',
      'A plataforma não é agência de empregos, não realiza recrutamento sob encomenda, não gerencia escalas, não supervisiona atendimentos, não assina contratos de trabalho e não intermedeia o pagamento do cuidado.',
      'A HomeCare Match não cobra taxa de agenciamento nem percentual sobre o valor negociado entre contratante e profissional.',
      'Toda negociação sobre preço, agenda, escopo, local, duração, substituições, cancelamentos e forma de pagamento acontece diretamente entre família ou empresa contratante e o profissional escolhido.',
      'O uso da plataforma não cria qualquer relação societária, empregatícia, de subordinação, representação, preposição, parceria operacional ou exclusividade entre a HomeCare Match e os usuários.',
    ],
  },
  {
    title: '3. Contratação e responsabilidade pela escolha',
    items: [
      'A decisão de contratar um profissional é de risco exclusivo da família ou da empresa contratante.',
      'A HomeCare Match não participa da entrevista final, não valida compatibilidade pessoal, não garante disponibilidade futura nem promete resultado clínico, assistencial ou comportamental.',
      'Antes da contratação, recomendamos que a família ou empresa realize entrevista própria, confirme experiência prática, solicite referências, valide documentos complementares e alinhe por escrito as condições do atendimento.',
    ],
  },
  {
    title: '4. Selo de verificação e confiança',
    items: [
      'Quando exibido, o Selo de Verificação indica apenas que a HomeCare Match conferiu documentos cadastrais e de identificação apresentados pelo usuário, incluindo, quando aplicável, registro profissional como COREN, CREFITO ou equivalente.',
      'Esse selo não representa garantia de conduta futura, qualidade técnica, idoneidade absoluta, experiência prática, aptidão comportamental ou adequação ao caso concreto.',
      'Mesmo em perfis verificados, a contratação deve ser precedida de avaliação própria pela família ou empresa.',
    ],
  },
  {
    title: '5. Limite de responsabilidade e risco legal',
    items: [
      'A HomeCare Match não responde civil ou criminalmente por acidentes, omissões, negligência, imprudência, imperícia, violência, danos materiais, furtos, extravios, condutas antiéticas, descumprimentos contratuais ou quaisquer fatos ocorridos no domicílio ou no contexto da prestação do serviço.',
      'A HomeCare Match também não responde por conflitos trabalhistas, pedidos de reconhecimento de vínculo, horas extras, verbas rescisórias, encargos, acidentes de trabalho, substituições ou faltas do profissional contratado.',
      'A responsabilidade pela formalização contratual, verificação de antecedentes, ambiente seguro de atendimento e cumprimento das obrigações legais entre as partes é exclusivamente dos usuários que contratam entre si.',
      'Na máxima extensão permitida pela legislação aplicável, eventual responsabilidade da HomeCare Match fica limitada aos danos diretos comprovadamente causados por falha própria da plataforma digital, excluídos lucros cessantes, danos morais indiretos e fatos decorrentes da prestação presencial do cuidado.',
    ],
  },
  {
    title: '6. Planos, cursos, renovação e reembolso',
    items: [
      'Profissionais de saúde podem contratar assinaturas premium mensais ou anuais para obter visibilidade, acesso a funcionalidades exclusivas e recursos educacionais, incluindo a Academy.',
      'A cobrança das assinaturas é processada por parceiro de pagamento, atualmente o Asaas, com renovação automática até cancelamento pelo próprio usuário ou até encerramento regular do plano.',
      'Cursos e treinamentos podem ser oferecidos também em compras avulsas, conforme disponibilidade na plataforma.',
      'O reembolso ou estorno é garantido quando solicitado em até 7 dias contados da confirmação do pagamento, nos termos do Código de Defesa do Consumidor, desde que o pedido seja realizado pelos canais oficiais de atendimento da plataforma.',
      'Após esse prazo, pedidos de devolução serão analisados conforme a natureza do produto adquirido, o histórico de uso e a legislação aplicável.',
    ],
  },
  {
    title: '7. Regras de conduta, denúncias e banimento',
    items: [
      'Os usuários devem agir com boa-fé, urbanidade, veracidade das informações, respeito à privacidade e observância das normas profissionais aplicáveis.',
      'É proibido cadastrar informações falsas, usar documentos de terceiros, praticar assédio, discriminação, fraude, ameaça, extorsão, divulgação indevida de dados pessoais ou qualquer conduta ilícita.',
      'A HomeCare Match mantém canais de denúncia e suporte para recebimento de relatos sobre comportamentos inadequados, suspeitos ou ilegais.',
      'A plataforma poderá suspender, restringir, remover conteúdos, bloquear acessos ou banir definitivamente usuários que violem estes Termos, a legislação ou a segurança do ecossistema.',
      'Em casos graves com indícios de crime ou risco relevante a terceiros, os registros e relatos recebidos no suporte poderão ser encaminhados às autoridades competentes, sempre que juridicamente cabível.',
    ],
  },
  {
    title: '8. Privacidade, LGPD e documentos sensíveis',
    items: [
      'O tratamento de dados pessoais, dados sensíveis e documentos enviados à HomeCare Match segue a Política de Privacidade da plataforma e a legislação aplicável, especialmente a LGPD.',
      'Os dados não são vendidos. O compartilhamento interno e externo ocorre apenas quando necessário para operação da plataforma, cumprimento legal, prevenção à fraude, defesa de direitos ou mediante base legal válida.',
      'O WhatsApp e outras informações de contato sensíveis podem ser exibidos apenas a usuários logados e efetivamente interessados, conforme as regras internas da plataforma.',
    ],
  },
  {
    title: '9. Disponibilidade da plataforma e atualizações',
    items: [
      'A HomeCare Match pode alterar funcionalidades, requisitos de acesso, planos, layout, critérios de verificação, políticas internas e estes Termos a qualquer momento, mediante publicação da versão atualizada na plataforma.',
      'A continuidade de uso após a atualização será interpretada como ciência da nova versão, respeitados os direitos do usuário previstos em lei.',
      'A plataforma pode sofrer indisponibilidades, manutenções ou falhas técnicas sem que isso gere garantia de continuidade ininterrupta do serviço.',
    ],
  },
  {
    title: '10. Foro e disposições finais',
    items: [
      'Estes Termos devem ser interpretados de acordo com a legislação brasileira.',
      'Sempre que possível, controvérsias serão tratadas inicialmente pelos canais de atendimento da HomeCare Match, com tentativa de solução administrativa.',
      'Sem prejuízo das regras legais de competência, fica eleito o foro permitido pela legislação brasileira aplicável para discutir eventuais disputas relacionadas ao uso da plataforma.',
    ],
  },
]

export function TermsOfUsePage() {
  return (
    <PublicLegalPageShell
      eyebrow="Termos e Risco Legal"
      title="Termos de Uso da HomeCare Match"
      summary="Este documento estabelece as regras de uso da plataforma, define os limites de responsabilidade da HomeCare Match e explica como funciona a conexão entre profissionais, empresas de home care e famílias."
      updatedAt="26/03/2026"
    >
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-black uppercase tracking-[0.24em] text-amber-700">
          Aviso importante
        </h2>
        <p className="mt-3 text-sm leading-6 text-amber-900">
          A HomeCare Match não executa o atendimento domiciliar. A contratação do
          cuidado ocorre diretamente entre contratante e profissional, por conta e
          risco das partes envolvidas.
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
