import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  BookMarked,
  BookOpenText,
  BrainCircuit,
  BriefcaseBusiness,
  ClipboardCheck,
  Download,
  Facebook,
  FileText,
  Headphones,
  HeartPulse,
  Instagram,
  Landmark,
  Linkedin,
  MessageCircleMore,
  MessageSquareQuote,
  Mic,
  MonitorPlay,
  NotebookPen,
  Podcast,
  Presentation,
  Scale,
  ScrollText,
  Sigma,
  Sparkles,
  SquarePen,
  Target,
  Waypoints,
} from 'lucide-react'

export type GenflixPageKey = 'home' | 'courses' | 'about' | 'blog' | 'contact' | 'community' | 'resources' | 'support'

export interface GenflixNavLink {
  label: string
  href: string
  isInternal?: boolean
  pageKey?: GenflixPageKey
  requiresAuth?: boolean
}

export interface GenflixCategoryItem {
  label: string
  icon: LucideIcon
}

export interface GenflixCourseItem {
  id?: string
  slug: string
  title: string
  category: string
  mentor: string
  role: string
  image: string
  mentorImage?: string
  initials: string
}

export interface GenflixFeatureItem {
  title: string
  description: string
  icon: LucideIcon
}

export interface GenflixFooterColumn {
  title: string
  items: Array<{
    label: string
    href: string
    isInternal?: boolean
    openInNewTab?: boolean
    buttonLabel?: string
  }>
}

export interface GenflixSocialLink {
  label: string
  href: string
  icon: LucideIcon
}

export interface GenflixFooterNavItem {
  label: string
  href: string
  isInternal?: boolean
}

export interface GenflixCourseOutcome {
  title: string
  description: string
}

export interface GenflixCourseModule {
  title: string
  lessonCount: number
  summary: string
  items?: string[]
  lessonLabel?: string
}

export interface GenflixCourseDetail {
  id?: string
  slug: string
  categoryLine: string
  title: string
  coverImage: string
  description: string
  aboutParagraphs: string[]
  outcomes: GenflixCourseOutcome[]
  syllabus: GenflixCourseModule[]
  mentor: {
    name: string
    role: string
    bio: string
    initials: string
  }
  priceLabel: string
  secondaryPriceLabel: string
  includedItems: string[]
}

export interface GenflixBlogPost {
  slug: string
  title: string
  category: string
  excerpt: string
  image: string
  readTime: string
  author: string
  publishedAt: string
  content: string[]
  featured?: boolean
}

export interface GenflixCommunityItem {
  label: string
  icon: LucideIcon
  description: string
}

export interface GenflixResourceItem {
  label: string
  icon: LucideIcon
  description: string
}

export const genflixHeroImage = '/images/genflix/home/hero.jpg'
export const genflixNewsletterImage = '/images/genflix/home/newsletter.jpg'

export const genflixNavLinks: GenflixNavLink[] = [
  { label: 'Início', href: '/', isInternal: true, pageKey: 'home' },
  { label: 'Cursos', href: '/cursos', isInternal: true, pageKey: 'courses' },
  { label: 'Blog', href: '/blog', isInternal: true, pageKey: 'blog' },
  { label: 'Suporte', href: '/suporte', isInternal: true, pageKey: 'support' },
  { label: 'Contato', href: '/contato', isInternal: true, pageKey: 'contact' },
  { label: 'Sobre', href: '/sobre', isInternal: true, pageKey: 'about' },
  { label: 'Recursos', href: '/recursos', isInternal: true, pageKey: 'resources' },
  { label: 'Comunidade', href: '/comunidade', isInternal: true, pageKey: 'community', requiresAuth: true },
]

export const genflixFooterNavLinks: GenflixFooterNavItem[] = [
  { label: 'Início', href: '/', isInternal: true },
  { label: 'Sobre', href: '/sobre', isInternal: true },
  { label: 'Recursos', href: '/recursos', isInternal: true },
  { label: 'Cursos', href: '/cursos', isInternal: true },
  { label: 'Blog', href: '/blog', isInternal: true },
  { label: 'Suporte', href: '/suporte', isInternal: true },
  { label: 'Contato', href: '/contato', isInternal: true },
  { label: 'Comunidade', href: '/comunidade', isInternal: true },
]

