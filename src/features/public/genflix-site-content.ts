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
  bonusSection: {
    enabled: boolean
    title: string
    description: string
  }
}

export interface GenflixBlogPost {
  slug: string
  title: string
  category: string
  seoDescription: string
  image: string
  readTime: string
  author: string
  publishedAt: string
  content: string[]
  contentHtml?: string
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
  { label: 'InÃ­cio', href: '/', isInternal: true, pageKey: 'home' },
  { label: 'Cursos', href: '/cursos', isInternal: true, pageKey: 'courses' },
  { label: 'Blog', href: '/blog', isInternal: true, pageKey: 'blog' },
  { label: 'Suporte', href: '/suporte', isInternal: true, pageKey: 'support' },
  { label: 'Contato', href: '/contato', isInternal: true, pageKey: 'contact' },
  { label: 'Sobre', href: '/sobre', isInternal: true, pageKey: 'about' },
  { label: 'Recursos', href: '/recursos', isInternal: true, pageKey: 'resources' },
  { label: 'Comunidade', href: '/comunidade', isInternal: true, pageKey: 'community', requiresAuth: true },
]

export const genflixFooterNavLinks: GenflixFooterNavItem[] = [
  { label: 'InÃ­cio', href: '/', isInternal: true },
  { label: 'Sobre', href: '/sobre', isInternal: true },
  { label: 'Recursos', href: '/recursos', isInternal: true },
  { label: 'Cursos', href: '/cursos', isInternal: true },
  { label: 'Blog', href: '/blog', isInternal: true },
  { label: 'Suporte', href: '/suporte', isInternal: true },
  { label: 'Contato', href: '/contato', isInternal: true },
  { label: 'Comunidade', href: '/comunidade', isInternal: true },
]

export const genflixCategoryTiles: GenflixCategoryItem[] = [
  { label: 'SaÃºde', icon: HeartPulse },
  { label: 'JurÃ­dicos', icon: Scale },
  { label: 'Exatas', icon: Sigma },
  { label: 'GestÃ£o', icon: BriefcaseBusiness },
  { label: 'Humanas', icon: Landmark },
  { label: 'PsicanÃ¡lise / Psicologia', icon: BrainCircuit },
  { label: 'Interesse Geral', icon: Sparkles },
]

export const genflixCommunityItems: GenflixCommunityItem[] = [
  {
    label: 'SaÃºde',
    icon: HeartPulse,
    description: 'Debates, dÃºvidas clÃ­nicas e troca de repertÃ³rio entre profissionais e estudantes da Ã¡rea da saÃºde.',
  },
  {
    label: 'Direito',
    icon: Scale,
    description: 'EspaÃ§o para revisÃµes, questÃµes e conversas sobre prÃ¡tica jurÃ­dica, carreira e estudos.',
  },
  {
    label: 'Exatas',
    icon: Sigma,
    description: 'Compartilhe estratÃ©gias, exercÃ­cios e mÃ©todos de resoluÃ§Ã£o com foco em clareza e constÃ¢ncia.',
  },
  {
    label: 'GestÃ£o',
    icon: BriefcaseBusiness,
    description: 'Troque experiÃªncias sobre lideranÃ§a, processos, comunicaÃ§Ã£o e rotina de times em crescimento.',
  },
  {
    label: 'Humanas',
    icon: Landmark,
    description: 'Converse sobre repertÃ³rio, interpretaÃ§Ã£o, leituras e formas de aprofundar sua visÃ£o crÃ­tica.',
  },
  {
    label: 'PsicanÃ¡lise / Psicologia',
    icon: BrainCircuit,
    description: 'Uma comunidade para discutir teoria, clÃ­nica, escuta e formaÃ§Ã£o com mais continuidade.',
  },
  {
    label: 'Interesse Geral',
    icon: Sparkles,
    description: 'Temas abertos, novidades da plataforma e conversas entre quem aprende de forma multidisciplinar.',
  },
]

