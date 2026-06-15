import { ArrowRight, BookOpen, Clock3, Eye, GripVertical, PencilLine, PlusCircle, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { Button } from '@/components/ui/button';
import { sanitizeRichTextHtml } from '@/features/admin/content/content-blocks';
import { type AdminTutorial, type AdminTutorialDraft, type AdminTutorialStep, useAdminTutorials } from '@/features/admin/tutorials/admin-tutorials';

type TutorialStepForm = {
  title: string;
  description: string;
};

type TutorialFormState = {
  title: string;
  summary: string;
  category: string;
  estimatedMinutes: string;
  notesText: string;
  steps: TutorialStepForm[];
};

const emptyStep = (index: number): TutorialStepForm => ({
  title: `Passo ${index + 1}`,
  description: '<p></p>',
});

const createEmptyForm = (): TutorialFormState => ({
  title: '',
  summary: '',
  category: 'Geral',
  estimatedMinutes: '3',
  notesText: '',
  steps: [emptyStep(0)],
});

function parseLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseNotes(value: string) {
  return parseLines(value);
}

function createFormFromTutorial(tutorial: AdminTutorial): TutorialFormState {
  return {
    title: tutorial.title,
    summary: tutorial.summary,
    category: tutorial.category,
    estimatedMinutes: String(tutorial.estimatedMinutes || 3),
    notesText: tutorial.notes.join('\n'),
    steps: tutorial.steps.length > 0
      ? tutorial.steps.map((step, index) => ({
          title: step.title,
          description: step.description || emptyStep(index).description,
        }))
      : [emptyStep(0)],
  };
}

function normalizeStep(step: TutorialStepForm, index: number): AdminTutorialStep | null {
  const title = step.title.trim();
  const description = sanitizeRichTextHtml(step.description.trim() || '<p></p>');

  if (!title && description === '<p></p>') {
    return null;
  }

  return {
    title: title || `Passo ${index + 1}`,
    description,
  };
}

export function AdminTutorialsPage() {
  const { tutorials, activeTutorial, openTutorial, addTutorial, updateTutorial, deleteTutorial, reorderTutorials } = useAdminTutorials();
  const [search, setSearch] = useState('');
  const [selectedTutorialId, setSelectedTutorialId] = useState<string>(tutorials[0]?.id ?? '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTutorialId, setEditingTutorialId] = useState<string | null>(null);
  const [form, setForm] = useState<TutorialFormState>(createEmptyForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tutorials.length === 0) {
      setSelectedTutorialId('');
      return;
    }

    if (!tutorials.some((tutorial) => tutorial.id === selectedTutorialId)) {
      setSelectedTutorialId(tutorials[0].id);
    }
  }, [selectedTutorialId, tutorials]);

  const filteredTutorials = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return tutorials;
    }

    return tutorials.filter((tutorial) => {
      return [tutorial.title, tutorial.summary, tutorial.category].some((field) => field.toLowerCase().includes(term));
    });
  }, [search, tutorials]);

  const selectedTutorial = useMemo(() => {
    return tutorials.find((tutorial) => tutorial.id === selectedTutorialId) ?? tutorials[0] ?? activeTutorial;
  }, [activeTutorial, selectedTutorialId, tutorials]);

  const canReorderTutorials = search.trim().length === 0;

  function handleTutorialDragEnd(result: DropResult) {
    if (!result.destination || result.destination.index === result.source.index) {
      return;
    }

    const nextTutorials = [...tutorials];
    const [movedTutorial] = nextTutorials.splice(result.source.index, 1);

    if (!movedTutorial) {
      return;
    }

    nextTutorials.splice(result.destination.index, 0, movedTutorial);
    reorderTutorials(nextTutorials.map((tutorial) => tutorial.id));
  }

  function openCreateModal() {
    setEditingTutorialId(null);
    setForm(createEmptyForm());
    setFeedback(null);
    setIsModalOpen(true);
  }

  function openEditModal(tutorial: AdminTutorial) {
    setEditingTutorialId(tutorial.id);
    setForm(createFormFromTutorial(tutorial));
    setFeedback(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingTutorialId(null);
    setFeedback(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const title = form.title.trim();
    const summary = form.summary.trim();

    if (!title || !summary) {
      setFeedback('Preencha pelo menos o título e o resumo do tutorial.');
      return;
    }

    const steps = form.steps
      .map((step, index) => normalizeStep(step, index))
      .filter((step): step is AdminTutorialStep => Boolean(step));

    const draft: AdminTutorialDraft = {
      title,
      summary,
      category: form.category.trim() || 'Geral',
      estimatedMinutes: Number(form.estimatedMinutes) || 3,
      steps: steps.length > 0 ? steps : [emptyStep(0)],
      notes: parseNotes(form.notesText),
    };

    const savedTutorial = editingTutorialId ? updateTutorial(editingTutorialId, draft) : addTutorial(draft);

    setSelectedTutorialId(savedTutorial.id);
    setFeedback(`Tutorial "${savedTutorial.title}" salvo com sucesso.`);
    setIsModalOpen(false);
    setEditingTutorialId(null);
    setForm(createEmptyForm());
  }

  function openSelectedInPage(tutorialId: string) {
    setSelectedTutorialId(tutorialId);
    window.requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function addStep() {
    setForm((current) => ({
      ...current,
      steps: [...current.steps, emptyStep(current.steps.length)],
    }));
  }

  function updateStep(index: number, patch: Partial<TutorialStepForm>) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, currentIndex) => (currentIndex === index ? { ...step, ...patch } : step)),
    }));
  }

  function removeStep(index: number) {
    setForm((current) => ({
      ...current,
      steps: current.steps.length <= 1
        ? [emptyStep(0)]
        : current.steps.filter((_, currentIndex) => currentIndex !== index),
    }));
  }

  const tutorialCount = tutorials.length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-[#D8E6EB] bg-[linear-gradient(145deg,#0A3640_0%,#0E677C_55%,#1398B7_100%)] p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/80">
              <Sparkles className="h-3.5 w-3.5" />
              Tutoriais do admin
            </div>
            <h1 className="mt-4 font-readex text-3xl font-semibold tracking-tight sm:text-4xl">
              Conteúdos rápidos para executar tarefas sem perder tempo.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/82 sm:text-base">
              Esta área reúne guias curtos para ajudar o admin a aprender tarefas comuns do painel.
              Use a página completa ou o widget flutuante para ler um tutorial enquanto executa o passo a passo.
            </p>
          </div>

          <Button type="button" onClick={openCreateModal} className="h-11 rounded-2xl bg-white px-5 font-black text-[#0E677C] hover:bg-slate-100">
            <PlusCircle className="h-4.5 w-4.5" />
            NOVO TUTORIAL
          </Button>
        </div>
      </section>

      {feedback ? (
        <p className="rounded-[24px] border border-[#BEE3EA] bg-[#F2FBFD] px-5 py-4 text-sm font-semibold text-[#155160] shadow-sm">
          {feedback}
        </p>
      ) : null}

      <section className="rounded-[32px] border border-[#D8E6EB] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Lista</p>
            <h2 className="mt-1 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">Tutoriais cadastrados</h2>
            <p className="mt-2 text-sm leading-6 text-[#5F7077]">
              {tutorialCount} tutoriais prontos para leitura, atualização e abertura na página ou no widget lateral.
            </p>
          </div>

          <label className="block w-full max-w-xl rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] p-4 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Buscar tutorial</span>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[#D8E6EB] bg-white px-4">
              <Search className="h-4 w-4 shrink-0 text-[#1398B7]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 w-full bg-transparent text-sm font-semibold text-[#15323b] outline-none"
                placeholder="Título, resumo ou categoria"
              />
            </div>
          </label>
        </div>

        <div className="mt-6 overflow-hidden rounded-[28px] border border-[#D8E6EB]">
          <div className="hidden grid-cols-[36px_minmax(0,2.35fr)_minmax(210px,1fr)_minmax(120px,0.7fr)_minmax(0,1.15fr)] gap-x-6 border-b border-[#D8E6EB] bg-[#F8FBFC] px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077] lg:grid">
            <span className="sr-only">Ordenar</span>
            <span className="pr-4">Tutorial</span>
            <span className="pl-4">Categoria / tempo</span>
            <span className="pl-4">Passos</span>
            <span className="pl-4 text-right">Ações</span>
          </div>

          <div className="divide-y divide-[#E6EEF1]">
            {filteredTutorials.length === 0 ? (
              <div className="bg-white px-5 py-6 text-sm text-[#5F7077]">
                Nenhum tutorial encontrado para a busca atual.
              </div>
            ) : null}

            {canReorderTutorials ? (
              <DragDropContext onDragEnd={handleTutorialDragEnd}>
                <Droppable droppableId="tutorials-display-order">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {filteredTutorials.map((tutorial, index) => {
                        const isSelected = tutorial.id === selectedTutorialId;

                        return (
                          <Draggable key={tutorial.id} draggableId={tutorial.id} index={index}>
                            {(draggableProvided, snapshot) => (
                              <article
                                ref={draggableProvided.innerRef}
                                {...draggableProvided.draggableProps}
                                className={"bg-white px-5 py-4 transition-colors " + (snapshot.isDragging ? 'border-[#BEE3EA] bg-[#F2FBFD] shadow-lg' : isSelected ? 'bg-[#F8FBFC]' : '')}
                              >
                                <div className="grid gap-4 lg:grid-cols-[36px_minmax(0,2fr)_minmax(180px,0.8fr)_minmax(150px,0.7fr)_minmax(0,1.2fr)] lg:items-center">
                                  <button
                                    type="button"
                                    aria-label={"Mover tutorial " + tutorial.title}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[#D8E6EB] bg-white text-[#5F7077] transition hover:border-[#1398B7]/40 hover:text-[#1398B7]"
                                    {...draggableProvided.dragHandleProps}
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </button>

                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">{tutorial.category}</p>
                                      {isSelected ? (
                                        <span className="inline-flex items-center rounded-full border border-[#BEE3EA] bg-[#DFF5FA] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#0E677C]">
                                          Em exibição
                                        </span>
                                      ) : null}
                                    </div>
                                    <h3 className="mt-2 text-base font-black tracking-tight text-[#15323b]">{tutorial.title}</h3>
                                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5F7077]">{tutorial.summary}</p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D8E6EB] bg-[#F8FBFC] px-2.5 py-1.5">
                                      <Clock3 className="h-3.5 w-3.5" />
                                      {tutorial.estimatedMinutes} min
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D8E6EB] bg-[#F8FBFC] px-2.5 py-1.5">
                                      <BookOpen className="h-3.5 w-3.5" />
                                      {tutorial.category}
                                    </span>
                                  </div>

                                  <div className="text-sm font-semibold text-[#5F7077]">
                                    {tutorial.steps.length} passos
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-10 rounded-2xl border-[#D8E6EB] bg-white px-3.5 font-black text-[#163138] hover:border-[#1398B7]/40 hover:bg-[#F2FBFD]"
                                      onClick={() => openSelectedInPage(tutorial.id)}
                                    >
                                      <Eye className="h-4 w-4" />
                                      Na página
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-10 rounded-2xl border-[#D8E6EB] bg-white px-3.5 font-black text-[#163138] hover:border-[#1398B7]/40 hover:bg-[#F2FBFD]"
                                      onClick={() => openTutorial(tutorial.id)}
                                    >
                                      <BookOpen className="h-4 w-4" />
                                      Widget
                                    </Button>
                                    <Button
                                      type="button"
                                      className="h-10 rounded-2xl bg-[#1398B7] px-3.5 font-black text-white hover:bg-[#1089A5]"
                                      onClick={() => openEditModal(tutorial)}
                                    >
                                      <PencilLine className="h-4 w-4" />
                                      Editar
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-10 rounded-2xl border-rose-200 bg-white px-3.5 font-black text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                                      onClick={() => {
                                        if (window.confirm('Excluir o tutorial "' + tutorial.title + '"?')) {
                                          deleteTutorial(tutorial.id);
                                          if (selectedTutorialId === tutorial.id) {
                                            setSelectedTutorialId(tutorials.find((item) => item.id !== tutorial.id)?.id ?? '');
                                          }
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Excluir
                                    </Button>
                                  </div>
                                </div>
                              </article>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              filteredTutorials.map((tutorial) => {
                const isSelected = tutorial.id === selectedTutorialId;

                return (
                  <article key={tutorial.id} className={"bg-white px-5 py-4 transition-colors " + (isSelected ? 'bg-[#F8FBFC]' : '')}>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(180px,0.8fr)_minmax(150px,0.7fr)_minmax(0,1.2fr)] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">{tutorial.category}</p>
                          {isSelected ? (
                            <span className="inline-flex items-center rounded-full border border-[#BEE3EA] bg-[#DFF5FA] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#0E677C]">
                              Em exibição
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-2 text-base font-black tracking-tight text-[#15323b]">{tutorial.title}</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5F7077]">{tutorial.summary}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D8E6EB] bg-[#F8FBFC] px-2.5 py-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {tutorial.estimatedMinutes} min
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D8E6EB] bg-[#F8FBFC] px-2.5 py-1.5">
                          <BookOpen className="h-3.5 w-3.5" />
                          {tutorial.category}
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-[#5F7077]">
                        {tutorial.steps.length} passos
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-2xl border-[#D8E6EB] bg-white px-3.5 font-black text-[#163138] hover:border-[#1398B7]/40 hover:bg-[#F2FBFD]"
                          onClick={() => openSelectedInPage(tutorial.id)}
                        >
                          <Eye className="h-4 w-4" />
                          Na página
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-2xl border-[#D8E6EB] bg-white px-3.5 font-black text-[#163138] hover:border-[#1398B7]/40 hover:bg-[#F2FBFD]"
                          onClick={() => openTutorial(tutorial.id)}
                        >
                          <BookOpen className="h-4 w-4" />
                          Widget
                        </Button>
                        <Button
                          type="button"
                          className="h-10 rounded-2xl bg-[#1398B7] px-3.5 font-black text-white hover:bg-[#1089A5]"
                          onClick={() => openEditModal(tutorial)}
                        >
                          <PencilLine className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-2xl border-rose-200 bg-white px-3.5 font-black text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => {
                            if (window.confirm('Excluir o tutorial "' + tutorial.title + '"?')) {
                              deleteTutorial(tutorial.id);
                              if (selectedTutorialId === tutorial.id) {
                                setSelectedTutorialId(tutorials.find((item) => item.id !== tutorial.id)?.id ?? '');
                              }
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section ref={previewRef} className="rounded-[32px] border border-[#D8E6EB] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Visualização na página</p>
            <h2 className="mt-1 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
              {selectedTutorial.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#5F7077]">{selectedTutorial.summary}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" className="h-11 rounded-2xl bg-[#1398B7] px-5 font-black text-white hover:bg-[#1089A5]" onClick={() => openTutorial(selectedTutorial.id)}>
              Abrir no widget
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-2xl border-[#D8E6EB] bg-white px-5 font-black text-[#163138] hover:border-[#1398B7]/40 hover:bg-[#F2FBFD]" onClick={() => openEditModal(selectedTutorial)}>
              Editar tutorial
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4">
          {selectedTutorial.steps.map((step, index) => (
            <article key={`${selectedTutorial.id}-${step.title}-${index}`} className="rounded-[28px] border border-[#D8E6EB] bg-[#F8FBFC] p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1398B7] text-sm font-black text-white shadow-sm">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black tracking-tight text-[#15323b]">{step.title}</h3>
                  <div
                    className="mt-2 space-y-3 text-sm leading-6 text-[#5F7077] [&_a]:font-semibold [&_a]:text-[#1398B7] [&_a]:underline [&_p]:m-0"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(step.description) }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-[28px] border border-[#BEE3EA] bg-[#F2FBFD] p-5">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[#0E677C]">Dicas rápidas</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[#155160]">
            {selectedTutorial.notes.map((note) => (
              <li key={note} className="flex gap-2">
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#1398B7]" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:p-4" onClick={closeModal}>
          <div className="flex h-[min(92vh,920px)] w-full max-w-[min(96vw,1040px)] flex-col overflow-hidden rounded-[32px] border border-[#BEE3EA] bg-white shadow-[0_30px_100px_rgba(10,54,64,0.26)]" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 border-b border-[#D8E6EB] bg-[linear-gradient(145deg,#0A3640_0%,#0E677C_55%,#1398B7_100%)] px-5 py-4 text-white">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/80">
                    <Sparkles className="h-3.5 w-3.5" />
                    Novo tutorial
                  </div>
                  <h2 className="mt-3 font-readex text-2xl font-semibold tracking-tight">
                    {editingTutorialId ? 'Editar tutorial' : 'Criar novo tutorial'}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/82">
                    Organize os passos, adicione um texto rico em cada etapa e salve o tutorial para usar no painel e no widget lateral.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Fechar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
                  <div className="border-b border-[#D8E6EB] p-5 lg:border-b-0 lg:border-r">
                    <div className="grid gap-4">
                      <label className="block space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Título</span>
                        <input
                          value={form.title}
                          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                          className="h-11 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none transition focus:border-[#1398B7]"
                          placeholder="Ex.: Como publicar um curso"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Resumo</span>
                        <textarea
                          value={form.summary}
                          onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                          className="min-h-[92px] w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none transition focus:border-[#1398B7]"
                          placeholder="Explique em poucas linhas o que o tutorial ensina."
                        />
                      </label>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-2">
                          <span className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Categoria</span>
                          <input
                            value={form.category}
                            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                            className="h-11 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none transition focus:border-[#1398B7]"
                            placeholder="Ex.: Blog"
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Tempo</span>
                          <input
                            type="number"
                            min="1"
                            value={form.estimatedMinutes}
                            onChange={(event) => setForm((current) => ({ ...current, estimatedMinutes: event.target.value }))}
                            className="h-11 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none transition focus:border-[#1398B7]"
                          />
                        </label>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Passos</p>
                            <p className="mt-1 text-sm leading-6 text-[#5F7077]">Cada passo pode ter título e descrição em texto rico.</p>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-2xl border-[#D8E6EB] bg-white px-3.5 font-black text-[#163138] hover:border-[#1398B7]/40 hover:bg-[#F2FBFD]"
                            onClick={addStep}
                          >
                            <PlusCircle className="h-4 w-4" />
                            Adicionar passo
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {form.steps.map((step, index) => (
                            <div key={`step-form-${index}`} className="rounded-[28px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#1398B7] text-xs font-black text-white">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Passo {index + 1}</p>
                                    <p className="mt-1 text-sm font-semibold text-[#15323b]">Conteúdo do passo</p>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeStep(index)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D8E6EB] bg-white text-[#5F7077] transition hover:border-rose-200 hover:text-rose-600"
                                  aria-label={`Remover passo ${index + 1}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>

                              <div className="mt-4 grid gap-4">
                                <label className="block space-y-2">
                                  <span className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Título do passo</span>
                                  <input
                                    value={step.title}
                                    onChange={(event) => updateStep(index, { title: event.target.value })}
                                    className="h-11 w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none transition focus:border-[#1398B7]"
                                    placeholder="Ex.: Definir capa do curso"
                                  />
                                </label>

                                <label className="block space-y-2">
                                  <span className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Descrição rica</span>
                                  <RichTextEditor
                                    value={step.description}
                                    onChange={(value) => updateStep(index, { description: value })}
                                    showRawHtmlToggle={false}
                                    simpleMode
                                    minHeightClassName="min-h-[220px]"
                                    placeholder="Escreva o passo a passo com formatação, links ou listas."
                                  />
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 bg-[#F8FBFC] p-5">
                    <div className="rounded-[28px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Dicas</p>
                      <ul className="mt-3 space-y-3 text-sm leading-6 text-[#155160]">
                        <li className="flex gap-2">
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#1398B7]" />
                          <span>Use títulos curtos e objetivos para cada passo.</span>
                        </li>
                        <li className="flex gap-2">
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#1398B7]" />
                          <span>O conteúdo rico aceita listas, links e trechos em negrito.</span>
                        </li>
                        <li className="flex gap-2">
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#1398B7]" />
                          <span>Se o tutorial ficar longo, quebre o conteúdo em passos menores.</span>
                        </li>
                      </ul>
                    </div>

                    <label className="block rounded-[28px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
                      <span className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Dicas rápidas</span>
                      <textarea
                        value={form.notesText}
                        onChange={(event) => setForm((current) => ({ ...current, notesText: event.target.value }))}
                        className="mt-3 min-h-[220px] w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none transition focus:border-[#1398B7]"
                        placeholder="Escreva uma dica por linha."
                      />
                    </label>

                  </div>
                </div>

                <div className="border-t border-[#D8E6EB] bg-white px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button type="button" variant="outline" className="h-11 rounded-2xl border-[#D8E6EB] bg-white px-5 font-black text-[#163138] hover:border-[#1398B7]/40 hover:bg-[#F2FBFD]" onClick={closeModal}>
                      Cancelar
                    </Button>
                    <Button type="submit" className="h-11 rounded-2xl bg-[#1398B7] px-5 font-black text-white hover:bg-[#1089A5]">
                      {editingTutorialId ? 'Salvar alterações' : 'Salvar tutorial'}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
      ) : null}
    </div>
  );
}