export const genflixCategoryTiles: GenflixCategoryItem[] = [
  { label: 'Saúde', icon: HeartPulse },
  { label: 'Jurídicos', icon: Scale },
  { label: 'Exatas', icon: Sigma },
  { label: 'Gestão', icon: BriefcaseBusiness },
  { label: 'Humanas', icon: Landmark },
  { label: 'Psicanálise / Psicologia', icon: BrainCircuit },
  { label: 'Interesse Geral', icon: Sparkles },
]

export const genflixCommunityItems: GenflixCommunityItem[] = [
  {
    label: 'Saúde',
    icon: HeartPulse,
    description: 'Debates, dúvidas clínicas e troca de repertório entre profissionais e estudantes da área da saúde.',
  },
  {
    label: 'Direito',
    icon: Scale,
    description: 'Espaço para revisões, questões e conversas sobre prática jurídica, carreira e estudos.',
  },
  {
    label: 'Exatas',
    icon: Sigma,
    description: 'Compartilhe estratégias, exercícios e métodos de resolução com foco em clareza e constância.',
  },
  {
    label: 'Gestão',
    icon: BriefcaseBusiness,
    description: 'Troque experiências sobre liderança, processos, comunicação e rotina de times em crescimento.',
  },
  {
    label: 'Humanas',
    icon: Landmark,
    description: 'Converse sobre repertório, interpretação, leituras e formas de aprofundar sua visão crítica.',
  },
  {
    label: 'Psicanálise / Psicologia',
    icon: BrainCircuit,
    description: 'Uma comunidade para discutir teoria, clínica, escuta e formação com mais continuidade.',
  },
  {
    label: 'Interesse Geral',
    icon: Sparkles,
    description: 'Temas abertos, novidades da plataforma e conversas entre quem aprende de forma multidisciplinar.',
  },
]

export const genflixResourceItems: GenflixResourceItem[] = [
  { label: 'Textos diretos ao ponto', icon: ScrollText, description: 'Sínteses objetivas para revisar conceitos centrais sem perder profundidade.' },
  { label: 'Texto para fala', icon: Mic, description: 'Versões preparadas para narração e escuta, ideais para aprender em movimento.' },
  { label: 'Vídeos', icon: MonitorPlay, description: 'Aulas em vídeo organizadas por trilha, com acesso contínuo e linguagem clara.' },
  { label: 'Lives com autores', icon: Presentation, description: 'Encontros com especialistas para ampliar repertório e discutir temas atuais.' },
  { label: 'Bloco de notas pessoais', icon: NotebookPen, description: 'Espaço para registrar insights, referências e anotações do seu processo.' },
  { label: 'Fóruns de discussão', icon: MessageCircleMore, description: 'Debates e trocas com outros alunos para levar o estudo além da aula.' },
  { label: 'Descontos em livros do GEN', icon: BadgeCheck, description: 'Benefícios para conectar cursos GenFlix a livros acadêmicos do GEN.' },
  { label: 'Podcasts', icon: Podcast, description: 'Conteúdo em áudio para reforçar entendimento e manter constância no aprendizado.' },
  { label: 'Resumos', icon: FileText, description: 'Materiais de apoio com os pontos essenciais de cada módulo e tema estudado.' },
  { label: 'Mapas mentais', icon: Waypoints, description: 'Visões estruturadas dos assuntos para facilitar associação e memória.' },
  { label: 'Flashcards', icon: BookMarked, description: 'Cartões de revisão para fixação rápida com repetição espaçada.' },
  { label: 'Glossário de termos', icon: BookOpenText, description: 'Definições claras para conceitos-chave, siglas e linguagem técnica.' },
  { label: 'Download de suplementos', icon: Download, description: 'Arquivos extras e materiais complementares para aprofundar a trilha.' },
  { label: 'Questões discursivas', icon: MessageSquareQuote, description: 'Propostas de resposta aberta para desenvolver argumentação e clareza.' },
  { label: 'Estudos de casos', icon: SquarePen, description: 'Situações práticas para conectar teoria, análise e tomada de decisão.' },
  { label: 'Múltipla escolha', icon: Target, description: 'Questões objetivas para treinar retenção, ritmo e leitura estratégica.' },
  { label: 'Exercícios de progressão', icon: ClipboardCheck, description: 'Atividades organizadas por dificuldade para acompanhar sua evolução.' },
  { label: 'Preenchimento de lacunas', icon: SquarePen, description: 'Exercícios de completude para reforçar vocabulário e estruturas centrais.' },
]