export const genflixResourceItems: GenflixResourceItem[] = [
  { label: 'Textos diretos ao ponto', icon: ScrollText, description: 'SÃ­nteses objetivas para revisar conceitos centrais sem perder profundidade.' },
  { label: 'Texto para fala', icon: Mic, description: 'VersÃµes preparadas para narraÃ§Ã£o e escuta, ideais para aprender em movimento.' },
  { label: 'VÃ­deos', icon: MonitorPlay, description: 'Aulas em vÃ­deo organizadas por trilha, com acesso contÃ­nuo e linguagem clara.' },
  { label: 'Lives com autores', icon: Presentation, description: 'Encontros com especialistas para ampliar repertÃ³rio e discutir temas atuais.' },
  { label: 'Bloco de notas pessoais', icon: NotebookPen, description: 'EspaÃ§o para registrar insights, referÃªncias e anotaÃ§Ãµes do seu processo.' },
  { label: 'FÃ³runs de discussÃ£o', icon: MessageCircleMore, description: 'Debates e trocas com outros alunos para levar o estudo alÃ©m da aula.' },
  { label: 'Descontos em livros do GEN', icon: BadgeCheck, description: 'BenefÃ­cios para conectar cursos GenFlix a livros acadÃªmicos do GEN.' },
  { label: 'Podcasts', icon: Podcast, description: 'ConteÃºdo em Ã¡udio para reforÃ§ar entendimento e manter constÃ¢ncia no aprendizado.' },
  { label: 'Resumos', icon: FileText, description: 'Materiais de apoio com os pontos essenciais de cada mÃ³dulo e tema estudado.' },
  { label: 'Mapas mentais', icon: Waypoints, description: 'VisÃµes estruturadas dos assuntos para facilitar associaÃ§Ã£o e memÃ³ria.' },
  { label: 'Flashcards', icon: BookMarked, description: 'CartÃµes de revisÃ£o para fixaÃ§Ã£o rÃ¡pida com repetiÃ§Ã£o espaÃ§ada.' },
  { label: 'GlossÃ¡rio de termos', icon: BookOpenText, description: 'DefiniÃ§Ãµes claras para conceitos-chave, siglas e linguagem tÃ©cnica.' },
  { label: 'Download de suplementos', icon: Download, description: 'Arquivos extras e materiais complementares para aprofundar a trilha.' },
  { label: 'QuestÃµes discursivas', icon: MessageSquareQuote, description: 'Propostas de resposta aberta para desenvolver argumentaÃ§Ã£o e clareza.' },
  { label: 'Estudos de casos', icon: SquarePen, description: 'SituaÃ§Ãµes prÃ¡ticas para conectar teoria, anÃ¡lise e tomada de decisÃ£o.' },
  { label: 'MÃºltipla escolha', icon: Target, description: 'QuestÃµes objetivas para treinar retenÃ§Ã£o, ritmo e leitura estratÃ©gica.' },
  { label: 'ExercÃ­cios de progressÃ£o', icon: ClipboardCheck, description: 'Atividades organizadas por dificuldade para acompanhar sua evoluÃ§Ã£o.' },
  { label: 'Preenchimento de lacunas', icon: SquarePen, description: 'ExercÃ­cios de completude para reforÃ§ar vocabulÃ¡rio e estruturas centrais.' },
]

export const genflixCatalogFilters = [
  'Todos',
  'SaÃºde',
  'Direito',
  'Exatas',
  'GestÃ£o',
  'Humanas',
  'Psicologia',
  'Interesse Geral',
] as const

