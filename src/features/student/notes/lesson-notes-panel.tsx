import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { LessonNote } from '@/types/content';
import { deleteLessonNote, fetchLessonNote, upsertLessonNote, } from './api';
interface LessonNotesPanelProps {
    lessonId: string;
    userId: string;
}
function formatUpdatedAt(value: string | null) {
    if (!value)
        return null;
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}
export function LessonNotesPanel({ lessonId, userId, }: LessonNotesPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [draft, setDraft] = useState('');
    const [savedValue, setSavedValue] = useState('');
    const [note, setNote] = useState<LessonNote | null>(null);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const statusTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        let isMounted = true;
        async function loadNote() {
            setIsLoading(true);
            setError(null);
            try {
                const currentNote = await fetchLessonNote(lessonId);
                if (!isMounted)
                    return;
                setNote(currentNote);
                setDraft(currentNote?.note_text ?? '');
                setSavedValue(currentNote?.note_text ?? '');
                setIsOpen(Boolean(currentNote?.note_text));
            }
            catch (loadError) {
                if (!isMounted)
                    return;
                setError(loadError instanceof Error ? loadError.message : "N?o foi possvel carregar a anotacao.");
            }
            finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }
        void loadNote();
        return () => {
            isMounted = false;
            if (statusTimeoutRef.current) {
                window.clearTimeout(statusTimeoutRef.current);
            }
        };
    }, [lessonId]);
    useEffect(() => {
        if (!isOpen || isLoading || isDeleting) {
            return;
        }
        const trimmedDraft = draft.trim();
        const trimmedSaved = savedValue.trim();
        if (!trimmedDraft || trimmedDraft === trimmedSaved) {
            return;
        }
        setStatus('saving');
        setError(null);
        const timeoutId = window.setTimeout(() => {
            void (async () => {
                try {
                    const savedNote = await upsertLessonNote({
                        user_id: userId,
                        lesson_id: lessonId,
                        note_text: trimmedDraft,
                    });
                    setNote(savedNote);
                    setSavedValue(savedNote.note_text);
                    setDraft(savedNote.note_text);
                    setStatus('saved');
                    if (statusTimeoutRef.current) {
                        window.clearTimeout(statusTimeoutRef.current);
                    }
                    statusTimeoutRef.current = window.setTimeout(() => setStatus('idle'), 2000);
                }
                catch (saveError) {
                    setStatus('error');
                    setError(saveError instanceof Error ? saveError.message : "N?o foi possvel salvar a anotacao.");
                }
            })();
        }, 700);
        return () => window.clearTimeout(timeoutId);
    }, [draft, isDeleting, isLoading, isOpen, lessonId, savedValue, userId]);
    async function handleDeleteNote() {
        if (!note)
            return;
        setIsDeleting(true);
        setError(null);
        try {
            await deleteLessonNote({
                user_id: userId,
                lesson_id: lessonId,
            });
            setNote(null);
            setDraft('');
            setSavedValue('');
            setStatus('idle');
        }
        catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "N?o foi possvel excluir a anotacao.");
        }
        finally {
            setIsDeleting(false);
        }
    }
    const updatedAtLabel = formatUpdatedAt(note?.updated_at ?? null);
    return (<section className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">Bloco de N?otas
              </span>
              {updatedAtLabel ? (<span className="text-xs font-medium text-slate-500">
                  Atualizado em {updatedAtLabel}
                </span>) : null}
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500">Registre insights, pontos de revisão e observações dest? aula.
            </p>
          </div>

          <Button type="button" variant={isOpen ? 'outline' : 'default'} onClick={() => setIsOpen((current) => !current)} className={isOpen ? 'rounded-xl border-slate-200 bg-white font-bold text-slate-700' : 'rounded-xl bg-slate-900 font-bold text-white hover:bg-slate-800'}>
            {isOpen ? 'Fechar bloco de notas' : 'Abrir bloco de notas'}
          </Button>
        </div>
      </div>

      {isOpen ? (<div className="space-y-4 p-6 sm:p-8">
          {isLoading ? (<div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm font-medium text-slate-500">
              Carregando anotacoes...
            </div>) : (<>
              <textarea value={draft} onChange={(event) => {
                    setDraft(event.target.value);
                    if (status !== 'saving') {
                        setStatus('idle');
                    }
                }} placeholder="Escreva aqui suas anotacoes dest? aula. O texto sera salvo automticamente." className="min-h-[240px] w-full rounded-[28px] border border-slate-200 bg-slate-50/50 px-5 py-4 text-sm font-medium leading-7 text-slate-700 shadow-inner focus:border-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-100"/>

              <div className="flex flex-col gap-3 rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1 text-sm font-medium text-slate-500">
                  <p>
                    {status === 'saving'
                    ? "Salvando anotacao automticamente..." : status === 'saved'
                    ? "Anotacao salva automticamente." : draft.trim().length === 0
                    ? "Digite para criar sua anotacao. O salvamento acontece automticamente." : "As altera\u00E7\u00F5es ser\u00E3o salvas automticamente em instantes."}
                  </p>
                  {error ? <p className="font-bold text-rose-600">{error}</p> : null}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {note ? (<Button type="button" variant="outline" disabled={isDeleting} onClick={() => void handleDeleteNote()} className="rounded-xl border-rose-200 bg-white font-bold text-rose-600 hover:bg-rose-50">
                      {isDeleting ? 'Excluindo...' : 'Excluir nota'}
                    </Button>) : null}
                </div>
              </div>
            </>)}
        </div>) : note?.note_text ? (<div className="px-6 py-6 sm:px-8">
          <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Ultima anotacao</p>
            <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-700">
              {note.note_text}
            </p>
          </div>
        </div>) : null}
    </section>);
}