export const genflixCatalogFilters = [
  'Todos',
  'Saúde',
  'Direito',
  'Exatas',
  'Gestão',
  'Humanas',
  'Psicologia',
  'Interesse Geral',
] as const

export const genflixCatalogCourses: GenflixCourseItem[] = [
  {
    slug: 'anatomia-clinica-aplicada',
    title: 'Anatomia Clínica Aplicada',
    category: 'Saúde',
    mentor: 'Dra. Carla Mendes',
    role: 'Especialista em anatomia clínica',
    image: '/images/genflix/home/featured-1.jpg',
    mentorImage: '/images/genflix/home/mentor-1.jpg',
    initials: 'CM',
  },
  {
    slug: 'aprovacao-oab-primeira-fase',
    title: 'Aprovação OAB 1ª Fase',
    category: 'Direito',
    mentor: 'Dr. Carlos Mendes',
    role: 'Mentor para carreiras jurídicas',
    image: '/images/genflix/home/featured-2.jpg',
    mentorImage: '/images/genflix/home/mentor-2.jpg',
    initials: 'CM',
  },
  {
    slug: 'estatistica-para-concursos',
    title: 'Estatística para Concursos',
    category: 'Exatas',
    mentor: 'Dra. Marina Costa',
    role: 'Professora de raciocínio quantitativo',
    image: '/images/genflix/home/featured-3.jpg',
    mentorImage: '/images/genflix/home/mentor-3.jpg',
    initials: 'MC',
  },
  {
    slug: 'gestao-de-equipes-na-pratica',
    title: 'Gestão de Equipes na Prática',
    category: 'Gestão',
    mentor: 'Prof. Rafael Lima',
    role: 'Consultor em liderança e processos',
    image: '/images/genflix/home/featured-4.jpg',
    mentorImage: '/images/genflix/home/mentor-4.jpg',
    initials: 'RL',
  },
  {
    slug: 'introducao-a-filosofia-politica',
    title: 'Introdução à Filosofia Política',
    category: 'Humanas',
    mentor: 'Prof. Carlos Mendes',
    role: 'Curadoria em pensamento político',
    image: '/images/genflix/home/featured-5.jpg',
    mentorImage: '/images/genflix/home/mentor-5.jpg',
    initials: 'CM',
  },
  {
    slug: 'fundamentos-da-psicanalise',
    title: 'Fundamentos da Psicanálise',
    category: 'Psicanálise / Psicologia',
    mentor: 'Dr. Carlos Mendes',
    role: 'Psicanalista e orientador clínico',
    image: '/images/genflix/home/featured-6.jpg',
    mentorImage: '/images/genflix/home/mentor-6.jpg',
    initials: 'CM',
  },
  {
    slug: 'bioestatistica-aplicada',
    title: 'Bioestatística Aplicada',
    category: 'Saúde',
    mentor: 'Dra. Helena Costa',
    role: 'Docente em análise de dados em saúde',
    image: '/images/genflix/home/featured-3.jpg',
    initials: 'HC',
  },
  {
    slug: 'legislacao-do-sus-e-regulacao',
    title: 'Legislação do SUS e Regulação',
    category: 'Direito',
    mentor: 'Dra. Juliana Prado',
    role: 'Advogada em direito público',
    image: '/images/genflix/home/featured-2.jpg',
    initials: 'JP',
  },
  {
    slug: 'raciocinio-logico-estrategico',
    title: 'Raciocínio Lógico Estratégico',
    category: 'Exatas',
    mentor: 'Prof. Victor Nogueira',
    role: 'Especialista em concursos e problemas lógicos',
    image: '/images/genflix/home/featured-1.jpg',
    initials: 'VN',
  },
  {
    slug: 'lideranca-em-ambientes-complexos',
    title: 'Liderança em Ambientes Complexos',
    category: 'Gestão',
    mentor: 'Prof. Rafael Lima',
    role: 'Consultor em cultura organizacional',
    image: '/images/genflix/home/featured-4.jpg',
    initials: 'RL',
  },
  {
    slug: 'escrita-academica-essencial',
    title: 'Escrita Acadêmica Essencial',
    category: 'Humanas',
    mentor: 'Profa. Elisa Duarte',
    role: 'Mentora de pesquisa e produção textual',
    image: '/images/genflix/home/featured-5.jpg',
    initials: 'ED',
  },
  {
    slug: 'psicopatologia-contemporanea',
    title: 'Psicopatologia Contemporânea',
    category: 'Psicanálise / Psicologia',
    mentor: 'Dra. Fernanda Moura',
    role: 'Supervisora clínica em saúde mental',
    image: '/images/genflix/home/featured-6.jpg',
    initials: 'FM',
  },
]