export const genflixCatalogCourses: GenflixCourseItem[] = [
  {
    slug: 'anatomia-clinica-aplicada',
    title: 'Anatomia ClÃ­nica Aplicada',
    category: 'SaÃºde',
    mentor: 'Dra. Carla Mendes',
    role: 'Especialista em anatomia clÃ­nica',
    image: '/images/genflix/home/featured-1.jpg',
    mentorImage: '/images/genflix/home/mentor-1.jpg',
    initials: 'CM',
  },
  {
    slug: 'aprovacao-oab-primeira-fase',
    title: 'AprovaÃ§Ã£o OAB 1Âª Fase',
    category: 'Direito',
    mentor: 'Dr. Carlos Mendes',
    role: 'Mentor para carreiras jurÃ­dicas',
    image: '/images/genflix/home/featured-2.jpg',
    mentorImage: '/images/genflix/home/mentor-2.jpg',
    initials: 'CM',
  },
  {
    slug: 'estatistica-para-concursos',
    title: 'EstatÃ­stica para Concursos',
    category: 'Exatas',
    mentor: 'Dra. Marina Costa',
    role: 'Professora de raciocÃ­nio quantitativo',
    image: '/images/genflix/home/featured-3.jpg',
    mentorImage: '/images/genflix/home/mentor-3.jpg',
    initials: 'MC',
  },
  {
    slug: 'gestao-de-equipes-na-pratica',
    title: 'GestÃ£o de Equipes na PrÃ¡tica',
    category: 'GestÃ£o',
    mentor: 'Prof. Rafael Lima',
    role: 'Consultor em lideranÃ§a e processos',
    image: '/images/genflix/home/featured-4.jpg',
    mentorImage: '/images/genflix/home/mentor-4.jpg',
    initials: 'RL',
  },
  {
    slug: 'introducao-a-filosofia-politica',
    title: 'IntroduÃ§Ã£o Ã  Filosofia PolÃ­tica',
    category: 'Humanas',
    mentor: 'Prof. Carlos Mendes',
    role: 'Curadoria em pensamento polÃ­tico',
    image: '/images/genflix/home/featured-5.jpg',
    mentorImage: '/images/genflix/home/mentor-5.jpg',
    initials: 'CM',
  },
  {
    slug: 'fundamentos-da-psicanalise',
    title: 'Fundamentos da PsicanÃ¡lise',
    category: 'PsicanÃ¡lise / Psicologia',
    mentor: 'Dr. Carlos Mendes',
    role: 'Psicanalista e orientador clÃ­nico',
    image: '/images/genflix/home/featured-6.jpg',
    mentorImage: '/images/genflix/home/mentor-6.jpg',
    initials: 'CM',
  },
  {
    slug: 'bioestatistica-aplicada',
    title: 'BioestatÃ­stica Aplicada',
    category: 'SaÃºde',
    mentor: 'Dra. Helena Costa',
    role: 'Docente em anÃ¡lise de dados em saÃºde',
    image: '/images/genflix/home/featured-3.jpg',
    initials: 'HC',
  },
  {
    slug: 'legislacao-do-sus-e-regulacao',
    title: 'LegislaÃ§Ã£o do SUS e RegulaÃ§Ã£o',
    category: 'Direito',
    mentor: 'Dra. Juliana Prado',
    role: 'Advogada em direito pÃºblico',
    image: '/images/genflix/home/featured-2.jpg',
    initials: 'JP',
  },
  {
    slug: 'raciocinio-logico-estrategico',
    title: 'RaciocÃ­nio LÃ³gico EstratÃ©gico',
    category: 'Exatas',
    mentor: 'Prof. Victor Nogueira',
    role: 'Especialista em concursos e problemas lÃ³gicos',
    image: '/images/genflix/home/featured-1.jpg',
    initials: 'VN',
  },
  {
    slug: 'lideranca-em-ambientes-complexos',
    title: 'LideranÃ§a em Ambientes Complexos',
    category: 'GestÃ£o',
    mentor: 'Prof. Rafael Lima',
    role: 'Consultor em cultura organizacional',
    image: '/images/genflix/home/featured-4.jpg',
    initials: 'RL',
  },
  {
    slug: 'escrita-academica-essencial',
    title: 'Escrita AcadÃªmica Essencial',
    category: 'Humanas',
    mentor: 'Profa. Elisa Duarte',
    role: 'Mentora de pesquisa e produÃ§Ã£o textual',
    image: '/images/genflix/home/featured-5.jpg',
    initials: 'ED',
  },
  {
    slug: 'psicopatologia-contemporanea',
    title: 'Psicopatologia ContemporÃ¢nea',
    category: 'PsicanÃ¡lise / Psicologia',
    mentor: 'Dra. Fernanda Moura',
    role: 'Supervisora clÃ­nica em saÃºde mental',
    image: '/images/genflix/home/featured-6.jpg',
    initials: 'FM',
  },
]

export const genflixFeaturedCourses = genflixCatalogCourses.slice(0, 6)

