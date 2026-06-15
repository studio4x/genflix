import { ArrowRight, BookOpen, Clock3, PlusCircle, Sparkles } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { type AdminTutorialDraft, type AdminTutorialStep, useAdminTutorials } from '@/features/admin/tutorials/admin-tutorials';

const initialFormState = {
  title: '',
  summary: '',
  category: 'Blog',
  estimatedMinutes: '4',
  stepsText: [
    'Abra a área | Entre no menu correto do admin para começar.',
    'Crie o conteúdo | Clique em novo item e preencha os campos principais.',
    'Revise e publique | Confira tudo antes de salvar ou publicar.',
  ].join('\n'),
  notesText: [
    'Mantenha o texto curto e direto.',
    'Revise acentuação e formatação antes de publicar.',
  ].join('\n'),
};

function parseLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSteps(value: string): AdminTutorialStep[] {
  const lines = parseLines(value);

  return lines.map((line, index) => {
    const [titlePart, ...descriptionParts] = line.split('|');
    const title = titlePart?.trim() || `Passo ${index + 1}`;
    const description = descriptionParts.join('|').trim() || title;

    return { title, description };
  });
}

function parseNotes(value: string) {
  return parseLines(value);
}

export function AdminTutorialsPage() {
  const { tutorials, activeTutorial, selectTutorial, openTutorial, addTutorial } = useAdminTutorials();
  const [form, setForm] = useState(initialFormState);
  const [feedback, setFeedback] = useState<string | null>(null);

  const tutorialCount = useMemo(() => tutorials.length, [tutorials.length]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const title = form.title.trim();
    const summary = form.summary.trim();

    if (!title || !summary) {
      setFeedback('Preencha pelo menos o título e o resumo do tutorial.');
      return;
    }

    const draft: AdminTutorialDraft = {
      title,
      summary,
      category: form.category.trim() || 'Geral',
      estimatedMinutes: Number(form.estimatedMinutes) || 3,
      steps: parseSteps(form.stepsText),
      notes: parseNotes(form.notesText),
    };

    const created = addTutorial(draft);
    setFeedback(`Tutorial "${created.title}" criado com sucesso.`);
    setForm(initialFormState);
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-[#D8E6EB] bg-[linear-gradient(145deg,#0A3640_0%,#0E677C_55%,#1398B7_100%)] p-6 text-white shadow-sm sm:p-8">
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
            Use o botão flutuante em qualquer tela do admin para abrir o mesmo conteúdo em uma janela lateral.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-[28px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Lista</p>
            <h2 className="mt-1 font-readex text-xl font-semibold tracking-tight text-[#15323b]">Tutoriais disponíveis</h2>
            <p className="mt-2 text-sm leading-6 text-[#5F7077]">
              {tutorialCount} tutoriais prontos para leitura, atualização e abertura no painel lateral.
            </p>
          </div>

          <div className="space-y-3">
            {tutorials.map((tutorial) => {
              const isActive = tutorial.id === activeTutorial.id;

              return (
                <button
                  key={tutorial.id}
                  type="button"
                  onClick={() => selectTutorial(tutorial.id)}
                  className={`w-full rounded-[28px] border p-5 text-left transition-all ${isActive ? 'border-[#1398B7] bg-[#F2FBFD] shadow-[0_14px_40px_rgba(19,152,183,0.12)]' : 'border-[#D8E6EB] bg-white hover:border-[#BEE3EA] hover:bg-[#F8FBFC]'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">{tutorial.category}</p>
                      <h3 className="mt-2 text-lg font-black tracking-tight text-[#15323b]">{tutorial.title}</h3>
                    </div>
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1398B7] shadow-sm">
                      <BookOpen className="h-5 w-5" />
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[#5F7077]">{tutorial.summary}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#5F7077]">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D8E6EB] bg-white px-3 py-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      {tutorial.estimatedMinutes} min
                    </span>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BEE3EA] bg-[#DFF5FA] px-3 py-1.5 text-[#0E677C]">
                        Selecionado
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="rounded-[28px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Novo tutorial</p>
                <h2 className="mt-1 font-readex text-xl font-semibold tracking-tight text-[#15323b]">Adicionar conteúdo</h2>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                <PlusCircle className="h-5 w-5" />
              </span>
            </div>

            <div className="mt-5 space-y-4">
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

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Passos</span>
                <textarea
                  value={form.stepsText}
                  onChange={(event) => setForm((current) => ({ ...current, stepsText: event.target.value }))}
                  className="min-h-[120px] w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none transition focus:border-[#1398B7]"
                  placeholder="Título do passo | descrição do passo"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-[#5F7077]">Dicas</span>
                <textarea
                  value={form.notesText}
                  onChange={(event) => setForm((current) => ({ ...current, notesText: event.target.value }))}
                  className="min-h-[92px] w-full rounded-2xl border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none transition focus:border-[#1398B7]"
                  placeholder="Uma dica por linha."
                />
              </label>
            </div>

            {feedback ? <p className="mt-4 rounded-2xl border border-[#BEE3EA] bg-[#F2FBFD] px-4 py-3 text-sm font-semibold text-[#155160]">{feedback}</p> : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="submit" className="h-11 rounded-2xl bg-[#1398B7] px-5 font-black text-white hover:bg-[#1089A5]">
                Salvar tutorial
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border-[#D8E6EB] bg-white px-5 font-black text-[#163138] hover:border-[#1398B7]/40 hover:bg-[#F2FBFD]"
                onClick={() => setForm(initialFormState)}
              >
                Limpar campos
              </Button>
            </div>
          </form>
        </aside>

        <section className="rounded-[32px] border border-[#D8E6EB] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Leitura</p>
              <h2 className="mt-1 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">
                {activeTutorial.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#5F7077]">{activeTutorial.summary}</p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl border-[#D8E6EB] bg-white font-black text-[#163138] hover:border-[#1398B7]/40 hover:bg-[#F2FBFD]"
                onClick={() => openTutorial(activeTutorial.id)}
              >
                Abrir no painel
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-4">
            {activeTutorial.steps.map((step, index) => (
              <article key={`${activeTutorial.id}-${step.title}`} className="rounded-[28px] border border-[#D8E6EB] bg-[#F8FBFC] p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1398B7] text-sm font-black text-white shadow-sm">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black tracking-tight text-[#15323b]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#5F7077]">{step.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-[28px] border border-[#BEE3EA] bg-[#F2FBFD] p-5">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[#0E677C]">Dicas rápidas</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#155160]">
              {activeTutorial.notes.map((note) => (
                <li key={note} className="flex gap-2">
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#1398B7]" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" className="h-11 rounded-2xl bg-[#1398B7] px-5 font-black text-white hover:bg-[#1089A5]" onClick={() => openTutorial(activeTutorial.id)}>
              Ler no painel lateral
            </Button>
            <Button type="button" variant="outline" className="h-11 rounded-2xl border-[#D8E6EB] bg-white px-5 font-black text-[#163138] hover:border-[#1398B7]/40 hover:bg-[#F2FBFD]" onClick={() => selectTutorial(activeTutorial.id)}>
              Recarregar tutorial
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