export const genflixFeaturedCourses = genflixCatalogCourses.slice(0, 6)

export const genflixStudyFeatures: GenflixFeatureItem[] = [
  {
    title: 'Videoaulas HD',
    description: 'Mais de 200 aulas gravadas em alta definição, organizadas por módulo e disponíveis para download offline.',
    icon: MonitorPlay,
  },
  {
    title: 'Flashcards',
    description: 'Mais de 1.500 cards com revisão espaçada adaptada ao seu ritmo e às matérias que você mais precisa.',
    icon: BookOpenText,
  },
  {
    title: 'Podcasts',
    description: 'Discussões aprofundadas dos temas mais cobrados, ideais para ouvir no deslocamento e fixar conteúdo.',
    icon: Headphones,
  },
  {
    title: 'Resumos PDF',
    description: 'Resumos densos e objetivos de cada módulo, com destaque dos pontos mais cobrados nas provas recentes.',
    icon: FileText,
  },
  {
    title: 'Simulados',
    description: 'Simulados no formato real das principais bancas, com gabarito comentado e análise de desempenho.',
    icon: ClipboardCheck,
  },
  {
    title: 'Certificado',
    description: 'Certificado digital de conclusão reconhecido, pronto para incluir no currículo e no perfil profissional.',
    icon: BadgeCheck,
  },
]

const defaultIncludedItems = [
  'Mentorias exclusivas',
  'Certificado de conclusão',
  'Videoaulas HD ilimitadas',
  'Ferramentas de estudo',
  'Plantões de dúvidas',
  'Atualizações contínuas',
]

const categoryCoursePrefixes: Record<string, string> = {
  Saúde: 'SAÚDE - ONLINE',
  Direito: 'DIREITO - ONLINE',
  Exatas: 'EXATAS - ONLINE',
  Gestão: 'GESTÃO - ONLINE',
  Humanas: 'HUMANAS - ONLINE',
  'Psicanálise / Psicologia': 'PSICOLOGIA - ONLINE',
}

const categoryAboutIntroductions: Record<string, string[]> = {
  Saúde: [
    'Este curso foi estruturado para transformar conteúdo técnico em aplicação clínica segura, com explicações objetivas, materiais de revisão e acompanhamento do que realmente importa para a tomada de decisão profissional.',
    'Ao longo da jornada, você encontra aulas organizadas por blocos de estudo, simulados comentados e ferramentas de memorização para acelerar a curva de aprendizado sem perder profundidade.',
  ],
  Direito: [
    'O programa foi desenhado para organizar o estudo jurídico em ciclos claros, com foco em leitura estratégica de lei seca, interpretação de questões e consolidação das teses mais recorrentes.',
    'Além das aulas e revisões orientadas, o curso reúne simulados comentados e rotinas de prática pensadas para reduzir dispersão e aumentar consistência até a prova.',
  ],
  Exatas: [
    'O conteúdo combina fundamentação conceitual, resolução guiada de exercícios e leitura de padrões para ajudar você a enxergar método onde antes parecia só dificuldade.',
    'Com trilhas progressivas de treino, o curso sustenta evolução prática em interpretação, agilidade de cálculo e domínio das estruturas que mais aparecem nas avaliações.',
  ],
  Gestão: [
    'A proposta é aproximar teoria e execução, traduzindo conceitos de liderança, processos e gestão de pessoas em rotinas que funcionam no dia a dia de equipes reais.',
    'Você percorre ferramentas de organização, comunicação e tomada de decisão com apoio de materiais complementares que facilitam implementação imediata.',
  ],
  Humanas: [
    'O curso organiza autores, movimentos e debates centrais em uma trilha clara, ajudando você a construir repertório, interpretar contextos e argumentar com segurança.',
    'A metodologia combina leitura orientada, sínteses críticas e recursos de fixação para ampliar profundidade sem tornar o estudo excessivamente abstrato.',
  ],
  'Psicanálise / Psicologia': [
    'A trilha foi pensada para conectar teoria, escuta clínica e leitura de casos, oferecendo uma base consistente para quem deseja aprofundar repertório conceitual e sensibilidade técnica.',
    'Com aulas densas, materiais de apoio e exercícios de revisão, o curso ajuda você a consolidar linguagem, escola teórica e aplicações contemporâneas.',
  ],
}