export const genflixStudyFeatures: GenflixFeatureItem[] = [
  {
    title: 'Videoaulas HD',
    description: 'Mais de 200 aulas gravadas em alta definiÃ§Ã£o, organizadas por mÃ³dulo e disponÃ­veis para download offline.',
    icon: MonitorPlay,
  },
  {
    title: 'Flashcards',
    description: 'Mais de 1.500 cards com revisÃ£o espaÃ§ada adaptada ao seu ritmo e Ã s matÃ©rias que vocÃª mais precisa.',
    icon: BookOpenText,
  },
  {
    title: 'Podcasts',
    description: 'DiscussÃµes aprofundadas dos temas mais cobrados, ideais para ouvir no deslocamento e fixar conteÃºdo.',
    icon: Headphones,
  },
  {
    title: 'Resumos PDF',
    description: 'Resumos densos e objetivos de cada mÃ³dulo, com destaque dos pontos mais cobrados nas provas recentes.',
    icon: FileText,
  },
  {
    title: 'Simulados',
    description: 'Simulados no formato real das principais bancas, com gabarito comentado e anÃ¡lise de desempenho.',
    icon: ClipboardCheck,
  },
  {
    title: 'Certificado',
    description: 'Certificado digital de conclusÃ£o reconhecido, pronto para incluir no currÃ­culo e no perfil profissional.',
    icon: BadgeCheck,
  },
]

const defaultIncludedItems = [
  'Mentorias exclusivas',
  'Certificado de conclusÃ£o',
  'Videoaulas HD ilimitadas',
  'Ferramentas de estudo',
  'PlantÃµes de dÃºvidas',
  'AtualizaÃ§Ãµes contÃ­nuas',
]

const categoryCoursePrefixes: Record<string, string> = {
  SaÃºde: 'SAÃšDE - ONLINE',
  Direito: 'DIREITO - ONLINE',
  Exatas: 'EXATAS - ONLINE',
  'GestÃ£o': 'GESTÃƒO - ONLINE',
  Humanas: 'HUMANAS - ONLINE',
  'PsicanÃ¡lise / Psicologia': 'PSICOLOGIA - ONLINE',
}

const categoryAboutIntroductions: Record<string, string[]> = {
  SaÃºde: [
    'Este curso foi estruturado para transformar conteÃºdo tÃ©cnico em aplicaÃ§Ã£o clÃ­nica segura, com explicaÃ§Ãµes objetivas, materiais de revisÃ£o e acompanhamento do que realmente importa para a tomada de decisÃ£o profissional.',
    'Ao longo da jornada, vocÃª encontra aulas organizadas por blocos de estudo, simulados comentados e ferramentas de memorizaÃ§Ã£o para acelerar a curva de aprendizado sem perder profundidade.',
  ],
  Direito: [
    'O programa foi desenhado para organizar o estudo jurÃ­dico em ciclos claros, com foco em leitura estratÃ©gica de lei seca, interpretaÃ§Ã£o de questÃµes e consolidaÃ§Ã£o das teses mais recorrentes.',
    'AlÃ©m das aulas e revisÃµes orientadas, o curso reÃºne simulados comentados e rotinas de prÃ¡tica pensadas para reduzir dispersÃ£o e aumentar consistÃªncia atÃ© a prova.',
  ],
  Exatas: [
    'O conteÃºdo combina fundamentaÃ§Ã£o conceitual, resoluÃ§Ã£o guiada de exercÃ­cios e leitura de padrÃµes para ajudar vocÃª a enxergar mÃ©todo onde antes parecia sÃ³ dificuldade.',
    'Com trilhas progressivas de treino, o curso sustenta evoluÃ§Ã£o prÃ¡tica em interpretaÃ§Ã£o, agilidade de cÃ¡lculo e domÃ­nio das estruturas que mais aparecem nas avaliaÃ§Ãµes.',
  ],
  'GestÃ£o': [
    'A proposta Ã© aproximar teoria e execuÃ§Ã£o, traduzindo conceitos de lideranÃ§a, processos e gestÃ£o de pessoas em rotinas que funcionam no dia a dia de equipes reais.',
    'VocÃª percorre ferramentas de organizaÃ§Ã£o, comunicaÃ§Ã£o e tomada de decisÃ£o com apoio de materiais complementares que facilitam implementaÃ§Ã£o imediata.',
  ],
  Humanas: [
    'O curso organiza autores, movimentos e debates centrais em uma trilha clara, ajudando vocÃª a construir repertÃ³rio, interpretar contextos e argumentar com seguranÃ§a.',
    'A metodologia combina leitura orientada, sÃ­nteses crÃ­ticas e recursos de fixaÃ§Ã£o para ampliar profundidade sem tornar o estudo excessivamente abstrato.',
  ],
  'PsicanÃ¡lise / Psicologia': [
    'A trilha foi pensada para conectar teoria, escuta clÃ­nica e leitura de casos, oferecendo uma base consistente para quem deseja aprofundar repertÃ³rio conceitual e sensibilidade tÃ©cnica.',
    'Com aulas densas, materiais de apoio e exercÃ­cios de revisÃ£o, o curso ajuda vocÃª a consolidar linguagem, escola teÃ³rica e aplicaÃ§Ãµes contemporÃ¢neas.',
  ],
}

