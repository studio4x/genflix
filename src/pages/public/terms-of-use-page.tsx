import { PublicLegalPageShell } from '@/pages/public/public-legal-page-shell'

const sections = [
  {
    title: '1. Aceite e finalidade da plataforma',
    items: [
      'A HomeCare Match e uma plataforma tecnologica que conecta profissionais da saude, empresas de home care e familias interessadas em atendimento domiciliar.',
      'Ao acessar, navegar, criar cadastro ou contratar qualquer funcionalidade da plataforma, o usuario declara que leu, compreendeu e aceitou estes Termos de Uso e Risco Legal.',
      'Se o usuario nao concordar com este documento, nao deve utilizar a plataforma.',
    ],
  },
  {
    title: '2. Natureza do servico e ausencia de vinculo',
    items: [
      'A HomeCare Match atua exclusivamente como ponte tecnologica para aproximacao entre oferta e demanda de servicos.',
      'A plataforma nao e agencia de empregos, nao realiza recrutamento sob encomenda, nao gerencia escalas, nao supervisiona atendimentos, nao assina contratos de trabalho e nao intermedeia o pagamento do cuidado.',
      'A HomeCare Match nao cobra taxa de agenciamento nem percentual sobre o valor negociado entre contratante e profissional.',
      'Toda negociacao sobre preco, agenda, escopo, local, duracao, substituicoes, cancelamentos e forma de pagamento acontece diretamente entre familia ou empresa contratante e o profissional escolhido.',
      'O uso da plataforma nao cria qualquer relacao societaria, empregaticia, de subordinacao, representacao, preposicao, parceria operacional ou exclusividade entre a HomeCare Match e os usuarios.',
    ],
  },
  {
    title: '3. Contratacao e responsabilidade pela escolha',
    items: [
      'A decisao de contratar um profissional e de risco exclusivo da familia ou da empresa contratante.',
      'A HomeCare Match nao participa da entrevista final, nao valida compatibilidade pessoal, nao garante disponibilidade futura nem promete resultado clinico, assistencial ou comportamental.',
      'Antes da contratacao, recomendamos que a familia ou empresa realize entrevista propria, confirme experiencia pratica, solicite referencias, valide documentos complementares e alinhe por escrito as condicoes do atendimento.',
    ],
  },
  {
    title: '4. Selo de verificacao e confianca',
    items: [
      'Quando exibido, o Selo de Verificacao indica apenas que a HomeCare Match conferiu documentos cadastrais e de identificacao apresentados pelo usuario, incluindo, quando aplicavel, registro profissional como COREN, CREFITO ou equivalente.',
      'Esse selo nao representa garantia de conduta futura, qualidade tecnica, idoneidade absoluta, experiencia pratica, aptidao comportamental ou adequacao ao caso concreto.',
      'Mesmo em perfis verificados, a contratacao deve ser precedida de avaliacao propria pela familia ou empresa.',
    ],
  },
  {
    title: '5. Limite de responsabilidade e risco legal',
    items: [
      'A HomeCare Match nao responde civil ou criminalmente por acidentes, omissoes, negligencia, imprudencia, impericia, violencia, danos materiais, furtos, extravios, condutas anti eticas, descumprimentos contratuais ou quaisquer fatos ocorridos no domicilio ou no contexto da prestacao do servico.',
      'A HomeCare Match tambem nao responde por conflitos trabalhistas, pedidos de reconhecimento de vinculo, horas extras, verbas rescisorias, encargos, acidentes de trabalho, substituicoes ou faltas do profissional contratado.',
      'A responsabilidade pela formalizacao contratual, verificacao de antecedentes, ambiente seguro de atendimento e cumprimento das obrigacoes legais entre as partes e exclusivamente dos usuarios que contratam entre si.',
      'Na maxima extensao permitida pela legislacao aplicavel, eventual responsabilidade da HomeCare Match fica limitada aos danos diretos comprovadamente causados por falha propria da plataforma digital, excluidos lucros cessantes, danos morais indiretos e fatos decorrentes da prestacao presencial do cuidado.',
    ],
  },
  {
    title: '6. Planos, cursos, renovacao e reembolso',
    items: [
      'Profissionais de saude podem contratar assinaturas premium mensais ou anuais para obter visibilidade, acesso a funcionalidades exclusivas e recursos educacionais, incluindo a Academy.',
      'A cobranca das assinaturas e processada por parceiro de pagamento, atualmente o Asaas, com renovacao automatica ate cancelamento pelo proprio usuario ou ate encerramento regular do plano.',
      'Cursos e treinamentos podem ser oferecidos tambem em compras avulsas, conforme disponibilidade na plataforma.',
      'O reembolso ou estorno e garantido quando solicitado em ate 7 dias contados da confirmacao do pagamento, nos termos do Codigo de Defesa do Consumidor, desde que o pedido seja realizado pelos canais oficiais de atendimento da plataforma.',
      'Apos esse prazo, pedidos de devolucao serao analisados conforme a natureza do produto adquirido, o historico de uso e a legislacao aplicavel.',
    ],
  },
  {
    title: '7. Regras de conduta, denuncias e banimento',
    items: [
      'Os usuarios devem agir com boa-fe, urbanidade, veracidade das informacoes, respeito a privacidade e observancia das normas profissionais aplicaveis.',
      'E proibido cadastrar informacoes falsas, usar documentos de terceiros, praticar assedio, discriminacao, fraude, ameaca, extorsao, divulgacao indevida de dados pessoais ou qualquer conduta ilicita.',
      'A HomeCare Match mantem canais de denuncia e suporte para recebimento de relatos sobre comportamentos inadequados, suspeitos ou ilegais.',
      'A plataforma podera suspender, restringir, remover conteudos, bloquear acessos ou banir definitivamente usuarios que violem estes Termos, a legislacao ou a seguranca do ecossistema.',
      'Em casos graves com indicios de crime ou risco relevante a terceiros, os registros e relatos recebidos no suporte poderao ser encaminhados as autoridades competentes, sempre que juridicamente cabivel.',
    ],
  },
  {
    title: '8. Privacidade, LGPD e documentos sensiveis',
    items: [
      'O tratamento de dados pessoais, dados sensiveis e documentos enviados a HomeCare Match segue a Politica de Privacidade da plataforma e a legislacao aplicavel, especialmente a LGPD.',
      'Os dados nao sao vendidos. O compartilhamento interno e externo ocorre apenas quando necessario para operacao da plataforma, cumprimento legal, prevencao a fraude, defesa de direitos ou mediante base legal valida.',
      'O WhatsApp e outras informacoes de contato sensiveis podem ser exibidos apenas a usuarios logados e efetivamente interessados, conforme as regras internas da plataforma.',
    ],
  },
  {
    title: '9. Disponibilidade da plataforma e atualizacoes',
    items: [
      'A HomeCare Match pode alterar funcionalidades, requisitos de acesso, planos, layout, criterios de verificacao, politicas internas e estes Termos a qualquer momento, mediante publicacao da versao atualizada na plataforma.',
      'A continuidade de uso apos a atualizacao sera interpretada como ciencia da nova versao, respeitados os direitos do usuario previstos em lei.',
      'A plataforma pode sofrer indisponibilidades, manutencoes ou falhas tecnicas sem que isso gere garantia de continuidade ininterrupta do servico.',
    ],
  },
  {
    title: '10. Foro e disposicoes finais',
    items: [
      'Estes Termos devem ser interpretados de acordo com a legislacao brasileira.',
      'Sempre que possivel, controversias serao tratadas inicialmente pelos canais de atendimento da HomeCare Match, com tentativa de solucao administrativa.',
      'Sem prejuizo das regras legais de competencia, fica eleito o foro permitido pela legislacao brasileira aplicavel para discutir eventuais disputas relacionadas ao uso da plataforma.',
    ],
  },
]

export function TermsOfUsePage() {
  return (
    <PublicLegalPageShell
      eyebrow="Termos e Risco Legal"
      title="Termos de Uso da HomeCare Match"
      summary="Este documento estabelece as regras de uso da plataforma, define os limites de responsabilidade da HomeCare Match e explica como funciona a conexao entre profissionais, empresas de home care e familias."
      updatedAt="26/03/2026"
    >
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-black uppercase tracking-[0.24em] text-amber-700">
          Aviso importante
        </h2>
        <p className="mt-3 text-sm leading-6 text-amber-900">
          A HomeCare Match nao executa o atendimento domiciliar. A contratacao do
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