const categoryOutcomeTemplates: Record<string, GenflixCourseOutcome[]> = {
  Saúde: [
    { title: 'Dominar critérios técnicos', description: 'Entenda prioridades clínicas, leitura de sinais e critérios usados na prática profissional.' },
    { title: 'Organizar sua revisão', description: 'Monte um fluxo de estudo com simulados, resumos e ferramentas de memorização contínua.' },
    { title: 'Resolver casos com segurança', description: 'Treine raciocínio aplicado em situações frequentes das provas e da rotina assistencial.' },
    { title: 'Atualizar-se com confiança', description: 'Acompanhe mudanças de protocolo e mantenha o conteúdo alinhado ao cenário atual.' },
  ],
  Direito: [
    { title: 'Mapear temas de alta incidência', description: 'Priorize assuntos que mais aparecem nas provas e construa um plano de avanço realista.' },
    { title: 'Interpretar questões com método', description: 'Treine leitura de enunciados, eliminação de alternativas e revisão por desempenho.' },
    { title: 'Consolidar lei seca e jurisprudência', description: 'Conecte teoria, texto legal e entendimento prático sem estudar de forma fragmentada.' },
    { title: 'Ganhar ritmo até a prova', description: 'Crie uma rotina consistente para revisar, testar e corrigir pontos fracos.' },
  ],
  Exatas: [
    { title: 'Compreender fundamentos sem decorar', description: 'Aprenda os conceitos-base que sustentam questões e aplicações quantitativas.' },
    { title: 'Resolver com estratégia', description: 'Use atalhos, leitura de padrão e lógica de resolução para ganhar velocidade.' },
    { title: 'Reduzir erros recorrentes', description: 'Identifique os pontos em que você mais falha e corrija a raiz do problema.' },
    { title: 'Aumentar sua confiança em provas', description: 'Treine com progressão de dificuldade e simulados dirigidos.' },
  ],
  Gestão: [
    { title: 'Liderar com clareza', description: 'Transforme conceitos de liderança em práticas objetivas para coordenação de times.' },
    { title: 'Tomar decisões com contexto', description: 'Analise cenários, organize prioridades e conduza processos com mais previsibilidade.' },
    { title: 'Melhorar comunicação e rotina', description: 'Estruture rituais, alinhamentos e acompanhamento de entregas com menos fricção.' },
    { title: 'Aplicar melhorias rapidamente', description: 'Leve os aprendizados para o trabalho com ferramentas simples e acionáveis.' },
  ],
  Humanas: [
    { title: 'Construir repertório sólido', description: 'Entenda autores, correntes e contextos sem perder a linha histórica.' },
    { title: 'Ler textos complexos com fluidez', description: 'Desenvolva uma rotina de interpretação e síntese mais inteligente.' },
    { title: 'Argumentar melhor', description: 'Conecte conceitos e organize respostas com mais clareza e densidade analítica.' },
    { title: 'Fixar temas de longa duração', description: 'Use revisão guiada para manter domínio dos tópicos ao longo do tempo.' },
  ],
  'Psicanálise / Psicologia': [
    { title: 'Consolidar fundamentos teóricos', description: 'Estude conceitos centrais e escolas de pensamento com progressão clara.' },
    { title: 'Aprimorar leitura clínica', description: 'Desenvolva sensibilidade para observar linguagem, caso e contexto com mais profundidade.' },
    { title: 'Articular teoria e prática', description: 'Relacione autores, conceitos e aplicações contemporâneas de forma consistente.' },
    { title: 'Ganhar repertório para supervisão', description: 'Chegue mais preparado para discussão de casos e aprofundamento profissional.' },
  ],
}