const categoryOutcomeTemplates: Record<string, GenflixCourseOutcome[]> = {
  SaÃºde: [
    { title: 'Dominar critÃ©rios tÃ©cnicos', description: 'Entenda prioridades clÃ­nicas, leitura de sinais e critÃ©rios usados na prÃ¡tica profissional.' },
    { title: 'Organizar sua revisÃ£o', description: 'Monte um fluxo de estudo com simulados, resumos e ferramentas de memorizaÃ§Ã£o contÃ­nua.' },
    { title: 'Resolver casos com seguranÃ§a', description: 'Treine raciocÃ­nio aplicado em situaÃ§Ãµes frequentes das provas e da rotina assistencial.' },
    { title: 'Atualizar-se com confianÃ§a', description: 'Acompanhe mudanÃ§as de protocolo e mantenha o conteÃºdo alinhado ao cenÃ¡rio atual.' },
  ],
  Direito: [
    { title: 'Mapear temas de alta incidÃªncia', description: 'Priorize assuntos que mais aparecem nas provas e construa um plano de avanÃ§o realista.' },
    { title: 'Interpretar questÃµes com mÃ©todo', description: 'Treine leitura de enunciados, eliminaÃ§Ã£o de alternativas e revisÃ£o por desempenho.' },
    { title: 'Consolidar lei seca e jurisprudÃªncia', description: 'Conecte teoria, texto legal e entendimento prÃ¡tico sem estudar de forma fragmentada.' },
    { title: 'Ganhar ritmo atÃ© a prova', description: 'Crie uma rotina consistente para revisar, testar e corrigir pontos fracos.' },
  ],
  Exatas: [
    { title: 'Compreender fundamentos sem decorar', description: 'Aprenda os conceitos-base que sustentam questÃµes e aplicaÃ§Ãµes quantitativas.' },
    { title: 'Resolver com estratÃ©gia', description: 'Use atalhos, leitura de padrÃ£o e lÃ³gica de resoluÃ§Ã£o para ganhar velocidade.' },
    { title: 'Reduzir erros recorrentes', description: 'Identifique os pontos em que vocÃª mais falha e corrija a raiz do problema.' },
    { title: 'Aumentar sua confianÃ§a em provas', description: 'Treine com progressÃ£o de dificuldade e simulados dirigidos.' },
  ],
  'GestÃ£o': [
    { title: 'Liderar com clareza', description: 'Transforme conceitos de lideranÃ§a em prÃ¡ticas objetivas para coordenaÃ§Ã£o de times.' },
    { title: 'Tomar decisÃµes com contexto', description: 'Analise cenÃ¡rios, organize prioridades e conduza processos com mais previsibilidade.' },
    { title: 'Melhorar comunicaÃ§Ã£o e rotina', description: 'Estruture rituais, alinhamentos e acompanhamento de entregas com menos fricÃ§Ã£o.' },
    { title: 'Aplicar melhorias rapidamente', description: 'Leve os aprendizados para o trabalho com ferramentas simples e acionÃ¡veis.' },
  ],
  Humanas: [
    { title: 'Construir repertÃ³rio sÃ³lido', description: 'Entenda autores, correntes e contextos sem perder a linha histÃ³rica.' },
    { title: 'Ler textos complexos com fluidez', description: 'Desenvolva uma rotina de interpretaÃ§Ã£o e sÃ­ntese mais inteligente.' },
    { title: 'Argumentar melhor', description: 'Conecte conceitos e organize respostas com mais clareza e densidade analÃ­tica.' },
    { title: 'Fixar temas de longa duraÃ§Ã£o', description: 'Use revisÃ£o guiada para manter domÃ­nio dos tÃ³picos ao longo do tempo.' },
  ],
  'PsicanÃ¡lise / Psicologia': [
    { title: 'Consolidar fundamentos teÃ³ricos', description: 'Estude conceitos centrais e escolas de pensamento com progressÃ£o clara.' },
    { title: 'Aprimorar leitura clÃ­nica', description: 'Desenvolva sensibilidade para observar linguagem, caso e contexto com mais profundidade.' },
    { title: 'Articular teoria e prÃ¡tica', description: 'Relacione autores, conceitos e aplicaÃ§Ãµes contemporÃ¢neas de forma consistente.' },
    { title: 'Ganhar repertÃ³rio para supervisÃ£o', description: 'Chegue mais preparado para discussÃ£o de casos e aprofundamento profissional.' },
  ],
}

