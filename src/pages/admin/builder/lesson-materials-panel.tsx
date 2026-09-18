import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout';
import { FooterActionsPanel } from '@/features/admin/content/footer-actions-panel';

export function LessonMaterialsPanel() {
  const { courseId, moduleId, lessonId } = useParams<{
    courseId: string;
    moduleId: string;
    lessonId: string;
  }>();
  const navigate = useNavigate();
  const { courseTree } = useCourseBuilder();

  const lesson = useMemo(() => {
    if (!courseTree || !lessonId) return null;
    for (const module of courseTree.modules) {
      const found = module.lessons.find((item) => item.id === lessonId);
      if (found) return found;
    }
    return null;
  }, [courseTree, lessonId]);

  if (!courseId || !lessonId) {
    return (
      <div className="p-6 text-slate-500">
        Parâmetros de aula ausentes.
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            navigate(
              `/admin/cursos/${courseId}/builder/modulos/${moduleId}/aulas/${lessonId}`
            )
          }
          className="text-blue-600 hover:underline text-sm font-bold flex items-center gap-1"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Voltar para Aula
        </button>
      </div>

      <FooterActionsPanel
        scope="lesson"
        courseId={courseId}
        moduleId={moduleId}
        lessonId={lessonId}
        title="Botões do Rodapé da Aula"
        description={`Configure arquivos, links, janelas modais ou botões da biblioteca global para o rodapé desta aula${
          lesson?.title ? `: "${lesson.title}"` : '.'
        }`}
      />
    </div>
  );
}
