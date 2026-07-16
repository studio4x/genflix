import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
    id: 'como-criar-e-importar-curso-ou-modulos-via-json',
    title: 'Como criar e importar um curso ou módulos via JSON',
    summary: 'Use os modelos JSON do admin para criar um curso completo, adicionar módulos em um curso existente ou substituir conteúdo com segurança.',
    estimatedMinutes: 8,
    category: 'Builder de curso',
    steps: [
      {
        title: 'Escolha o tipo de importação',
        description: '<p>Antes de começar, defina o resultado esperado:</p><ul><li><strong>Criar um curso novo:</strong> use um JSON de curso completo no Catálogo de Cursos.</li><li><strong>Adicionar conteúdo:</strong> importe um módulo, uma lista de módulos ou um curso completo dentro do builder de um curso existente.</li><li><strong>Substituir conteúdo:</strong> selecione um módulo específico ou limpe toda a estrutura atual antes de importar.</li></ul>',
      },
      {
        title: 'Baixe um modelo JSON',
        description: '<p>Acesse <strong>Admin / Configurações do Site / Modelos JSON</strong>. Escolha <strong>Curso completo</strong>, <strong>1º módulo do curso</strong> ou <strong>Módulo avulso</strong> e clique em <strong>Copiar JSON</strong> ou <strong>Baixar JSON modelo</strong>.</p><p>Edite a cópia e mantenha os nomes das propriedades em inglês. Os textos podem ser escritos normalmente em português.</p>',
      },
      {
        title: 'Monte o JSON de um curso completo',
        description: `<p>O curso completo deve ser um objeto com <strong>title</strong> e uma lista <strong>modules</strong>. Cada módulo pode conter <strong>lessons</strong> e <strong>assessments</strong>.</p><pre><code>{
  "title": "Curso de exemplo",
  "description": "Resumo do curso",
  "status": "draft",
  "workload_minutes": 120,
  "modules": [
    {
      "title": "Módulo 1 - Fundamentos",
      "description": "Introdução ao tema",
      "lessons": [
        {
          "title": "Aula 1 - Boas-vindas",
          "lesson_type": "text",
          "text_content": "&lt;p&gt;Conteúdo da aula.&lt;/p&gt;",
          "estimated_minutes": 10
        }
      ],
      "assessments": []
    }
  ]
}</code></pre><p>Use <strong>draft</strong> durante a preparação. Imagens com endereço de exemplo devem ser removidas ou trocadas por URLs válidas.</p>`,
      },
      {
        title: 'Monte o JSON de um ou vários módulos',
        description: `<p>Para um módulo avulso, não inclua a propriedade <strong>modules</strong>: envie diretamente o objeto do módulo.</p><pre><code>{
  "title": "Módulo avulso",
  "description": "Descrição do módulo",
  "lessons": [
    {
      "title": "Aula 1",
      "lesson_type": "text",
      "text_content": "&lt;p&gt;Conteúdo da aula.&lt;/p&gt;",
      "estimated_minutes": 10
    }
  ],
  "assessments": []
}</code></pre><p>Para importar vários módulos de uma vez, coloque objetos como esse dentro de uma lista: <strong>[ módulo 1, módulo 2 ]</strong>. Em cada aula, use um tipo aceito: <strong>video</strong>, <strong>text</strong>, <strong>hybrid</strong> ou <strong>file</strong>.</p>`,
      },
      {
        title: 'Crie um curso novo pelo Catálogo',
        description: '<p>Abra <strong>Admin / Catálogo de Cursos</strong> e clique em <strong>Importar de IA</strong>. Cole o objeto de curso completo no campo e selecione <strong>Importar e Criar Curso</strong>.</p><p>Esse fluxo cria um novo curso. Depois, abra o builder para revisar a estrutura e completar as configurações comerciais.</p>',
      },
      {
        title: 'Importe módulos em um curso existente',
        description: '<p>Abra o curso de destino e, no menu lateral do builder, clique em <strong>Importar Conteúdo (IA)</strong>. Cole o JSON ou anexe um arquivo <strong>.json</strong>. Confira o selo <strong>Formato detectado</strong> antes de continuar.</p><ul><li><strong>Adicionar novos módulos:</strong> inclui o conteúdo no final da estrutura atual.</li><li><strong>Substituir Módulo Existente:</strong> apaga aulas e quizzes do módulo escolhido e usa o primeiro módulo do JSON no lugar.</li><li><strong>Limpar TODO o curso primeiro:</strong> remove todos os módulos atuais e recomeça a estrutura.</li></ul>',
      },
      {
        title: 'Faça backup antes de substituir',
        description: '<p>No builder, clique em <strong>Exportar Conteúdo</strong> e baixe o <strong>Curso completo</strong> ou o módulo que será alterado. Guarde esse arquivo antes de usar as opções de substituição ou limpeza.</p><p>A substituição remove o conteúdo atual do módulo selecionado. A limpeza remove todos os módulos do curso.</p>',
      },
      {
        title: 'Revise o curso depois da importação',
        description: '<p>Confira a ordem dos módulos, os títulos, o conteúdo das aulas, os quizzes e a carga horária. Depois revise capa, preço, categorias, autor, página pública, liberações e atribuições.</p><p>Materiais anexos, regras comerciais e liberações não fazem parte do modelo básico de conteúdo e devem ser configurados no admin após a importação.</p>',
      },
    ],
    notes: [
      'JSON válido usa aspas duplas, não aceita vírgula depois do último item e precisa fechar todas as chaves e listas.',
      'O importador também aceita JSON copiado de um bloco Markdown com ```json, mas o conteúdo puro é mais fácil de revisar.',
      'Mantenha o curso como rascunho até testar a experiência completa na visão do aluno.',
      'Nunca use “Limpar TODO o curso primeiro” sem exportar um backup atualizado.',
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
  {
    id: 'como-revisar-e-encerrar-tickets-de-suporte',
    title: 'Como revisar e encerrar tickets de suporte',
    summary: 'Fluxo prático para classificar, responder, encaminhar e encerrar chamados sem perder rastreabilidade.',
    estimatedMinutes: 6,
    category: 'Suporte',
    steps: [
      {
        title: 'Abra a fila de tickets',
        description: 'Entre em <strong>Suporte</strong> para ver os chamados abertos, o status atual e o que está em andamento.',
      },
      {
        title: 'Classifique o tipo de demanda',
        description: 'Separe problemas de acesso, cobrança, conteúdo, bugs e dúvidas operacionais para acelerar a resposta.',
      },
      {
        title: 'Responda com orientação objetiva',
        description: 'Explique o próximo passo de forma curta e clara, evitando respostas longas demais para o usuário.',
      },
      {
        title: 'Encaminhe quando necessário',
        description: 'Se o caso depender de outro setor, registre o motivo do encaminhamento e deixe o histórico visível.',
      },
      {
        title: 'Feche o ticket depois da validação',
        description: 'Só encerre quando a solução estiver confirmada ou o próximo passo estiver combinado com clareza.',
      },
    ],
    notes: [
      'A resposta deve orientar o usuário e reduzir retrabalho interno.',
      'Fechar o ticket sem validação costuma gerar reabertura desnecessária.',
    ],
  },
  {
    id: 'como-tratar-pendencias-operacionais',
    title: 'Como tratar pendências operacionais do admin',
    summary: 'Entenda como priorizar e resolver os itens que aparecem na fila de pendências do painel.',
    estimatedMinutes: 5,
    category: 'Operação',
    steps: [
      {
        title: 'Abra a área de pendências',
        description: 'Acesse <strong>Pendências</strong> para identificar o que exige ação imediata e o que pode aguardar.',
      },
      {
        title: 'Ordene por impacto',
        description: 'Resolva primeiro o que bloqueia vendas, acesso de alunos, atendimento ou publicação de conteúdo.',
      },
      {
        title: 'Valide a origem do problema',
        description: 'Antes de agir, descubra se a pendência veio de um curso, usuário, pagamento, suporte ou ajuste de site.',
      },
      {
        title: 'Registre a solução',
        description: 'Anote o que foi feito para que a equipe consiga rastrear decisões e evitar retrabalho.',
      },
    ],
    notes: [
      'Pendências precisam de rotina diária para não acumular.',
      'Resolver por impacto evita que o time se prenda ao item menos crítico.',
    ],
  },
  {
    id: 'como-revisar-relatorios-e-indicadores',
    title: 'Como revisar relatórios e indicadores',
    summary: 'Use a área de relatórios para acompanhar a saúde da operação e encontrar pontos de melhoria.',
    estimatedMinutes: 6,
    category: 'Dados',
    steps: [
      {
        title: 'Abra os relatórios',
        description: 'Entre em <strong>Relatórios</strong> para conferir os painéis já disponíveis e selecionar a visão mais útil.',
      },
      {
        title: 'Olhe os números com contexto',
        description: 'Compare período, tendência e variação antes de tomar qualquer decisão baseada em um único número.',
      },
      {
        title: 'Cruze com operação e suporte',
        description: 'Se um indicador piorou, verifique se houve mudança de campanha, problema técnico ou aumento de chamados.',
      },
      {
        title: 'Registre insights acionáveis',
        description: 'Anote o que precisa de ação, o que virou alerta e o que pode virar acompanhamento recorrente.',
      },
    ],
    notes: [
      'Relatórios só ajudam quando viram decisão prática.',
      'A leitura por tendência costuma ser mais útil do que o valor isolado do dia.',
    ],
  },
  {
    id: 'como-publicar-e-validar-um-curso',
    title: 'Como publicar e validar um curso antes de entrar no ar',
    summary: 'Checklist final para evitar publicar cursos com falhas de conteúdo, layout ou acesso.',
    estimatedMinutes: 6,
    category: 'Cursos',
    steps: [
      {
        title: 'Revise o conteúdo completo',
        description: 'Confira módulos, aulas, materiais e avaliações antes de liberar o curso para o público.',
      },
      {
        title: 'Valide a página pública',
        description: 'Verifique se título, descrição, capa, CTA e preço estão coerentes com a oferta.',
      },
      {
        title: 'Teste como aluno',
        description: 'Abra a versão de estudante para conferir navegação, liberação e comportamento das aulas.',
      },
      {
        title: 'Confirme a publicação',
        description: 'Só marque o curso como pronto depois de passar por uma última checagem rápida da experiência completa.',
      },
    ],
    notes: [
      'Checklist de publicação evita correções emergenciais depois do lançamento.',
      'Uma validação final reduz risco de retrabalho com suporte.',
    ],
  },
  {
    id: 'como-editar-um-curso-ja-publicado',
    title: 'Como editar um curso já publicado sem quebrar a jornada',
    summary: 'Boas práticas para alterar cursos em produção com o mínimo de impacto para os alunos.',
    estimatedMinutes: 6,
    category: 'Cursos',
    steps: [
      {
        title: 'Identifique o que pode mudar',
        description: 'Antes de editar, separe o que é ajuste visual, correção de texto, reorganização ou alteração estrutural.',
      },
      {
        title: 'Evite mexer no que o aluno já concluiu',
        description: 'Se o curso já está em andamento, mantenha a progressão estável para não gerar confusão.',
      },
      {
        title: 'Faça a alteração com cuidado',
        description: 'Atualize apenas os pontos necessários e teste o caminho do aluno depois da mudança.',
      },
      {
        title: 'Valide impacto em relatórios e liberação',
        description: 'Confirme se a edição não afetou métricas, acesso ou a ordem esperada das etapas.',
      },
    ],
    notes: [
      'Alterar curso publicado exige mais cautela do que criar um novo.',
      'Mudanças pequenas e controladas reduzem o risco operacional.',
    ],
  },
  {
    id: 'como-configurar-e-validar-repasses-financeiros',
    title: 'Como configurar e validar repasses financeiros',
    summary: 'Fluxo para revisar repasses, checar valores e evitar divergências com criadores ou parceiros.',
    estimatedMinutes: 6,
    category: 'Financeiro',
    steps: [
      {
        title: 'Abra a área de repasses',
        description: 'Entre em <strong>Repasses</strong> para ver os registros, os valores previstos e os itens pendentes.',
      },
      {
        title: 'Confira a base de cálculo',
        description: 'Verifique se o valor considera vendas, comissões, taxas e a regra financeira esperada.',
      },
      {
        title: 'Valide com o histórico',
        description: 'Compare o repasse com a compra, o período e o destinatário correto antes de aprovar qualquer ajuste.',
      },
      {
        title: 'Registre exceções',
        description: 'Se houver divergência, documente o motivo e encaminhe para análise antes de seguir com o pagamento.',
      },
    ],
    notes: [
      'Financeiro exige rastreabilidade e conferência dupla.',
      'Qualquer ajuste precisa ser fácil de auditar depois.',
    ],
  },
  {
    id: 'como-manter-faq-e-central-de-suporte',
    title: 'Como manter a FAQ e a central de suporte',
    summary: 'Atualize perguntas frequentes e reduza chamados repetidos com respostas mais claras e completas.',
    estimatedMinutes: 5,
    category: 'Suporte',
    steps: [
      {
        title: 'Revise os chamados recorrentes',
        description: 'Veja quais perguntas aparecem com frequência e transforme isso em conteúdo de FAQ.',
      },
      {
        title: 'Escreva respostas reutilizáveis',
        description: 'Prefira textos curtos, diretos e fáceis de adaptar para múltiplos casos parecidos.',
      },
      {
        title: 'Atualize a página de FAQ',
        description: 'Mantenha a central alinhada com mudanças de produto, pagamentos, acesso e conteúdo.',
      },
      {
        title: 'Valide se o usuário encontra a resposta',
        description: 'Teste a navegação da FAQ para confirmar que a informação está visível e fácil de localizar.',
      },
    ],
    notes: [
      'FAQ boa é a que diminui chamados e melhora autonomia do usuário.',
      'Conteúdo desatualizado na FAQ pode gerar confusão e retrabalho.',
    ],
  },
  {
    id: 'como-segmentar-notificacoes-e-mensagens',
    title: 'Como segmentar notificações e mensagens por público',
    summary: 'Envie a mensagem certa para aluno, criador, admin ou outro grupo sem poluir a comunicação.',
    estimatedMinutes: 5,
    category: 'Comunicação',
    steps: [
      {
        title: 'Defina o público-alvo',
        description: 'Escolha para quem a mensagem será enviada antes de escrever o conteúdo final.',
      },
      {
        title: 'Ajuste o tom da comunicação',
        description: 'Mude o nível de detalhe e formalidade conforme o público que vai receber a mensagem.',
      },
      {
        title: 'Evite envio em massa desnecessário',
        description: 'Use segmentação para falar só com quem realmente precisa da informação.',
      },
      {
        title: 'Teste a exibição correta',
        description: 'Confirme se a notificação aparece apenas no contexto esperado e com o texto certo.',
      },
    ],
    notes: [
      'Segmentação reduz ruído e aumenta relevância.',
      'Mensagens genéricas demais tendem a ser ignoradas.',
    ],
  },
  {
    id: 'como-usar-site-editor-para-paginas-institucionais',
    title: 'Como usar o site editor para páginas institucionais',
    summary: 'Ajuste páginas como Sobre, Contato, Ajuda, Termos e Privacidade com segurança e consistência.',
    estimatedMinutes: 6,
    category: 'Site',
    steps: [
      {
        title: 'Abra o site editor',
        description: 'Entre em <strong>Site Editor</strong> para localizar a página que precisa de revisão.',
      },
      {
        title: 'Edite o conteúdo com cautela',
        description: 'Atualize textos, chamadas e blocos sem quebrar a estrutura já aprovada da página.',
      },
      {
        title: 'Revise links e SEO',
        description: 'Confira se os links estão corretos e se a página continua coerente com a proposta institucional.',
      },
      {
        title: 'Valide a publicação no site',
        description: 'Abra a versão pública para garantir que a mudança entrou no ar como esperado.',
      },
    ],
    notes: [
      'Páginas institucionais pedem revisão de texto e de link com igual atenção.',
      'Mudanças legais ou de suporte devem ser publicadas com checagem final.',
    ],
  },
  {
    id: 'como-revisar-permissoes-grupos-e-acessos',
    title: 'Como revisar permissões, grupos e acessos',
    summary: 'Fluxo para manter usuários, grupos e permissões sob controle e evitar acessos indevidos.',
    estimatedMinutes: 5,
    category: 'Usuários',
    steps: [
      {
        title: 'Abra usuários e grupos',
        description: 'Revise a distribuição atual de perfis e grupos para entender quem pode fazer o quê.',
      },
      {
        title: 'Valide a necessidade do acesso',
        description: 'Conceda apenas as permissões necessárias para cada função no sistema.',
      },
      {
        title: 'Cheque impactos de mudança',
        description: 'Antes de alterar um perfil, confirme se a pessoa depende daquele acesso para operar o dia a dia.',
      },
      {
        title: 'Documente exceções',
        description: 'Se houver acesso temporário ou especial, deixe registrado para revisão futura.',
      },
    ],
    notes: [
      'Menos acesso significa menos risco operacional.',
      'Permissões devem ser revisadas com periodicidade.',
    ],
  },
  {
    id: 'como-organizar-a-biblioteca-de-recursos-e-videos',
    title: 'Como organizar a biblioteca de recursos e vídeos',
    summary: 'Mantenha materiais, vídeos e arquivos de apoio fáceis de localizar e sempre atualizados.',
    estimatedMinutes: 5,
    category: 'Recursos',
    steps: [
      {
        title: 'Abra a área de recursos',
        description: 'Entre em <strong>Recursos</strong> para verificar o que está publicado e o que precisa ser atualizado.',
      },
      {
        title: 'Padronize títulos e categorias',
        description: 'Use nomes consistentes para facilitar a busca e evitar duplicidade.',
      },
      {
        title: 'Remova itens obsoletos',
        description: 'Arquive materiais antigos que possam confundir o usuário ou a equipe.',
      },
      {
        title: 'Confirme acesso e contexto',
        description: 'Teste se o item está disponível para o público correto e no local esperado.',
      },
    ],
    notes: [
      'Organização de biblioteca poupa tempo em suporte e conteúdo.',
      'Manter material antigo visível pode gerar erro operacional.',
    ],
  },
  {
    id: 'como-usar-seguranca-e-scans-preventivos',
    title: 'Como usar segurança e scans preventivos',
    summary: 'Rotina para observar alertas, riscos e sinais de comportamento suspeito antes que virem problema.',
    estimatedMinutes: 5,
    category: 'Segurança',
    steps: [
      {
        title: 'Abra a área de segurança',
        description: 'Entre em <strong>Segurança</strong> para visualizar alertas, verificações e eventuais pontos de atenção.',
      },
      {
        title: 'Observe o que foge do padrão',
        description: 'Cheque logins incomuns, falhas repetidas e qualquer evento que mereça análise mais cuidadosa.',
      },
      {
        title: 'Ajuste acessos quando necessário',
        description: 'Revise permissões e reduza exposição se notar comportamento suspeito.',
      },
      {
        title: 'Registre a ação tomada',
        description: 'Deixe claro o que foi verificado, o que foi alterado e por que a decisão foi tomada.',
      },
    ],
    notes: [
      'Segurança preventiva reduz incidentes antes que eles afetem usuários.',
      'Toda ação de segurança precisa ser rastreável.',
    ],
  },
  {
    id: 'como-acompanhar-conversao-e-checkout',
    title: 'Como acompanhar conversão e checkout',
    summary: 'Monitore o fluxo comercial para identificar abandono, atrito e oportunidades de melhoria no funil.',
    estimatedMinutes: 6,
    category: 'Comercial',
    steps: [
      {
        title: 'Abra a visão de vendas',
        description: 'Use relatórios e pagamentos para identificar quais páginas ou ofertas estão convertendo melhor.',
      },
      {
        title: 'Observe o funil',
        description: 'Compare visitas, intenção de compra, início de checkout e conclusão para localizar o ponto de abandono.',
      },
      {
        title: 'Cheque o percurso do checkout',
        description: 'Valide se preço, meios de pagamento, textos e chamadas estão claros para o usuário finalizar a compra.',
      },
      {
        title: 'Registre hipóteses de melhoria',
        description: 'Anote o que pode ser testado depois, como ajustes de CTA, oferta ou ordem das informações.',
      },
    ],
    notes: [
      'Conversão deve ser lida por tendência, não só por um dia isolado.',
      'Qualquer queda no checkout merece validação imediata da jornada.',
    ],
  },
  {
    id: 'como-configurar-liberacoes-avancadas-de-curso',
    title: 'Como configurar liberações avançadas de curso',
    summary: 'Aplique regras mais sofisticadas para liberar conteúdo por data, progresso ou contexto operacional.',
    estimatedMinutes: 6,
    category: 'Cursos',
    steps: [
      {
        title: 'Abra as liberações do curso',
        description: 'Entre em <strong>Liberacoes</strong> para revisar o que já está publicado e o que pode ser ajustado.',
      },
      {
        title: 'Escolha a regra principal',
        description: 'Defina se a liberação será por data, por sequência, por progresso ou por exceção operacional.',
      },
      {
        title: 'Aplique em nível adequado',
        description: 'Quando necessário, configure regras diferentes por curso, módulo ou aula para manter a experiência previsível.',
      },
      {
        title: 'Teste cenários alternativos',
        description: 'Valide se o aluno vê o conteúdo correto em condições diferentes, como compra recente ou curso em andamento.',
      },
    ],
    notes: [
      'Regras avançadas precisam ser documentadas para evitar confusão futura.',
      'Sempre teste com mais de um cenário antes de considerar a configuração pronta.',
    ],
  },
  {
    id: 'como-revisar-metricas-do-dashboard',
    title: 'Como revisar métricas do dashboard',
    summary: 'Transforme os indicadores da home do admin em rotina de acompanhamento e decisão.',
    estimatedMinutes: 5,
    category: 'Dados',
    steps: [
      {
        title: 'Abra o dashboard',
        description: 'Comece pela tela inicial do admin e veja os indicadores que mudaram desde a última revisão.',
      },
      {
        title: 'Leia os sinais mais importantes',
        description: 'Destaque volume de vendas, suporte, notificações e pendências que pedem ação rápida.',
      },
      {
        title: 'Compare com o período anterior',
        description: 'Use a comparação temporal para entender se houve melhora, queda ou estabilidade.',
      },
      {
        title: 'Aponte a próxima ação',
        description: 'Registre o que precisa ser acompanhado no dia, na semana ou no mês seguinte.',
      },
    ],
    notes: [
      'Dashboard é melhor quando vira rotina de decisão.',
      'Métrica sem ação prática tende a perder valor rapidamente.',
    ],
  },
  {
    id: 'como-moderar-reviews-e-respostas-publicas',
    title: 'Como moderar reviews e respostas públicas',
    summary: 'Padronize a gestão de avaliações e respostas para manter a reputação pública em ordem.',
    estimatedMinutes: 5,
    category: 'Comunidade',
    steps: [
      {
        title: 'Revise as avaliações recebidas',
        description: 'Abra <strong>Reviews</strong> e identifique o que exige aprovação, resposta ou rejeição.',
      },
      {
        title: 'Verifique o contexto antes de agir',
        description: 'Leia o conteúdo completo para evitar aprovar algo fora de contexto ou responder de forma inadequada.',
      },
      {
        title: 'Escreva respostas úteis',
        description: 'Se for responder publicamente, mantenha o tom profissional e a resposta objetiva.',
      },
      {
        title: 'Monitore recorrência',
        description: 'Se um padrão voltar com frequência, crie ação interna ou tutorial de apoio para o time.',
      },
    ],
    notes: [
      'Respostas públicas pedem consistência de tom.',
      'Avaliação moderada sem contexto pode gerar ruído para a marca.',
    ],
  },
  {
    id: 'como-operar-campanhas-e-banners-com-versao',
    title: 'Como operar campanhas e banners com versão',
    summary: 'Gerencie banners e destaques sem perder controle sobre histórico, revisão e troca de campanhas.',
    estimatedMinutes: 5,
    category: 'Marketing',
    steps: [
      {
        title: 'Abra a área de banners',
        description: 'Veja os itens ativos, duplicados e em revisão antes de iniciar uma nova campanha.',
      },
      {
        title: 'Crie a versão da campanha',
        description: 'Ajuste texto, imagem, CTA e destino da campanha para a nova fase de divulgação.',
      },
      {
        title: 'Reordene e publique',
        description: 'Defina qual banner aparece primeiro e confirme se o destaque principal é o correto.',
      },
      {
        title: 'Arquive o material antigo',
        description: 'Remova ou desative banners antigos para evitar conflito visual e mensagem concorrente.',
      },
    ],
    notes: [
      'Campanhas precisam de revisão antes e depois da publicação.',
      'Guardar histórico ajuda a entender o que performou melhor.',
    ],
  },
  {
    id: 'como-fazer-auditoria-de-arquivos-no-storage-r2',
    title: 'Como fazer auditoria de arquivos no storage R2',
    summary: 'Organize, revise e limpe mídias e documentos para manter o storage confiável e fácil de navegar.',
    estimatedMinutes: 5,
    category: 'Infraestrutura',
    steps: [
      {
        title: 'Abra o storage',
        description: 'Entre em <strong>Storage R2</strong> e revise os arquivos que estão disponíveis para a operação.',
      },
      {
        title: 'Identifique duplicidades',
        description: 'Procure arquivos com nomes parecidos ou versões repetidas que possam confundir o time.',
      },
      {
        title: 'Valide os itens críticos',
        description: 'Confira os arquivos que afetam cursos, blog, banners e páginas públicas antes de remover qualquer coisa.',
      },
      {
        title: 'Limpe com critério',
        description: 'Arquive ou remova somente o que realmente não está mais em uso.',
      },
    ],
    notes: [
      'Auditoria de storage evita erro de mídia em áreas públicas.',
      'Nomes consistentes simplificam manutenção futura.',
    ],
  },
  {
    id: 'como-tratar-excecoes-de-permissao',
    title: 'Como tratar exceções de permissão e acesso',
    summary: 'Fluxo seguro para conceder acesso temporário ou resolver exceções sem abrir brechas.',
    estimatedMinutes: 5,
    category: 'Usuários',
    steps: [
      {
        title: 'Confirme a necessidade',
        description: 'Antes de alterar acesso, valide se a exceção é realmente necessária para a operação.',
      },
      {
        title: 'Escolha o menor acesso possível',
        description: 'Conceda apenas o nível suficiente para executar a tarefa em questão.',
      },
      {
        title: 'Defina prazo ou condição',
        description: 'Se for temporário, deixe claro quando o acesso deve ser revisto ou removido.',
      },
      {
        title: 'Registre a exceção',
        description: 'Anote o motivo e o responsável pela aprovação para facilitar auditoria posterior.',
      },
    ],
    notes: [
      'Exceção sem prazo vira risco recorrente.',
      'Menor privilégio é sempre a opção mais segura.',
    ],
  },
  {
    id: 'como-ligar-metricas-com-suporte-e-operacao',
    title: 'Como ligar métricas com suporte e operação',
    summary: 'Use o dashboard, tickets e pendências juntos para entender o que está afetando a operação.',
    estimatedMinutes: 6,
    category: 'Dados',
    steps: [
      {
        title: 'Compare indicadores e chamados',
        description: 'Veja se um aumento de tickets coincide com queda de conversão, falhas ou pendências.',
      },
      {
        title: 'Procure padrões repetidos',
        description: 'Identifique se o mesmo problema aparece em suporte, relatórios e notificações.',
      },
      {
        title: 'Atribua causa provável',
        description: 'Marque se o problema parece comercial, técnico, financeiro ou de conteúdo.',
      },
      {
        title: 'Crie um plano de ação',
        description: 'Registre o que será corrigido primeiro e o que precisa de acompanhamento adicional.',
      },
    ],
    notes: [
      'Métrica isolada costuma esconder a causa real.',
      'Conectar dados com suporte acelera a resolução.',
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

function mergeDefaultTutorials(existingTutorials: AdminTutorial[]) {
  const mergedTutorials = [...existingTutorials];
  const existingIds = new Set(existingTutorials.map((tutorial) => tutorial.id));

  defaultAdminTutorials.forEach((tutorial) => {
    if (!existingIds.has(tutorial.id)) {
      mergedTutorials.push(tutorial);
    }
  });

  return mergedTutorials;
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

    const mergedTutorials = tutorials.length > 0 ? mergeDefaultTutorials(tutorials) : defaultAdminTutorials;
    window.localStorage.setItem(ADMIN_TUTORIALS_STORAGE_KEY, JSON.stringify(mergedTutorials));

    return mergedTutorials;
  }
  catch {
    window.localStorage.setItem(ADMIN_TUTORIALS_STORAGE_KEY, JSON.stringify(defaultAdminTutorials));
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

function resolveRouteTutorialId(pathname: string) {
  const normalizedPath = pathname.trim();

  const routeMatchers: Array<{ test: RegExp; tutorialId: string }> = [
    { test: /^\/admin\/cursos\/[^/]+\/builder(?:\/.*)?$/, tutorialId: 'como-criar-e-importar-curso-ou-modulos-via-json' },
    { test: /^\/admin\/cursos$/, tutorialId: 'como-criar-e-importar-curso-ou-modulos-via-json' },
    { test: /^\/admin\/cursos\/[^/]+\/liberacoes$/, tutorialId: 'como-configurar-liberacao-de-conteudo' },
    { test: /^\/admin\/modulos\/[^/]+\/aulas$/, tutorialId: 'como-montar-modulos-aulas-e-materiais' },
    { test: /^\/admin\/aulas\/[^/]+\/materiais$/, tutorialId: 'como-montar-modulos-aulas-e-materiais' },
    { test: /^\/admin\/blog(?:\/.*)?$/, tutorialId: 'como-criar-artigo-blog' },
    { test: /^\/admin\/banners(?:\/.*)?$/, tutorialId: 'como-operar-campanhas-e-banners-com-versao' },
    { test: /^\/admin\/botoes-aula(?:\/.*)?$/, tutorialId: 'como-usar-botoes-de-aula-e-templates' },
    { test: /^\/admin\/configuracoes-site(?:\/.*)?$/, tutorialId: 'como-gerenciar-conta-e-branding-do-admin' },
    { test: /^\/admin\/faq(?:\/.*)?$/, tutorialId: 'como-manter-faq-e-central-de-suporte' },
    { test: /^\/admin\/formularios(?:\/.*)?$/, tutorialId: 'como-usar-formularios-publicos' },
    { test: /^\/admin\/grupos(?:\/.*)?$/, tutorialId: 'como-organizar-usuarios-e-grupos' },
    { test: /^\/admin\/mensagens(?:\/.*)?$/, tutorialId: 'como-configurar-notificacoes-e-mensagens' },
    { test: /^\/admin\/minha-conta(?:\/.*)?$/, tutorialId: 'como-gerenciar-conta-e-branding-do-admin' },
    { test: /^\/admin\/notificacoes(?:\/.*)?$/, tutorialId: 'como-configurar-notificacoes-e-mensagens' },
    { test: /^\/admin\/pagamentos(?:\/.*)?$/, tutorialId: 'como-revisar-pagamentos-e-repasses' },
    { test: /^\/admin\/pendencias(?:\/.*)?$/, tutorialId: 'como-tratar-pendencias-operacionais' },
    { test: /^\/admin\/recursos(?:\/.*)?$/, tutorialId: 'como-organizar-a-biblioteca-de-recursos-e-videos' },
    { test: /^\/admin\/relatorios(?:\/.*)?$/, tutorialId: 'como-revisar-relatorios-e-indicadores' },
    { test: /^\/admin\/repasses(?:\/.*)?$/, tutorialId: 'como-configurar-e-validar-repasses-financeiros' },
    { test: /^\/admin\/reviews(?:\/.*)?$/, tutorialId: 'como-moderar-reviews' },
    { test: /^\/admin\/seguranca(?:\/.*)?$/, tutorialId: 'como-monitorar-seguranca-e-acessos' },
    { test: /^\/admin\/site-editor(?:\/.*)?$/, tutorialId: 'como-usar-site-editor-para-paginas-institucionais' },
    { test: /^\/admin\/storage-r2(?:\/.*)?$/, tutorialId: 'como-usar-storage-r2' },
    { test: /^\/admin\/suporte(?:\/.*)?$/, tutorialId: 'como-atender-suporte-e-faq' },
    { test: /^\/admin\/tipos-quiz(?:\/.*)?$/, tutorialId: 'como-usar-avaliacoes-e-quiz' },
    { test: /^\/admin\/usuarios(?:\/.*)?$/, tutorialId: 'como-revisar-permissoes-grupos-e-acessos' },
    { test: /^\/admin\/cursos(?:\/.*)?$/, tutorialId: 'como-criar-curso' },
    { test: /^\/admin$/, tutorialId: 'visao-geral-painel-e-pendencias' },
  ];

  const matchedRoute = routeMatchers.find(({ test }) => test.test(normalizedPath));

  if (!matchedRoute) {
    return null;
  }

  if (normalizedPath === '/admin/tutoriais') {
    return null;
  }

  return matchedRoute.tutorialId;
}

type AdminTutorialsContextValue = {
  tutorials: AdminTutorial[];
  activeTutorialId: string;
  activeTutorial: AdminTutorial;
  routeTutorialId: string | null;
  routeTutorial: AdminTutorial | null;
  isDrawerOpen: boolean;
  isDrawerMinimized: boolean;
  openTutorial: (tutorialId?: string) => void;
  closeDrawer: () => void;
  minimizeDrawer: () => void;
  restoreDrawer: () => void;
  selectTutorial: (tutorialId: string) => void;
  syncRouteTutorialHint: (pathname: string) => void;
  addTutorial: (tutorial: AdminTutorialDraft) => AdminTutorial;
  updateTutorial: (tutorialId: string, tutorial: AdminTutorialDraft) => AdminTutorial;
  deleteTutorial: (tutorialId: string) => boolean;
  reorderTutorials: (tutorialIds: string[]) => void;
};

const AdminTutorialsContext = createContext<AdminTutorialsContextValue | null>(null);

export function AdminTutorialsProvider({ children }: { children: ReactNode }) {
  const [tutorials, setTutorials] = useState<AdminTutorial[]>(safeLoadTutorials);
  const [activeTutorialId, setActiveTutorialId] = useState(() => safeLoadTutorials()[0]?.id ?? '');
  const [routeTutorialId, setRouteTutorialId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerMinimized, setIsDrawerMinimized] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(ADMIN_TUTORIALS_STORAGE_KEY, JSON.stringify(tutorials));
  }, [tutorials]);

  const activeTutorial = useMemo(() => {
    return tutorials.find((tutorial) => tutorial.id === activeTutorialId) ?? tutorials[0] ?? defaultAdminTutorials[0];
  }, [activeTutorialId, tutorials]);

  const routeTutorial = useMemo(() => {
    return routeTutorialId ? tutorials.find((tutorial) => tutorial.id === routeTutorialId) ?? null : null;
  }, [routeTutorialId, tutorials]);

  useEffect(() => {
    if (!activeTutorial && tutorials[0]) {
      setActiveTutorialId(tutorials[0].id);
    }
  }, [activeTutorial, tutorials]);

  const syncRouteTutorialHint = useCallback((pathname: string) => {
    setRouteTutorialId(resolveRouteTutorialId(pathname));
  }, []);

  function openTutorial(tutorialId = routeTutorial?.id ?? tutorials[0]?.id ?? defaultAdminTutorials[0].id) {
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
    routeTutorialId,
    routeTutorial,
    isDrawerOpen,
    isDrawerMinimized,
    openTutorial,
    closeDrawer,
    minimizeDrawer,
    restoreDrawer,
    selectTutorial,
    syncRouteTutorialHint,
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
