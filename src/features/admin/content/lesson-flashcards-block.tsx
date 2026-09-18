import { useState, useMemo, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Plus, Trash2, ArrowUp, ArrowDown, Sparkles, BookOpen, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LessonFlashcardItem, LessonFlashcardsBlockContent } from '@/types/content';
import { normalizeLessonFlashcardsBlockContent } from './content-blocks';

/**
 * Algoritmo Fisher-Yates para embaralhamento não mutável.
 * Garante uma distribuição estatisticamente uniforme sem alterar o array original.
 */
export function shuffleFlashcards(cards: LessonFlashcardItem[]): LessonFlashcardItem[] {
    const copy = [...cards];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }
    return copy;
}

interface LessonFlashcardsBlockEditorProps {
    content: LessonFlashcardsBlockContent;
    onChange: (content: LessonFlashcardsBlockContent) => void;
    onError?: (message: string | null) => void;
}

export function LessonFlashcardsBlockEditor({
    content,
    onChange,
}: LessonFlashcardsBlockEditorProps) {
    const normalized = useMemo(() => normalizeLessonFlashcardsBlockContent(content), [content]);

    function emit(nextContent: LessonFlashcardsBlockContent) {
        onChange(normalizeLessonFlashcardsBlockContent(nextContent));
    }

    function addCard() {
        const newCard: LessonFlashcardItem = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}`,
            question: '',
            answer: '',
        };
        emit({
            ...normalized,
            cards: [...normalized.cards, newCard],
        });
    }

    function updateCard(index: number, updates: Partial<LessonFlashcardItem>) {
        const nextCards = normalized.cards.map((card, i) => (i === index ? { ...card, ...updates } : card));
        emit({
            ...normalized,
            cards: nextCards,
        });
    }

    function removeCard(index: number) {
        const card = normalized.cards[index];
        if (card && (card.question.trim() || card.answer.trim())) {
            const confirmed = window.confirm(`Deseja excluir o Cartão ${index + 1}? O conteúdo digitado será perdido.`);
            if (!confirmed) {
                return;
            }
        }
        const nextCards = normalized.cards.filter((_, i) => i !== index);
        emit({
            ...normalized,
            cards: nextCards,
        });
    }

    function moveCard(index: number, direction: 'up' | 'down') {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= normalized.cards.length) {
            return;
        }
        const nextCards = [...normalized.cards];
        const temp = nextCards[index];
        nextCards[index] = nextCards[targetIndex];
        nextCards[targetIndex] = temp;
        emit({
            ...normalized,
            cards: nextCards,
        });
    }

    return (
        <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
            <div className="border-b border-slate-100 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                            <Layers className="h-4 w-4" />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-teal-700">
                            Flashcards de Memorização
                        </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {normalized.cards.length} {normalized.cards.length === 1 ? 'cartão' : 'cartões'}
                    </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                    Cadastre perguntas e respostas para os alunos fixarem conteúdos. No ambiente do aluno, a ordem dos cartões é automaticamente embaralhada a cada novo uso.
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Título da Atividade
                    </span>
                    <input
                        type="text"
                        value={normalized.title ?? ''}
                        onChange={(e) => emit({ ...normalized, title: e.target.value })}
                        placeholder="Ex: Flashcards de Memorização"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
                    />
                </label>

                <label className="block space-y-1.5">
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Instruções de Apoio (Opcional)
                    </span>
                    <input
                        type="text"
                        value={normalized.description ?? ''}
                        onChange={(e) => emit({ ...normalized, description: e.target.value })}
                        placeholder="Ex: Teste sua memória antes da prova..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
                    />
                </label>
            </div>

            {normalized.cards.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
                    <p className="text-sm font-bold text-slate-700">Nenhum cartão cadastrado ainda</p>
                    <p className="mt-1 text-xs text-slate-500">Clique no botão abaixo para adicionar o primeiro cartão de memorização.</p>
                    <Button
                        type="button"
                        onClick={addCard}
                        className="mt-4 bg-teal-600 text-white hover:bg-teal-700 shadow-sm"
                    >
                        <Plus className="mr-1.5 h-4 w-4" />
                        Adicionar Primeiro Cartão
                    </Button>
                </div>
            ) : (
                <div className="space-y-4">
                    {normalized.cards.map((card, index) => (
                        <div
                            key={card.id || `card-${index}`}
                            className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5 transition hover:bg-white hover:shadow-sm"
                        >
                            <div className="mb-3 flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-100 text-xs font-black text-teal-800">
                                        {index + 1}
                                    </span>
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                                        Cartão {index + 1}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-teal-600"
                                        title="Mover para cima"
                                        disabled={index === 0}
                                        onClick={() => moveCard(index, 'up')}
                                    >
                                        <ArrowUp className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-teal-600"
                                        title="Mover para baixo"
                                        disabled={index === normalized.cards.length - 1}
                                        onClick={() => moveCard(index, 'down')}
                                    >
                                        <ArrowDown className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-slate-400 hover:text-rose-600"
                                        title="Excluir cartão"
                                        onClick={() => removeCard(index)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="block space-y-1.5">
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                        <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                                        Pergunta <span className="text-rose-500">*</span>
                                    </span>
                                    <textarea
                                        rows={3}
                                        value={card.question}
                                        onChange={(e) => updateCard(index, { question: e.target.value })}
                                        placeholder="Digite a pergunta ou conceito a ser lembrado..."
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-y"
                                    />
                                </label>

                                <label className="block space-y-1.5">
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                        Resposta <span className="text-rose-500">*</span>
                                    </span>
                                    <textarea
                                        rows={3}
                                        value={card.answer}
                                        onChange={(e) => updateCard(index, { answer: e.target.value })}
                                        placeholder="Digite a resposta que será revelada..."
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-y"
                                    />
                                </label>
                            </div>
                        </div>
                    ))}

                    <div className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={addCard}
                            className="border-dashed border-teal-300 bg-teal-50/50 text-teal-800 hover:bg-teal-100 hover:text-teal-900 font-bold text-xs"
                        >
                            <Plus className="mr-1.5 h-4 w-4" />
                            Adicionar Cartão
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

interface LessonFlashcardsBlockRendererProps {
    content: LessonFlashcardsBlockContent;
    className?: string;
}

export function LessonFlashcardsBlockRenderer({ content, className }: LessonFlashcardsBlockRendererProps) {
    const normalized = useMemo(() => normalizeLessonFlashcardsBlockContent(content), [content]);
    const cardsFingerprint = useMemo(() => {
        return normalized.cards.map((c) => `${c.id}::${c.question}::${c.answer}`).join('||');
    }, [normalized.cards]);

    return (
        <FlashcardsSession
            key={cardsFingerprint}
            content={normalized}
            className={className}
        />
    );
}

function FlashcardsSession({ content, className }: LessonFlashcardsBlockRendererProps) {
    const normalized = content;

    // Estado da atividade
    const [hasStarted, setHasStarted] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const [shuffledCards, setShuffledCards] = useState<LessonFlashcardItem[]>(() => {
        return shuffleFlashcards(normalized.cards);
    });

    const totalCards = shuffledCards.length;
    const currentCard = totalCards > 0 ? shuffledCards[currentIndex] : null;

    function handleStart() {
        // Gera um novo embaralhamento ao iniciar a atividade
        setShuffledCards(shuffleFlashcards(normalized.cards));
        setCurrentIndex(0);
        setIsRevealed(false);
        setHasStarted(true);
    }

    function handleRestart() {
        setShuffledCards(shuffleFlashcards(normalized.cards));
        setCurrentIndex(0);
        setIsRevealed(false);
        setHasStarted(false);
    }

    function handleToggleReveal() {
        setIsRevealed((prev) => !prev);
    }

    function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleToggleReveal();
        }
    }

    function handleNext() {
        if (currentIndex < totalCards - 1) {
            setCurrentIndex((prev) => prev + 1);
            setIsRevealed(false);
        }
    }

    function handlePrev() {
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
            setIsRevealed(false);
        }
    }

    // Se não houver cartões configurados, renderiza fallback amigável
    if (totalCards === 0) {
        return (
            <div className={cn('my-8 rounded-[28px] border border-slate-200 bg-slate-50/60 p-8 text-center text-slate-500', className)}>
                <BookOpen className="mx-auto h-8 w-8 text-slate-400 mb-2 opacity-60" />
                <p className="text-sm font-bold text-slate-700">Atividade de Flashcards</p>
                <p className="mt-1 text-xs text-slate-500">Nenhum cartão disponível nesta atividade.</p>
            </div>
        );
    }

    return (
        <div className={cn('my-8 overflow-hidden rounded-[32px] border border-slate-200/90 bg-white shadow-sm', className)}>
            {/* Header com branding Genflix */}
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
                        <Layers className="h-4 w-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black tracking-tight text-slate-900">
                            {normalized.title || 'Flashcards de Memorização'}
                        </h4>
                        <p className="text-xs text-slate-500">Atividade interativa de fixação de conceitos</p>
                    </div>
                </div>

                {hasStarted && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRestart}
                        className="h-8 rounded-full px-3 text-xs font-bold text-slate-500 hover:text-teal-700 hover:bg-teal-50"
                        title="Reiniciar e re-embaralhar"
                    >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Reiniciar
                    </Button>
                )}
            </div>

            {/* Corpo da atividade */}
            <div className="p-4 sm:p-6 md:p-8">
                {!hasStarted ? (
                    /* ESTADO A: ABERTURA */
                    <div className="mx-auto max-w-lg text-center py-6 sm:py-10 space-y-6">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-50 text-teal-600 ring-8 ring-teal-50/50 shadow-inner">
                            <Sparkles className="h-8 w-8" />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-2xl font-black tracking-tight text-slate-900">
                                {normalized.title || 'Flashcards de Memorização'}
                            </h3>
                            <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                                {normalized.description || 'Teste sua memória com os cartões a seguir. Leia a pergunta, pense na resposta e clique no cartão para conferir.'}
                            </p>
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600">
                            <span>{totalCards} {totalCards === 1 ? 'cartão disponível' : 'cartões disponíveis'}</span>
                            <span>•</span>
                            <span>Ordem aleatória</span>
                        </div>

                        <div>
                            <Button
                                type="button"
                                onClick={handleStart}
                                className="rounded-2xl bg-teal-600 hover:bg-teal-700 px-8 py-6 text-sm font-black text-white shadow-md transition hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Começar Atividade
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* ESTADOS B & C: PERGUNTA / RESPOSTA */
                    <div className="mx-auto max-w-3xl space-y-6">
                        {/* Cartão Clicável e Acessível */}
                        <div
                            role="button"
                            tabIndex={0}
                            aria-expanded={isRevealed}
                            aria-label={
                                isRevealed
                                    ? `Pergunta: ${currentCard?.question}. Resposta: ${currentCard?.answer}. Clique para ocultar a resposta.`
                                    : `Pergunta: ${currentCard?.question}. Clique para ver a resposta.`
                            }
                            onClick={handleToggleReveal}
                            onKeyDown={handleCardKeyDown}
                            className={cn(
                                'group relative cursor-pointer select-none rounded-[26px] border-2 p-6 sm:p-8 transition-all duration-300 outline-none',
                                'focus-visible:ring-4 focus-visible:ring-teal-200 focus-visible:border-teal-500',
                                isRevealed
                                    ? 'border-teal-500/80 bg-gradient-to-br from-teal-50/40 via-white to-emerald-50/20 shadow-md'
                                    : 'border-slate-200 bg-white hover:border-teal-300 hover:shadow-lg'
                            )}
                        >
                            {!isRevealed ? (
                                /* ESTADO B: SOMENTE PERGUNTA */
                                <div className="space-y-6 animate-in fade-in duration-200 motion-reduce:transition-none">
                                    <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-blue-700">
                                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                                            Pergunta
                                        </span>
                                        <span className="text-[11px] font-bold text-slate-400">
                                            Cartão {currentIndex + 1} de {totalCards}
                                        </span>
                                    </div>

                                    <div className="min-h-[140px] flex items-center justify-center text-center px-2 py-4">
                                        <p className="text-lg sm:text-xl font-extrabold text-slate-800 leading-snug whitespace-pre-wrap">
                                            {currentCard?.question}
                                        </p>
                                    </div>

                                    <div className="pt-2 text-center border-t border-slate-100">
                                        <p className="text-xs font-bold text-teal-700/90 group-hover:text-teal-800 transition-colors">
                                            💡 Clique no cartão para ver a resposta
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                /* ESTADO C: RESPOSTA REVELADA */
                                /* Em desktop: duas colunas lado a lado. Em telas menores: verticalmente empilhado */
                                <div className="animate-in fade-in duration-300 motion-reduce:transition-none">
                                    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-700">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                            Resposta Revelada
                                        </span>
                                        <span className="text-[11px] font-bold text-slate-400">
                                            Cartão {currentIndex + 1} de {totalCards}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[150px] items-stretch">
                                        {/* Pergunta */}
                                        <div className="rounded-2xl bg-slate-50/80 p-5 border border-slate-100 flex flex-col justify-between">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                                                    Pergunta
                                                </span>
                                                <p className="text-base font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
                                                    {currentCard?.question}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Resposta */}
                                        <div className="rounded-2xl bg-teal-50/70 p-5 border border-teal-100 flex flex-col justify-between">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 block mb-2">
                                                    Resposta
                                                </span>
                                                <p className="text-base sm:text-lg font-extrabold text-teal-950 leading-relaxed whitespace-pre-wrap">
                                                    {currentCard?.answer}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 text-center border-t border-slate-100">
                                        <p className="text-xs font-semibold text-slate-400">
                                            Clique no cartão para ocultar a resposta
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Barra de Navegação no Rodapé: Anterior | Cartão X/N | Próximo */}
                        <div className="flex items-center justify-between gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handlePrev}
                                disabled={currentIndex === 0}
                                className={cn(
                                    'rounded-xl border-slate-200 px-4 py-2 font-bold text-xs transition',
                                    currentIndex === 0
                                        ? 'opacity-40 cursor-not-allowed bg-slate-50'
                                        : 'bg-white hover:bg-slate-50 text-slate-700'
                                )}
                            >
                                <ChevronLeft className="mr-1 h-4 w-4" />
                                Anterior
                            </Button>

                            <div className="flex flex-col items-center">
                                <span className="text-sm font-black tracking-tight text-slate-800">
                                    Cartão {currentIndex + 1}/{totalCards}
                                </span>
                                <div className="mt-1 flex items-center gap-1">
                                    {shuffledCards.map((_, i) => (
                                        <span
                                            key={i}
                                            className={cn(
                                                'h-1.5 rounded-full transition-all duration-300',
                                                i === currentIndex
                                                    ? 'w-5 bg-teal-600'
                                                    : 'w-1.5 bg-slate-200'
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleNext}
                                disabled={currentIndex === totalCards - 1}
                                className={cn(
                                    'rounded-xl border-slate-200 px-4 py-2 font-bold text-xs transition',
                                    currentIndex === totalCards - 1
                                        ? 'opacity-40 cursor-not-allowed bg-slate-50'
                                        : 'bg-teal-600 hover:bg-teal-700 text-white border-transparent'
                                )}
                            >
                                Próximo
                                <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