function buildCourseModules(course: GenflixCourseItem): GenflixCourseModule[] {
  return [
    {
      title: `Dominar os fundamentos de ${course.title.toLowerCase()}`,
      lessonCount: 12,
      summary: 'Conceitos-base, organizaÃ§Ã£o da trilha e leitura do cenÃ¡rio geral do curso.',
    },
    {
      title: `AplicaÃ§Ãµes prÃ¡ticas em ${course.category.toLowerCase()}`,
      lessonCount: 8,
      summary: 'Casos, exercÃ­cios dirigidos e modelos de execuÃ§Ã£o para ganhar seguranÃ§a tÃ©cnica.',
    },
    {
      title: 'RevisÃ£o estratÃ©gica e fixaÃ§Ã£o',
      lessonCount: 10,
      summary: 'Ferramentas de reforÃ§o, simulados comentados e revisÃ£o inteligente por desempenho.',
    },
    {
      title: 'Plano de continuidade e atualizaÃ§Ã£o',
      lessonCount: 6,
      summary: 'Como manter o estudo ativo, acompanhar novidades e sustentar avanÃ§o apÃ³s a trilha principal.',
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
    description: `${course.title} reÃºne uma trilha prÃ¡tica com aulas objetivas, revisÃ£o guiada e ferramentas de estudo para quem quer avanÃ§ar com consistÃªncia.`,
    aboutParagraphs,
    outcomes,
    syllabus: buildCourseModules(course),
    mentor: {
      name: course.mentor,
      role: course.role,
      bio: `Curadoria acadÃªmica e acompanhamento pedagÃ³gico conduzidos por ${course.mentor}, com experiÃªncia aplicada em ${course.category.toLowerCase()}.`,
      initials: course.initials,
    },
    priceLabel: 'R$ 294,90',
    secondaryPriceLabel: 'Acesso imediato + materiais inclusos',
    includedItems: defaultIncludedItems,
    bonusSection: {
      enabled: true,
      title: 'PrÃ©via de conteÃºdo',
      description: `Curadoria acadÃªmica e acompanhamento pedagÃ³gico conduzidos por ${course.mentor}, com experiÃªncia aplicada em ${course.category.toLowerCase()}.`,
    },
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
            description: 'Uma trilha intensiva para transformar anatomia em leitura clÃ­nica aplicada, com linguagem clara, prÃ¡tica guiada e recursos que aceleram a retenÃ§Ã£o do conteÃºdo.',
            aboutParagraphs: [
              'Este Ã© o curso ideal para quem precisa consolidar anatomia clÃ­nica sem estudar de forma fragmentada. A trilha foi organizada para conectar estruturas, funÃ§Ã£o e interpretaÃ§Ã£o aplicada ao contexto profissional.',
              'Com videoaulas objetivas, simulados comentados, resumos e ferramentas de revisÃ£o ativa, vocÃª avanÃ§a com mais clareza, reduz a dispersÃ£o e ganha seguranÃ§a para aplicar o conteÃºdo em situaÃ§Ãµes reais.',
            ],
            outcomes: [
              { title: 'Ler anatomia com mais clareza', description: 'ReconheÃ§a estruturas, relaÃ§Ãµes e pontos de atenÃ§Ã£o com foco clÃ­nico.' },
              { title: 'Conectar teoria e prÃ¡tica', description: 'Transforme conteÃºdos densos em decisÃµes mais seguras no estudo e no trabalho.' },
              { title: 'Revisar com menos esforÃ§o', description: 'Use resumos, simulados e ferramentas de repetiÃ§Ã£o para fixar o essencial.' },
              { title: 'Construir base para avanÃ§ar', description: 'Chegue mais preparado para mÃ³dulos seguintes, provas e discussÃµes clÃ­nicas.' },
            ],
          }
        : {},
    ),
  ]),
)

