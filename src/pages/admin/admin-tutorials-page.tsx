import { ArrowRight, BookOpen, Clock3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminTutorials } from '@/features/admin/tutorials/admin-tutorials';

export function AdminTutorialsPage() {
  const { tutorials, activeTutorial, selectTutorial, openTutorial } = useAdminTutorials();

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
              Selecione um tutorial para ler os passos na página ou no painel lateral.
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
              <Button type="button" variant="outline" className="rounded-2xl border-[#D8E6EB] bg-white font-black text-[#163138] hover:border-[#1398B7]/40 hover:bg-[#F2FBFD]" onClick={() => openTutorial(activeTutorial.id)}>
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
