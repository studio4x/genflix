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
    id: 'como-criar-curso',
    title: 'Como criar um curso',
    summary: 'Passo a passo simples para cadastrar, organizar e publicar um novo curso no painel admin.',
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
    id: 'como-criar-artigo-blog',
    title: 'Como criar um novo artigo no blog',
    summary: 'Guia rápido para escrever, organizar e publicar um artigo novo na área de blog do admin.',
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