const baseBlogPosts: Omit<GenflixBlogPost, 'slug' | 'category' | 'title'>[] = [
  {
    seoDescription: 'Como organizar uma rotina de estudos consistente, com revisÃ£o ativa, blocos curtos e foco real no que precisa avanÃ§ar.',
    image: '/images/genflix/home/featured-1.jpg',
    readTime: '6 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '09 abr 2026',
    content: [
      'Estudar melhor nÃ£o Ã© apenas estudar mais. Uma rotina consistente nasce da clareza sobre prioridades, da definiÃ§Ã£o de blocos possÃ­veis e da revisÃ£o frequente do que foi aprendido.',
      'Na prÃ¡tica, isso significa alternar teoria, exercÃ­cios e momentos curtos de retomada. Quando vocÃª organiza o estudo dessa forma, a retenÃ§Ã£o melhora e a sensaÃ§Ã£o de progresso deixa de depender apenas de volume.',
      'No GenFlix, esse princÃ­pio aparece em trilhas pensadas para manter ritmo, reduzir dispersÃ£o e transformar aprendizado em avanÃ§o concreto.',
    ],
    featured: true,
  },
  {
    seoDescription: 'Recursos complementares, simulados e revisÃ£o espaÃ§ada podem mudar completamente a forma como vocÃª aprende e fixa conteÃºdo.',
    image: '/images/genflix/home/featured-2.jpg',
    readTime: '5 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '08 abr 2026',
    content: [
      'A aula Ã© o ponto de partida, nÃ£o o destino final. Quando o estudo inclui resumos, questÃµes, flashcards e retomadas curtas, o conteÃºdo passa a circular melhor na memÃ³ria.',
      'Isso reduz o efeito de assistir, entender na hora e esquecer depois. Recursos complementares existem justamente para sustentar o aprendizado alÃ©m do momento da explicaÃ§Ã£o.',
      'A combinaÃ§Ã£o entre vÃ­deo, prÃ¡tica e revisÃ£o Ã© o que torna a experiÃªncia mais completa e eficiente.',
    ],
  },
  {
    seoDescription: 'Ler melhor, resumir melhor e argumentar melhor tambÃ©m sÃ£o habilidades treinÃ¡veis. Pequenos ajustes de mÃ©todo fazem diferenÃ§a.',
    image: '/images/genflix/home/featured-3.jpg',
    readTime: '4 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '07 abr 2026',
    content: [
      'Em Ã¡reas densas, a dificuldade muitas vezes nÃ£o estÃ¡ no conteÃºdo em si, mas na forma como ele Ã© abordado. Quando a leitura Ã© passiva, o entendimento tende a se dissipar rapidamente.',
      'Criar sÃ­nteses curtas, responder perguntas-chave e testar a prÃ³pria interpretaÃ§Ã£o sÃ£o hÃ¡bitos simples que elevam a qualidade do estudo.',
      'Com o tempo, isso fortalece a autonomia e melhora a capacidade de conectar conceitos.',
    ],
  },
  {
    seoDescription: 'Aprender com mais profundidade nÃ£o exige rigidez extrema. Exige constÃ¢ncia, repertÃ³rio e um ambiente que favoreÃ§a continuidade.',
    image: '/images/genflix/home/featured-4.jpg',
    readTime: '5 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '06 abr 2026',
    content: [
      'Muita gente desiste nÃ£o por falta de capacidade, mas por excesso de atrito. Quando estudar parece sempre pesado demais, a tendÃªncia Ã© interromper antes de ganhar ritmo.',
      'Um bom ambiente de aprendizagem reduz esse atrito com clareza de trilha, progressÃ£o visÃ­vel e materiais que acompanham o aluno em diferentes momentos da rotina.',
      'ConsistÃªncia nasce quando o caminho Ã© mais sustentÃ¡vel.',
    ],
  },
  {
    seoDescription: 'O que diferencia um bom plano de estudos Ã© sua capacidade de se adaptar ao seu contexto sem perder direÃ§Ã£o.',
    image: '/images/genflix/home/featured-5.jpg',
    readTime: '7 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '05 abr 2026',
    content: [
      'Planejamento bom nÃ£o Ã© o que parece bonito na agenda; Ã© o que continua funcionando quando a semana fica mais apertada.',
      'Em vez de depender de blocos longos e ideais, vale construir um plano com prioridades claras, revisÃµes inteligentes e flexibilidade controlada.',
      'Assim, vocÃª preserva continuidade mesmo quando a rotina muda.',
    ],
  },
  {
    seoDescription: 'A revisÃ£o certa no momento certo reduz esquecimento e aumenta confianÃ§a antes de provas, avaliaÃ§Ãµes e tomadas de decisÃ£o reais.',
    image: '/images/genflix/home/featured-6.jpg',
    readTime: '5 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '04 abr 2026',
    content: [
      'Revisar nÃ£o significa reler tudo desde o inÃ­cio. Significa identificar o que precisa voltar para a memÃ³ria e em qual formato isso funciona melhor.',
      'Mapas rÃ¡pidos, flashcards, listas curtas e simulados comentados sÃ£o exemplos de ferramentas que tornam a revisÃ£o mais objetiva.',
      'Com esse tipo de apoio, a confianÃ§a deixa de ser sÃ³ sensaÃ§Ã£o e passa a vir de evidÃªncia prÃ¡tica.',
    ],
  },
  {
    seoDescription: 'Mais do que acompanhar tendÃªncias, vale entender o que realmente faz diferenÃ§a quando o objetivo Ã© aprender com aplicaÃ§Ã£o.',
    image: '/images/genflix/home/hero.jpg',
    readTime: '6 min de leitura',
    author: 'Equipe GenFlix',
    publishedAt: '03 abr 2026',
    content: [
      'Ferramentas educacionais aparecem o tempo inteiro, mas nem toda novidade melhora a experiÃªncia de aprender.',
      'O critÃ©rio principal continua sendo utilidade: ajuda a entender? ajuda a revisar? ajuda a aplicar? Se a resposta for nÃ£o, Ã© sÃ³ ruÃ­do.',
      'A construÃ§Ã£o de uma boa jornada passa por escolhas simples, consistentes e centradas no aluno.',
    ],
  },
]

