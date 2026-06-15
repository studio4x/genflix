import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sanitizeRichTextHtml } from '@/features/admin/content/content-blocks';

export type AdminTutorialStep = {
  title: string;
  description: string;
};

export type AdminTutorial = {
  id: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  category: string;
  steps: AdminTutorialStep[];
  notes: string[];
};

export type AdminTutorialDraft = Omit<AdminTutorial, 'id'> & {
  id?: string;
};

const ADMIN_TUTORIALS_STORAGE_KEY = 'genflix-admin-tutorials';

const defaultAdminTutorials: AdminTutorial[] = [
  {
    id: 'visao-geral-painel-e-pendencias',
    title: 'Como começar o dia no painel do admin',
    summary: 'Checklist rápido para abrir o painel, entender pendências e priorizar o que precisa de ação imediata.',
    estimatedMinutes: 4,
    category: 'Operação',
    steps: [
      {
        title: 'Abra o dashboard',
        description: 'Entre em <strong>Admin / Início</strong> para ver indicadores, alertas e os atalhos mais usados no dia a dia.',
      },
      {
        title: 'Revise pendências',
        description: 'Acesse <strong>Pendências</strong> para conferir itens que exigem atendimento, revisão de conteúdo ou ajuste operacional.',
      },
      {
        title: 'Cheque notificações',
        description: 'Abra <strong>Notificações</strong> para identificar avisos de suporte, pagamentos, publicação e eventos relevantes.',
      },
      {
        title: 'Organize a prioridade do dia',
        description: 'Comece pelos itens que bloqueiam alunos, pagamentos ou publicação de conteúdo e depois siga para ajustes menores.',
      },
    ],
    notes: [
      'Use esta rotina como ponto de partida antes de entrar em qualquer área do admin.',
      'Se houver volume alto de chamados, trate primeiro o que impacta aluno ou receita.',
    ],
  },
  {
    id: 'como-criar-curso',
    title: 'Como criar um curso',
    summary: 'Passo a passo para cadastrar, organizar e publicar um novo curso no painel admin.',
    estimatedMinutes: 5,
    category: 'Cursos',
    steps: [
      {
        title: 'Abra a área de cursos',
        description: 'No menu lateral do admin, entre em <strong>Catálogo de Cursos</strong> para ver a lista atual e iniciar um novo cadastro.',
      },
      {
        title: 'Crie o curso',
        description: 'Clique em <strong>Criar Curso Agora</strong> e preencha nome, descrição, imagem de capa, preço e status inicial.',
      },
      {
        title: 'Salve para abrir o builder',
        description: 'Depois de salvar o cadastro, o sistema abre o construtor do curso, onde a estrutura é montada.',
      },
      {
        title: 'Monte a trilha',
        description: 'Crie os módulos, depois as aulas de cada módulo e, se necessário, os quizzes ou avaliações.',
      },
      {
        title: 'Ajuste a página pública',
        description: 'Revise a aba da página pública para conferir título, descrição, capa e a chamada principal do curso.',
      },
      {
        title: 'Publique e teste',
        description: 'Quando tudo estiver pronto, publique o curso e abra a versão de aluno para validar a navegação final.',
      },
    ],
    notes: [
      'Se o curso ainda não estiver pronto, deixe como rascunho.',
      'Sempre confira se módulos e aulas estão na ordem certa antes de publicar.',
    ],
  },
  {
    id: 'como-montar-modulos-aulas-e-materiais',
    title: 'Como montar módulos, aulas e materiais',
    summary: 'Organize a estrutura pedagógica do curso com módulos, aulas e anexos para liberar conteúdo com consistência.',
    estimatedMinutes: 6,
    category: 'Builder de curso',
    steps: [
      {
        title: 'Entre no builder do curso',
        description: 'Abra o curso desejado e acesse o <strong>construtor</strong> para editar a estrutura principal.',
      },
      {
        title: 'Crie os módulos',
        description: 'Cadastre os módulos na ordem em que o aluno deve avançar e nomeie cada um com foco no resultado do aprendizado.',
      },
      {
        title: 'Adicione as aulas',
        description: 'Dentro de cada módulo, crie as aulas com títulos objetivos, descrição clara e conteúdo que possa ser consumido em blocos curtos.',
      },
      {
        title: 'Inclua materiais de apoio',
        description: 'Use a área de <strong>Materiais</strong> para anexar PDFs, arquivos de referência, links e conteúdos complementares.',
      },
      {
        title: 'Revise a ordem e a experiência',
        description: 'Confirme a sequência das aulas e verifique se o aluno encontra o material certo no ponto certo da jornada.',
      },
    ],
    notes: [
      'Mantenha títulos consistentes entre módulos e aulas para facilitar a navegação.',
      'Materiais muito longos funcionam melhor quando são divididos em arquivos menores.',
    ],
  },
  {
    id: 'como-configurar-liberacao-de-conteudo',
    title: 'Como configurar liberações de conteúdo',
    summary: 'Ajuste quando e como os alunos recebem acesso aos módulos, aulas e etapas do curso.',
    estimatedMinutes: 5,
    category: 'Cursos',
    steps: [
      {
        title: 'Abra as liberações do curso',
        description: 'No curso desejado, acesse a área de <strong>Liberacoes</strong> para revisar as regras já existentes.',
      },
      {
        title: 'Defina a estratégia',
        description: 'Escolha se o conteúdo será liberado de uma vez, por data, por progresso ou por regra específica da operação.',
      },
      {
        title: 'Aplique a regra no nível correto',
        description: 'Configure a liberação no curso, no módulo ou na aula, dependendo do comportamento esperado para o aluno.',
      },
      {
        title: 'Valide com uma conta de teste',
        description: 'Abra a visão de aluno para confirmar se o conteúdo aparece exatamente quando deveria aparecer.',
      },
    ],
    notes: [
      'Quando houver dúvida, prefira liberar de forma simples e progressiva.',
      'Sempre teste depois de alterar regras de liberação para evitar bloqueios indevidos.',
    ],
  },
  {
    id: 'como-ajustar-pagina-publica-do-curso',
    title: 'Como ajustar a página pública do curso',
    summary: 'Atualize a vitrine do curso com foco em clareza comercial, conversão e consistência visual.',
    estimatedMinutes: 5,
    category: 'Página pública',
    steps: [
      {
        title: 'Abra a página pública do curso',
        description: 'No builder, entre em <strong>Public Page</strong> para editar título, descrição, benefícios e CTA.',
      },
      {
        title: 'Revise os blocos principais',
        description: 'Confirme se a apresentação do curso está alinhada com a proposta, o público e a oferta atual.',
      },
      {
        title: 'Atualize preço e chamada',
        description: 'Verifique o botão principal, a proposta de valor e qualquer informação que impacte a decisão de compra.',
      },
      {
        title: 'Teste a leitura no desktop e no mobile',
        description: 'Valide se a página continua clara, legível e sem quebras de layout nos dois tamanhos mais importantes.',
      },
    ],
    notes: [
      'Mudanças na página pública impactam diretamente a conversão do curso.',
      'Se o texto ficar grande demais, simplifique a mensagem antes de publicar.',
    ],
  },
  {
    id: 'como-usar-avaliacoes-e-quiz',
    title: 'Como usar avaliações e tipos de quiz',
    summary: 'Entenda como estruturar avaliações e configurar tipos de quiz para medir progresso e fixação.',
    estimatedMinutes: 6,
    category: 'Avaliações',
    steps: [
      {
        title: 'Acesse os tipos de quiz',
        description: 'Abra <strong>Tipos de Quiz</strong> para conferir os modelos disponíveis antes de montar uma avaliação.',
      },
      {
        title: 'Escolha o formato certo',
        description: 'Defina se a avaliação será objetiva, prática, final ou contextual, de acordo com o objetivo do curso.',
      },
      {
        title: 'Monte as questões',
        description: 'Organize perguntas e respostas com clareza, evitando enunciados confusos ou opções que gerem dupla interpretação.',
      },
      {
        title: 'Associe ao conteúdo',
        description: 'Vincule a avaliação ao módulo ou aula correta para que o fluxo do aluno siga uma progressão natural.',
      },
      {
        title: 'Teste a experiência',
        description: 'Execute a avaliação como um aluno para verificar pontuação, feedback e comportamento de conclusão.',
      },
    ],
    notes: [
      'Avaliações curtas funcionam melhor quando o objetivo é reforço de conteúdo.',
      'Se o curso for longo, prefira dividir a checagem em etapas menores.',
    ],
  },
  {
    id: 'como-gerenciar-banners',
    title: 'Como gerenciar banners e destaques da home',
    summary: 'Atualize os banners da vitrine principal para comunicar campanhas, lançamentos e chamadas estratégicas.',
    estimatedMinutes: 5,
    category: 'Marketing',
    steps: [
      {
        title: 'Abra a área de banners',
        description: 'Entre em <strong>Banners</strong> para ver os itens ativos, a ordem de exibição e as versões já publicadas.',
      },
      {
        title: 'Crie ou edite um banner',
        description: 'Cadastre nome, imagem, CTA, destino e o contexto em que o banner deve aparecer.',
      },
      {
        title: 'Ajuste texto e hierarquia',
        description: 'Mantenha a mensagem curta, com uma promessa clara e um botão de ação sem excesso de informação.',
      },
      {
        title: 'Reordene os destaques',
        description: 'Arraste os banners para definir qual destaque deve aparecer primeiro na vitrine.',
      },
      {
        title: 'Valide o resultado no site',
        description: 'Abra a home e confira se o banner publicado está coerente com o objetivo da campanha.',
      },
    ],
    notes: [
      'Use banners com objetivo claro para evitar poluição visual.',
      'Se a campanha mudou, remova banners antigos para não gerar ruído.',
    ],
  },
  {
    id: 'como-editar-paginas-institucionais',
    title: 'Como editar páginas institucionais e o site editor',
    summary: 'Ajuste páginas como Sobre, Contato, Ajuda, Termos, Privacidade e outras áreas institucionais.',
    estimatedMinutes: 6,
    category: 'Site',
    steps: [
      {
        title: 'Abra o editor do site',
        description: 'Entre em <strong>Site Editor</strong> para localizar as páginas editáveis e os blocos já configurados.',
      },
      {
        title: 'Escolha a página certa',
        description: 'Selecione a página institucional que precisa de ajuste e revise os blocos de texto, chamadas e estrutura.',
      },
      {
        title: 'Atualize a mensagem',
        description: 'Reescreva trechos que estejam desatualizados, mantendo o tom da marca e a consistência entre páginas.',
      },
      {
        title: 'Revise SEO e links',
        description: 'Confira títulos, descrições, links internos e chamadas para evitar páginas descoordenadas ou quebradas.',
      },
      {
        title: 'Publique a revisão',
        description: 'Salve a alteração e valide a versão pública para confirmar que a página está exibindo o conteúdo novo.',
      },
    ],
    notes: [
      'Páginas institucionais precisam estar sempre coerentes com as políticas vigentes.',
      'Revise links de rodapé quando alterar qualquer página legal ou de ajuda.',
    ],
  },
  {
    id: 'como-criar-artigo-blog',
    title: 'Como criar um novo artigo no blog',
    summary: 'Guia prático para escrever, organizar e publicar um artigo novo na área de blog do admin.',
    estimatedMinutes: 4,
    category: 'Blog',
    steps: [
      {
        title: 'Acesse o blog',
        description: 'No menu do admin, abra a área de <strong>Blog</strong> para ver os artigos já cadastrados e começar um novo conteúdo.',
      },
      {
        title: 'Crie um novo artigo',
        description: 'Clique em <strong>Novo artigo</strong> para abrir o formulário de criação e preparar o conteúdo do post.',
      },
      {
        title: 'Preencha os dados principais',
        description: 'Informe título, resumo, categoria, imagem de capa e o slug do artigo para manter a organização do blog.',
      },
      {
        title: 'Escreva o conteúdo',
        description: 'Monte o texto em blocos curtos, revise os títulos e inclua links, imagens ou destaques quando fizer sentido.',
      },
      {
        title: 'Revise SEO e publicação',
        description: 'Confira a prévia, ajuste meta descrição se existir e publique ou salve como rascunho para revisar depois.',
      },
    ],
    notes: [
      'Use títulos curtos e claros para facilitar a leitura.',
      'Sempre revise o texto antes de publicar para evitar erros de acentuação ou formatação.',
    ],
  },
  {
    id: 'como-moderar-reviews',
    title: 'Como moderar avaliações, comentários e reviews',
    summary: 'Centralize a revisão de feedbacks para manter qualidade editorial e resposta rápida ao aluno.',
    estimatedMinutes: 5,
    category: 'Comunidade',
    steps: [
      {
        title: 'Abra a área de reviews',
        description: 'Entre em <strong>Reviews</strong> para ver os itens pendentes, aprovados ou com necessidade de ajuste.',
      },
      {
        title: 'Leia o contexto completo',
        description: 'Antes de aprovar ou rejeitar, verifique a mensagem, o curso relacionado e qualquer resposta anterior.',
      },
      {
        title: 'Aprove ou modere com critério',
        description: 'Mantenha apenas avaliações úteis, respeitosas e coerentes com a experiência real da plataforma.',
      },
      {
        title: 'Responda quando necessário',
        description: 'Se houver dúvida, publique uma resposta curta e objetiva para orientar o usuário ou a equipe interna.',
      },
    ],
    notes: [
      'Moderação consistente evita ruído em áreas públicas.',
      'Quando houver conteúdo sensível, siga o mesmo critério para todos os casos semelhantes.',
    ],
  },
  {
    id: 'como-organizar-usuarios-e-grupos',
    title: 'Como organizar usuários, alunos e grupos',
    summary: 'Padronize o cadastro e o agrupamento de pessoas para facilitar suporte, liberações e comunicação.',
    estimatedMinutes: 5,
    category: 'Usuários',
    steps: [
      {
        title: 'Abra a lista de usuários',
        description: 'Entre em <strong>Usuários</strong> para localizar perfis, revisar acessos e entender a distribuição atual.',
      },
      {
        title: 'Revise dados do perfil',
        description: 'Verifique nome, e-mail, função e status antes de alterar qualquer informação sensível.',
      },
      {
        title: 'Use grupos quando fizer sentido',
        description: 'Agrupe usuários por turma, operação, plano ou contexto de suporte para facilitar tarefas recorrentes.',
      },
      {
        title: 'Atualize acesso com cuidado',
        description: 'Ajuste papéis e permissões apenas quando houver necessidade clara e confirme o impacto no restante da plataforma.',
      },
    ],
    notes: [
      'Mudanças de acesso devem ser revisadas com atenção para evitar bloqueios.',
      'Agrupamentos bem feitos aceleram suporte e comunicação interna.',
    ],
  },
  {
    id: 'como-atender-suporte-e-faq',
    title: 'Como atender suporte e manter a FAQ',
    summary: 'Fluxo para acompanhar chamados, responder dúvidas e manter a base de perguntas frequentes atualizada.',
    estimatedMinutes: 6,
    category: 'Suporte',
    steps: [
      {
        title: 'Abra os tickets de suporte',
        description: 'Acesse <strong>Suporte</strong> para acompanhar a fila de chamados, prioridades e histórico de atendimento.',
      },
      {
        title: 'Identifique o tipo de problema',
        description: 'Separe dúvidas de acesso, pagamento, conteúdo, login, certificado ou qualquer bloqueio operacional.',
      },
      {
        title: 'Responda com clareza',
        description: 'Escreva orientações diretas, com o menor número possível de passos, para reduzir idas e voltas com o usuário.',
      },
      {
        title: 'Atualize a FAQ',
        description: 'Se a mesma dúvida aparecer várias vezes, transforme a resposta em artigo de FAQ para diminuir repetição de chamados.',
      },
      {
        title: 'Feche e registre',
        description: 'Marque o ticket como tratado somente depois de validar a solução ou deixar o encaminhamento claro.',
      },
    ],
    notes: [
      'FAQ boa é a que reduz abertura repetida de chamados.',
      'Mensagens curtas e objetivas funcionam melhor no suporte diário.',
    ],
  },
  {
    id: 'como-configurar-notificacoes-e-mensagens',
    title: 'Como configurar notificações e mensagens',
    summary: 'Mantenha o aluno informado com comunicações internas, notificações e avisos operacionais.',
    estimatedMinutes: 5,
    category: 'Comunicação',
    steps: [
      {
        title: 'Acesse notificações',
        description: 'Entre em <strong>Notificações</strong> para revisar envios, status e mensagens relevantes da operação.',
      },
      {
        title: 'Defina o público certo',
        description: 'Escolha se a mensagem é para aluno, criador, admin ou outro segmento da plataforma.',
      },
      {
        title: 'Escreva a mensagem principal',
        description: 'Mantenha o aviso curto, objetivo e com instrução clara sobre o que a pessoa precisa fazer.',
      },
      {
        title: 'Teste o disparo ou a exibição',
        description: 'Valide se a notificação aparece no local correto e se o texto está legível em tela pequena.',
      },
    ],
    notes: [
      'Notificações excessivas reduzem a atenção do usuário.',
      'Sempre teste o contexto da mensagem antes de disparar para todos.',
    ],
  },
  {
    id: 'como-revisar-pagamentos-e-repasses',
    title: 'Como revisar pagamentos e repasses',
    summary: 'Acompanhe cobrança, status de pagamento e repasses para manter a operação financeira sob controle.',
    estimatedMinutes: 6,
    category: 'Financeiro',
    steps: [
      {
        title: 'Abra pagamentos',
        description: 'Acesse <strong>Pagamentos</strong> para conferir configurações, meios aceitos e comportamento da cobrança.',
      },
      {
        title: 'Verifique o histórico',
        description: 'Analise status de compra, pendências, confirmações e possíveis falhas que afetam a jornada do aluno.',
      },
      {
        title: 'Revise repasses',
        description: 'Entre em <strong>Repasses</strong> quando houver necessidade de validar valores destinados a criadores ou parceiros.',
      },
      {
        title: 'Concilie com o suporte',
        description: 'Se houver divergência, confira o ticket do usuário, os logs e a configuração financeira antes de responder.',
      },
    ],
    notes: [
      'Financeiro deve ser tratado com rastreabilidade e resposta documentada.',
      'Sempre confirme o impacto antes de alterar regras ou parâmetros de pagamento.',
    ],
  },
  {
    id: 'como-usar-formularios-publicos',
    title: 'Como usar formulários públicos',
    summary: 'Organize captação de leads, pedidos, inscrições e solicitações usando os formulários da plataforma.',
    estimatedMinutes: 4,
    category: 'Captação',
    steps: [
      {
        title: 'Acesse formulários',
        description: 'Entre em <strong>Formulários</strong> para ver os modelos já publicados e os campos disponíveis.',
      },
      {
        title: 'Escolha o objetivo do formulário',
        description: 'Defina se o formulário será para contato, inscrição, parceria, aula experimental ou outro fluxo.',
      },
      {
        title: 'Revise campos e validações',
        description: 'Peça apenas o necessário e confira se a validação ajuda, em vez de atrapalhar, o envio.',
      },
      {
        title: 'Teste a jornada completa',
        description: 'Envie um teste, confirme recebimento e valide se a resposta chega ao destino esperado.',
      },
    ],
    notes: [
      'Formulários enxutos costumam converter melhor.',
      'Quanto menos atrito na entrada, maior a chance de conclusão.',
    ],
  },
  {
    id: 'como-gerenciar-recursos-e-videos',
    title: 'Como gerenciar recursos e vídeos de apoio',
    summary: 'Organize materiais complementares para aluno, suporte ou operação interna com mais facilidade.',
    estimatedMinutes: 4,
    category: 'Recursos',
    steps: [
      {
        title: 'Abra a biblioteca de recursos',
        description: 'Entre em <strong>Recursos</strong> para acompanhar vídeos, arquivos e itens de apoio publicados na plataforma.',
      },
      {
        title: 'Cadastre o material corretamente',
        description: 'Defina título, descrição, categoria e contexto de uso para que o conteúdo não fique solto na área administrativa.',
      },
      {
        title: 'Vincule ao fluxo correto',
        description: 'Garanta que o recurso fique disponível para quem precisa dele, seja aluno, admin ou criador.',
      },
      {
        title: 'Reveja materiais antigos',
        description: 'Remova ou arquive arquivos que ficaram desatualizados para manter a biblioteca limpa.',
      },
    ],
    notes: [
      'Materiais de apoio devem ser fáceis de localizar.',
      'Evite duplicar arquivos para não confundir a equipe.',
    ],
  },
  {
    id: 'como-usar-storage-r2',
    title: 'Como usar o storage R2 para uploads',
    summary: 'Entenda o fluxo de arquivos e o uso de storage para manter uploads organizados e disponíveis.',
    estimatedMinutes: 5,
    category: 'Infraestrutura',
    steps: [
      {
        title: 'Abra a área de storage',
        description: 'Entre em <strong>Storage R2</strong> para verificar arquivos enviados, organização e possíveis pendências de upload.',
      },
      {
        title: 'Revise nome e local',
        description: 'Use nomes consistentes e pastas lógicas para evitar que o time perca tempo procurando arquivos.',
      },
      {
        title: 'Confirme acessibilidade',
        description: 'Valide se a mídia ou documento está disponível no local certo e se não houve erro durante o envio.',
      },
      {
        title: 'Remova duplicados quando necessário',
        description: 'Se um arquivo foi enviado novamente sem necessidade, mantenha apenas a versão correta e documentada.',
      },
    ],
    notes: [
      'Storage organizado reduz erro em curso, blog e site editor.',
      'Sempre confira o arquivo final antes de vinculá-lo em produção.',
    ],
  },
  {
    id: 'como-usar-botoes-de-aula-e-templates',
    title: 'Como usar botões de aula e templates',
    summary: 'Padronize ações recorrentes dentro das aulas para melhorar a navegação do aluno e reduzir manutenção.',
    estimatedMinutes: 4,
    category: 'Experiência de aula',
    steps: [
      {
        title: 'Abra os templates de botão',
        description: 'Acesse <strong>Botões de aula</strong> para ver os modelos reutilizáveis já configurados.',
      },
      {
        title: 'Escolha a ação correta',
        description: 'Use o template para levar o aluno ao próximo conteúdo, a um material complementar ou a uma ação contextual.',
      },
      {
        title: 'Mantenha a linguagem consistente',
        description: 'Evite variações grandes no texto de botão para não quebrar a previsibilidade da jornada.',
      },
      {
        title: 'Teste em aulas reais',
        description: 'Confira se o botão aparece no local esperado e se o clique executa o comportamento correto.',
      },
    ],
    notes: [
      'Padronização poupa tempo em cursos grandes.',
      'Botões muito longos ou genéricos confundem o aluno.',
    ],
  },
  {
    id: 'como-monitorar-seguranca-e-acessos',
    title: 'Como monitorar segurança e acessos',
    summary: 'Reforce boas práticas de acesso e monitore sinais de risco sem atrapalhar a operação.',
    estimatedMinutes: 5,
    category: 'Segurança',
    steps: [
      {
        title: 'Abra a área de segurança',
        description: 'Entre em <strong>Segurança</strong> para revisar verificações, alertas e pontos de atenção da plataforma.',
      },
      {
        title: 'Observe eventos suspeitos',
        description: 'Cheque acessos incomuns, falhas repetidas e qualquer comportamento que pareça fora do padrão.',
      },
      {
        title: 'Revise permissões administrativas',
        description: 'Confirme se cada usuário mantém apenas o acesso necessário para o seu papel.',
      },
      {
        title: 'Documente decisões',
        description: 'Quando houver uma ação de segurança, registre o motivo para manter rastreabilidade interna.',
      },
    ],
    notes: [
      'Segurança boa é preventiva, não só reativa.',
      'Revisões de acesso devem ser feitas com frequência definida pela operação.',
    ],
  },
  {
    id: 'como-gerenciar-conta-e-branding-do-admin',
    title: 'Como gerenciar minha conta e o branding do admin',
    summary: 'Ajuste dados da conta administrativa e mantenha a identidade visual da plataforma consistente.',
    estimatedMinutes: 4,
    category: 'Configurações',
    steps: [
      {
        title: 'Abra Minha conta',
        description: 'Entre em <strong>Minha conta</strong> para revisar dados pessoais, preferências e informações de acesso.',
      },
      {
        title: 'Revise a identidade visual',
        description: 'Acesse <strong>Configurações do site</strong> para conferir logo, cores, tipografia e outros elementos de marca.',
      },
      {
        title: 'Valide consistência entre telas',
        description: 'Veja se a mesma identidade aparece corretamente no admin, no site público e nas áreas do aluno.',
      },
      {
        title: 'Salve e teste',
        description: 'Depois de ajustar branding, abra outras páginas do sistema para garantir que a alteração foi aplicada sem quebra.',
      },
    ],
    notes: [
      'Branding consistente aumenta percepção de qualidade.',
      'Qualquer alteração visual deve ser validada em telas diferentes.',
    ],
  },
];