function buildCourseModules(course: GenflixCourseItem): GenflixCourseModule[] {
  return [
    {
      title: `Dominar os fundamentos de ${course.title.toLowerCase()}`,
      lessonCount: 12,
      summary: 'Conceitos-base, organização da trilha e leitura do cenário geral do curso.',
    },
    {
      title: `Aplicações práticas em ${course.category.toLowerCase()}`,
      lessonCount: 8,
      summary: 'Casos, exercícios dirigidos e modelos de execução para ganhar segurança técnica.',
    },
    {
      title: 'Revisão estratégica e fixação',
      lessonCount: 10,
      summary: 'Ferramentas de reforço, simulados comentados e revisão inteligente por desempenho.',
    },
    {
      title: 'Plano de continuidade e atualização',
      lessonCount: 6,
      summary: 'Como manter o estudo ativo, acompanhar novidades e sustentar avanço após a trilha principal.',
    },
  ]
}

function buildCourseDetail(course: GenflixCourseItem, overrides: Partial<GenflixCourseDetail> = {}): GenflixCourseDetail {
  const aboutParagraphs = categoryAboutIntroductions[course.category] ?? categoryAboutIntroductions.Humanas
  const outcomes = categoryOutcomeTemplates[course.category] ?? categoryOutcomeTemplates.Humanas

  return {
    slug: course.slug,
    categoryLine: categoryCoursePrefixes[course.category] ?? `${course.category.toUpperCase()} - ONLINE`,
    title: course.title,
    coverImage: course.image,
    description: `${course.title} reúne uma trilha prática com aulas objetivas, revisão guiada e ferramentas de estudo para quem quer avançar com consistência.`,
    aboutParagraphs,
    outcomes,
    syllabus: buildCourseModules(course),
    mentor: {
      name: course.mentor,
      role: course.role,
      bio: `Curadoria acadêmica e acompanhamento pedagógico conduzidos por ${course.mentor}, com experiência aplicada em ${course.category.toLowerCase()}.`,
      initials: course.initials,
    },
    priceLabel: 'R$ 294,90',
    secondaryPriceLabel: 'Acesso imediato + materiais inclusos',
    includedItems: defaultIncludedItems,
    ...overrides,
  }
}

export const genflixCourseDetails: Record<string, GenflixCourseDetail> = Object.fromEntries(
  genflixCatalogCourses.map((course) => [
    course.slug,
    buildCourseDetail(
      course,
      course.slug === 'anatomia-clinica-aplicada'
        ? {
            description: 'Uma trilha intensiva para transformar anatomia em leitura clínica aplicada, com linguagem clara, prática guiada e recursos que aceleram a retenção do conteúdo.',
            aboutParagraphs: [
              'Este é o curso ideal para quem precisa consolidar anatomia clínica sem estudar de forma fragmentada. A trilha foi organizada para conectar estruturas, função e interpretação aplicada ao contexto profissional.',
              'Com videoaulas objetivas, simulados comentados, resumos e ferramentas de revisão ativa, você avança com mais clareza, reduz a dispersão e ganha segurança para aplicar o conteúdo em situações reais.',
            ],
            outcomes: [
              { title: 'Ler anatomia com mais clareza', description: 'Reconheça estruturas, relações e pontos de atenção com foco clínico.' },
              { title: 'Conectar teoria e prática', description: 'Transforme conteúdos densos em decisões mais seguras no estudo e no trabalho.' },
              { title: 'Revisar com menos esforço', description: 'Use resumos, simulados e ferramentas de repetição para fixar o essencial.' },
              { title: 'Construir base para avançar', description: 'Chegue mais preparado para módulos seguintes, provas e discussões clínicas.' },
            ],
          }
        : {},
    ),
  ]),
)

