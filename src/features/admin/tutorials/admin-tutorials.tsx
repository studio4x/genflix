import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

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

export const adminTutorials: AdminTutorial[] = [
  {
    id: 'como-criar-curso',
    title: 'Como criar um curso',
    summary: 'Passo a passo simples para cadastrar, organizar e publicar um novo curso no painel admin.',
    estimatedMinutes: 5,
    category: 'Cursos',
    steps: [
      {
        title: 'Abra a área de cursos',
        description: 'No menu lateral do admin, entre em `Catálogo de Cursos` para ver a lista atual e iniciar um novo cadastro.',
      },
      {
        title: 'Crie o curso',
        description: 'Clique em `Criar Curso Agora` e preencha nome, descrição, imagem de capa, preço e status inicial.',
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
];

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
};

const AdminTutorialsContext = createContext<AdminTutorialsContextValue | null>(null);

export function AdminTutorialsProvider({ children }: { children: ReactNode }) {
  const [activeTutorialId, setActiveTutorialId] = useState(adminTutorials[0]?.id ?? '');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerMinimized, setIsDrawerMinimized] = useState(false);

  const activeTutorial = useMemo(() => {
    return adminTutorials.find((tutorial) => tutorial.id === activeTutorialId) ?? adminTutorials[0];
  }, [activeTutorialId]);

  function openTutorial(tutorialId = adminTutorials[0]?.id ?? '') {
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

  const value: AdminTutorialsContextValue = {
    tutorials: adminTutorials,
    activeTutorialId,
    activeTutorial,
    isDrawerOpen,
    isDrawerMinimized,
    openTutorial,
    closeDrawer,
    minimizeDrawer,
    restoreDrawer,
    selectTutorial,
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