function normalizeStepDescription(description: string) {
  const sanitized = sanitizeRichTextHtml(description.trim() || '<p></p>');
  return sanitized || '<p></p>';
}

function normalizeTutorialStep(step: Partial<AdminTutorialStep>, index: number): AdminTutorialStep {
  return {
    title: typeof step.title === 'string' && step.title.trim() ? step.title.trim() : `Passo ${index + 1}`,
    description: normalizeStepDescription(typeof step.description === 'string' ? step.description : ''),
  };
}

function normalizeTutorial(tutorial: Partial<AdminTutorial>, fallbackIndex = 0): AdminTutorial | null {
  if (!tutorial || typeof tutorial.id !== 'string' || typeof tutorial.title !== 'string' || typeof tutorial.summary !== 'string' || typeof tutorial.category !== 'string') {
    return null;
  }

  const normalizedSteps = Array.isArray(tutorial.steps)
    ? tutorial.steps.map((step, index) => normalizeTutorialStep(step ?? {}, index))
    : [];

  const normalizedNotes = Array.isArray(tutorial.notes)
    ? tutorial.notes
        .map((note) => (typeof note === 'string' ? note.trim() : ''))
        .filter(Boolean)
    : [];

  return {
    id: tutorial.id.trim() || `tutorial-${fallbackIndex + 1}`,
    title: tutorial.title.trim(),
    summary: tutorial.summary.trim(),
    estimatedMinutes: Number.isFinite(tutorial.estimatedMinutes) ? Number(tutorial.estimatedMinutes) : 3,
    category: tutorial.category.trim() || 'Geral',
    steps: normalizedSteps.length > 0 ? normalizedSteps : [normalizeTutorialStep({ title: 'Passo 1', description: '<p>Adicione os passos do tutorial.</p>' }, 0)],
    notes: normalizedNotes.length > 0 ? normalizedNotes : ['Adicione observações úteis para o admin.'],
  };
}