const baseBlogPosts: Omit<GenflixBlogPost, 'slug' | 'category' | 'title'>[] = [
  {
    excerpt: 'Como organizar uma rotina de estudos consistente, com revisão ativa, blocos curtos e foco real no que precisa avançar.',
    image: '/images/genflix/home/featured-1.jpg',
    readTime: '6 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '09 abr 2026',
    content: [
      'Estudar melhor não é apenas estudar mais. Uma rotina consistente nasce da clareza sobre prioridades, da definição de blocos possíveis e da revisão frequente do que foi aprendido.',
      'Na prática, isso significa alternar teoria, exercícios e momentos curtos de retomada. Quando você organiza o estudo dessa forma, a retenção melhora e a sensação de progresso deixa de depender apenas de volume.',
      'No GenFlix, esse princípio aparece em trilhas pensadas para manter ritmo, reduzir dispersão e transformar aprendizado em avanço concreto.',
    ],
    featured: true,
  },
  {
    excerpt: 'Recursos complementares, simulados e revisão espaçada podem mudar completamente a forma como você aprende e fixa conteúdo.',
    image: '/images/genflix/home/featured-2.jpg',
    readTime: '5 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '08 abr 2026',
    content: [
      'A aula é o ponto de partida, não o destino final. Quando o estudo inclui resumos, questões, flashcards e retomadas curtas, o conteúdo passa a circular melhor na memória.',
      'Isso reduz o efeito de assistir, entender na hora e esquecer depois. Recursos complementares existem justamente para sustentar o aprendizado além do momento da explicação.',
      'A combinação entre vídeo, prática e revisão é o que torna a experiência mais completa e eficiente.',
    ],
  },
  {
    excerpt: 'Ler melhor, resumir melhor e argumentar melhor também são habilidades treináveis. Pequenos ajustes de método fazem diferença.',
    image: '/images/genflix/home/featured-3.jpg',
    readTime: '4 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '07 abr 2026',
    content: [
      'Em áreas densas, a dificuldade muitas vezes não está no conteúdo em si, mas na forma como ele é abordado. Quando a leitura é passiva, o entendimento tende a se dissipar rapidamente.',
      'Criar sínteses curtas, responder perguntas-chave e testar a própria interpretação são hábitos simples que elevam a qualidade do estudo.',
      'Com o tempo, isso fortalece a autonomia e melhora a capacidade de conectar conceitos.',
    ],
  },
  {
    excerpt: 'Aprender com mais profundidade não exige rigidez extrema. Exige constância, repertório e um ambiente que favoreça continuidade.',
    image: '/images/genflix/home/featured-4.jpg',
    readTime: '5 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '06 abr 2026',
    content: [
      'Muita gente desiste não por falta de capacidade, mas por excesso de atrito. Quando estudar parece sempre pesado demais, a tendência é interromper antes de ganhar ritmo.',
      'Um bom ambiente de aprendizagem reduz esse atrito com clareza de trilha, progressão visível e materiais que acompanham o aluno em diferentes momentos da rotina.',
      'Consistência nasce quando o caminho é mais sustentável.',
    ],
  },
  {
    excerpt: 'O que diferencia um bom plano de estudos é sua capacidade de se adaptar ao seu contexto sem perder direção.',
    image: '/images/genflix/home/featured-5.jpg',
    readTime: '7 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '05 abr 2026',
    content: [
      'Planejamento bom não é o que parece bonito na agenda; é o que continua funcionando quando a semana fica mais apertada.',
      'Em vez de depender de blocos longos e ideais, vale construir um plano com prioridades claras, revisões inteligentes e flexibilidade controlada.',
      'Assim, você preserva continuidade mesmo quando a rotina muda.',
    ],
  },
  {
    excerpt: 'A revisão certa no momento certo reduz esquecimento e aumenta confiança antes de provas, avaliações e tomadas de decisão reais.',
    image: '/images/genflix/home/featured-6.jpg',
    readTime: '5 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '04 abr 2026',
    content: [
      'Revisar não significa reler tudo desde o início. Significa identificar o que precisa voltar para a memória e em qual formato isso funciona melhor.',
      'Mapas rápidos, flashcards, listas curtas e simulados comentados são exemplos de ferramentas que tornam a revisão mais objetiva.',
      'Com esse tipo de apoio, a confiança deixa de ser só sensação e passa a vir de evidência prática.',
    ],
  },
  {
    excerpt: 'Mais do que acompanhar tendências, vale entender o que realmente faz diferença quando o objetivo é aprender com aplicação.',
    image: '/images/genflix/home/hero.jpg',
    readTime: '6 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '03 abr 2026',
    content: [
      'Ferramentas educacionais aparecem o tempo inteiro, mas nem toda novidade melhora a experiência de aprender.',
      'O critério principal continua sendo utilidade: ajuda a entender? ajuda a revisar? ajuda a aplicar? Se a resposta for não, é só ruído.',
      'A construção de uma boa jornada passa por escolhas simples, consistentes e centradas no aluno.',
    ],
  },
]