const blogCategories = ['SaÃºde', 'Direito', 'Exatas', 'GestÃ£o', 'Humanas', 'Psicologia', 'Interesse Geral'] as const

export const genflixBlogFilters = ['Todos', ...blogCategories] as const

export const genflixBlogPosts: GenflixBlogPost[] = baseBlogPosts.map((post, index) => {
  const category = blogCategories[index % blogCategories.length]

  return {
    slug: `artigo-genflix-${index + 1}`,
    category,
    title:
      index === 0
        ? 'ConteÃºdo feito por quem ensina, para quem quer ir alÃ©m'
        : [
            'Como estudar com mais clareza e menos dispersÃ£o',
            'Os recursos que tornam o aprendizado mais completo',
            'MÃ©todo, revisÃ£o e autonomia intelectual',
            'O que sustenta uma rotina de estudo de verdade',
            'Planejamento realista para quem precisa continuar',
            'RevisÃ£o inteligente para fixar melhor',
            'O que realmente vale na educaÃ§Ã£o digital',
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
    title: 'Links RÃ¡pidos',
    items: [
      { label: 'PolÃ­tica de privacidade', href: '/privacidade', isInternal: true },
      { label: 'PolÃ­tica de reembolso', href: '/politica-de-reembolso', isInternal: true },
      { label: 'Perguntas frequentes', href: '/suporte#perguntas-frequentes', isInternal: true },
      { label: 'Ajuda / Como usar', href: '/ajuda', isInternal: true },
      { label: 'Suporte', href: '/suporte', isInternal: true },
    ],
  },
  {
    title: 'Fale com a GenFlix',
    items: [
      { label: 'Contato', href: '/contato', isInternal: true },
      { label: 'Ensine na GenFlix', href: '/ensine-na-genflix', isInternal: true },
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