function safeLoadTutorials(): AdminTutorial[] {
  if (typeof window === 'undefined') {
    return defaultAdminTutorials;
  }

  try {
    const raw = window.localStorage.getItem(ADMIN_TUTORIALS_STORAGE_KEY);

    if (!raw) {
      return defaultAdminTutorials;
    }

    const parsed = JSON.parse(raw) as Partial<AdminTutorial>[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultAdminTutorials;
    }

    const tutorials = parsed
      .map((tutorial, index) => normalizeTutorial(tutorial, index))
      .filter((tutorial): tutorial is AdminTutorial => Boolean(tutorial));

    return tutorials.length > 0 ? tutorials : defaultAdminTutorials;
  }
  catch {
    return defaultAdminTutorials;
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildUniqueTutorialId(title: string, tutorials: AdminTutorial[]) {
  const baseId = slugify(title) || 'novo-tutorial';
  let candidate = baseId;
  let suffix = 2;

  while (tutorials.some((tutorial) => tutorial.id === candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function normalizeTutorialDraft(tutorial: AdminTutorialDraft, fallbackId: string, existingTutorials: AdminTutorial[]) {
  const normalizedTutorial = normalizeTutorial(tutorial, existingTutorials.length);

  if (!normalizedTutorial) {
    throw new Error('Invalid tutorial draft');
  }

  return {
    ...normalizedTutorial,
    id: tutorial.id?.trim() || fallbackId,
  };
}

type AdminTutorialsContextValue = {
  tutorials: AdminTutorial[];
  activeTutorialId: string;
  activeTutorial: AdminTutorial;
  isDrawerOpen: boolean;
  isDrawerMinimized: boolean;
  openTutorial: (tutorialId?: string) => void;
  closeDrawer: () => void;
  minimizeDrawer: () => void;
  restoreDrawer: () => void;
  selectTutorial: (tutorialId: string) => void;
  addTutorial: (tutorial: AdminTutorialDraft) => AdminTutorial;
  updateTutorial: (tutorialId: string, tutorial: AdminTutorialDraft) => AdminTutorial;
  deleteTutorial: (tutorialId: string) => boolean;
  reorderTutorials: (tutorialIds: string[]) => void;
};

const AdminTutorialsContext = createContext<AdminTutorialsContextValue | null>(null);

export function AdminTutorialsProvider({ children }: { children: ReactNode }) {
  const [tutorials, setTutorials] = useState<AdminTutorial[]>(safeLoadTutorials);
  const [activeTutorialId, setActiveTutorialId] = useState(() => safeLoadTutorials()[0]?.id ?? '');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerMinimized, setIsDrawerMinimized] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(ADMIN_TUTORIALS_STORAGE_KEY, JSON.stringify(tutorials));
  }, [tutorials]);

  const activeTutorial = useMemo(() => {
    return tutorials.find((tutorial) => tutorial.id === activeTutorialId) ?? tutorials[0] ?? defaultAdminTutorials[0];
  }, [activeTutorialId, tutorials]);

  useEffect(() => {
    if (!activeTutorial && tutorials[0]) {
      setActiveTutorialId(tutorials[0].id);
    }
  }, [activeTutorial, tutorials]);

  function openTutorial(tutorialId = tutorials[0]?.id ?? defaultAdminTutorials[0].id) {
    if (tutorialId) {
      setActiveTutorialId(tutorialId);
    }
    setIsDrawerOpen(true);
    setIsDrawerMinimized(false);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
    setIsDrawerMinimized(false);
  }

  function minimizeDrawer() {
    setIsDrawerMinimized(true);
    setIsDrawerOpen(false);
  }

  function restoreDrawer() {
    setIsDrawerOpen(true);
    setIsDrawerMinimized(false);
  }

  function selectTutorial(tutorialId: string) {
    setActiveTutorialId(tutorialId);
    setIsDrawerOpen(true);
    setIsDrawerMinimized(false);
  }

  function addTutorial(tutorial: AdminTutorialDraft) {
    const nextTutorial = normalizeTutorialDraft(tutorial, buildUniqueTutorialId(tutorial.title, tutorials), tutorials);

    setTutorials((current) => {
      const nextTutorials = [...current, nextTutorial];
      window.localStorage.setItem(ADMIN_TUTORIALS_STORAGE_KEY, JSON.stringify(nextTutorials));
      return nextTutorials;
    });
    setActiveTutorialId(nextTutorial.id);
    setIsDrawerOpen(true);
    setIsDrawerMinimized(false);

    return nextTutorial;
  }

  function updateTutorial(tutorialId: string, tutorial: AdminTutorialDraft) {
    const nextTutorial = normalizeTutorialDraft(tutorial, tutorialId, tutorials);

    setTutorials((current) => {
      const nextTutorials = current.map((item) => (item.id === tutorialId ? nextTutorial : item));
      window.localStorage.setItem(ADMIN_TUTORIALS_STORAGE_KEY, JSON.stringify(nextTutorials));
      return nextTutorials;
    });
    setActiveTutorialId(nextTutorial.id);
    setIsDrawerOpen(true);
    setIsDrawerMinimized(false);

    return nextTutorial;
  }

  function deleteTutorial(tutorialId: string) {
    let deleted = false;

    setTutorials((current) => {
      const nextTutorials = current.filter((item) => {
        const shouldKeep = item.id !== tutorialId;

        if (!shouldKeep) {
          deleted = true;
        }

        return shouldKeep;
      });

      const safeTutorials = nextTutorials.length > 0 ? nextTutorials : defaultAdminTutorials;
      window.localStorage.setItem(ADMIN_TUTORIALS_STORAGE_KEY, JSON.stringify(safeTutorials));

      if (activeTutorialId === tutorialId) {
        setActiveTutorialId(safeTutorials[0]?.id ?? defaultAdminTutorials[0].id);
      }

      return safeTutorials;
    });

    return deleted;
  }

  function reorderTutorials(tutorialIds: string[]) {
    const nextTutorials = tutorialIds
      .map((tutorialId) => tutorials.find((tutorial) => tutorial.id === tutorialId))
      .filter((tutorial): tutorial is AdminTutorial => Boolean(tutorial));

    if (nextTutorials.length === 0) {
      return;
    }

    setTutorials(nextTutorials);
    window.localStorage.setItem(ADMIN_TUTORIALS_STORAGE_KEY, JSON.stringify(nextTutorials));
  }

  const value: AdminTutorialsContextValue = {
    tutorials,
    activeTutorialId,
    activeTutorial: activeTutorial ?? tutorials[0] ?? defaultAdminTutorials[0],
    isDrawerOpen,
    isDrawerMinimized,
    openTutorial,
    closeDrawer,
    minimizeDrawer,
    restoreDrawer,
    selectTutorial,
    addTutorial,
    updateTutorial,
    deleteTutorial,
    reorderTutorials,
  };

  return <AdminTutorialsContext.Provider value={value}>{children}</AdminTutorialsContext.Provider>;
}

export function useAdminTutorials() {
  const context = useContext(AdminTutorialsContext);

  if (!context) {
    throw new Error('useAdminTutorials must be used within AdminTutorialsProvider');
  }

  return context;
}