const blogCategories = ['Saúde', 'Direito', 'Exatas', 'Gestão', 'Humanas', 'Psicologia', 'Interesse Geral'] as const

export const genflixBlogFilters = ['Todos', ...blogCategories] as const

export const genflixBlogPosts: GenflixBlogPost[] = baseBlogPosts.map((post, index) => {
  const category = blogCategories[index % blogCategories.length]

  return {
    slug: `artigo-genflix-${index + 1}`,
    category,
    title:
      index === 0
        ? 'Conteúdo feito por quem ensina, para quem quer ir além'
        : [
            'Como estudar com mais clareza e menos dispersão',
            'Os recursos que tornam o aprendizado mais completo',
            'Método, revisão e autonomia intelectual',
            'O que sustenta uma rotina de estudo de verdade',
            'Planejamento realista para quem precisa continuar',
            'Revisão inteligente para fixar melhor',
            'O que realmente vale na educação digital',
          ][index - 1] ?? `Artigo GenFlix ${index + 1}`,
    ...post,
  }
})

export const genflixFeaturedBlogPost =
  genflixBlogPosts.find((post) => post.featured) ?? genflixBlogPosts[0]

export function getGenflixCourseBySlug(slug: string) {
  return genflixCatalogCourses.find((course) => course.slug === slug) ?? null
}

export function getGenflixCourseDetailBySlug(slug: string) {
  return genflixCourseDetails[slug] ?? null
}

export function getGenflixBlogPostBySlug(slug: string) {
  return genflixBlogPosts.find((post) => post.slug === slug) ?? null
}

export const genflixFooterColumns: GenflixFooterColumn[] = [
  {
    title: 'Links Rápidos',
    items: [
      { label: 'Política de privacidade', href: '/privacidade', isInternal: true },
      { label: 'Política de reembolso', href: '/politica-de-reembolso', isInternal: true },
      { label: 'Perguntas frequentes', href: '/suporte#perguntas-frequentes', isInternal: true },
      { label: 'Ajuda / Como usar', href: '/ajuda', isInternal: true },
      { label: 'Suporte', href: '/suporte', isInternal: true },
    ],
  },
  {
    title: 'Fale com a GenFlix',
    items: [
      { label: 'Contato', href: '/contato', isInternal: true },
      { label: 'Cadastro', href: '/criar-conta', isInternal: true },
    ],
  },
  {
    title: 'Conecte-se',
    items: [
      { label: 'Instagram', href: 'https://instagram.com', openInNewTab: true },
      { label: 'Facebook', href: 'https://facebook.com', openInNewTab: true },
      { label: 'TikTok', href: 'https://tiktok.com', openInNewTab: true },
      { label: 'Linkedin', href: 'https://linkedin.com', openInNewTab: true },
      { label: 'Youtube', href: 'https://youtube.com', openInNewTab: true },
      { label: 'Indique a GenFlix', href: '/indique-a-genflix', isInternal: true },
    ],
  },
  {
    title: 'Parcerias',
    items: [
      {
        label: 'Ensine na GenFlix',
        href: '/ensine-na-genflix',
        isInternal: true,
        buttonLabel: 'Ensine na GenFlix',
      },
    ],
  },
]

export const genflixSocialLinks: GenflixSocialLink[] = [
  { label: 'Instagram', href: 'https://instagram.com', icon: Instagram },
  { label: 'Facebook', href: 'https://facebook.com', icon: Facebook },
  { label: 'TikTok', href: 'https://tiktok.com', icon: MessageCircleMore },
  { label: 'LinkedIn', href: 'https://linkedin.com', icon: Linkedin },
  { label: 'YouTube', href: 'https://youtube.com', icon: MonitorPlay },
]
