import { useState, useMemo, type KeyboardEvent } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    Plus,
    Trash2,
    ArrowUp,
    ArrowDown,
    Sparkles,
    BookOpen,
    Layers,
    Image as ImageIcon,
    MessageSquareText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LessonFlashcardItem, LessonFlashcardsBlockContent } from '@/types/content';
import { normalizeLessonFlashcardsBlockContent } from './content-blocks';
import { MediaLibraryModal } from '@/features/site-assets/media-library-modal';
import type { SiteAsset } from '@/features/site-editor/types';
import { resolveSiteAssetPublicUrl, normalizeSiteAssetPublicUrl } from '@/features/site-assets/public-url';

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
    const [mediaLibraryCardIndex, setMediaLibraryCardIndex] = useState<number | null>(null);

    function emit(nextContent: LessonFlashcardsBlockContent) {
        onChange(normalizeLessonFlashcardsBlockContent(nextContent));
    }

    function addCard() {
        const newCard: LessonFlashcardItem = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `card-${Date.now()}`,
            question: '',
            answer: '',
            allow_student_answer: false,
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
        if (card && (card.question.trim() || card.answer.trim() || card.image_url)) {
            const confirmed = window.confirm(`Deseja excluir o Cartão ${index + 1}? O conteúdo cadastrado será perdido.`);
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

    function handleMediaAssetSelected(asset: SiteAsset) {
        if (mediaLibraryCardIndex === null) return;
        const canonicalUrl = resolveSiteAssetPublicUrl(asset);
        updateCard(mediaLibraryCardIndex, {
            image_url: canonicalUrl || undefined,
            image_alt: asset.alt || '',
            media_asset_id: asset.id,
        });
        setMediaLibraryCardIndex(null);
    }

    function handleRemoveImageFromCard(index: number) {
        // Apenas desfaz a associação no cartão; NUNCA exclui o arquivo da Biblioteca de Mídia
        updateCard(index, {
            image_url: undefined,
            image_alt: undefined,
            media_asset_id: undefined,
        });
    }

    const activeCardForMediaLibrary = mediaLibraryCardIndex !== null ? normalized.cards[mediaLibraryCardIndex] : null;

    return (
        <div className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
            {/* Modal Reutilizável da Biblioteca de Mídia Genflix */}
            <MediaLibraryModal
                isOpen={mediaLibraryCardIndex !== null}
                onClose={() => setMediaLibraryCardIndex(null)}
                onSelect={handleMediaAssetSelected}
                selectedAssetId={activeCardForMediaLibrary?.media_asset_id}
                title={`Escolher imagem para o Cartão ${(mediaLibraryCardIndex ?? 0) + 1}`}
            />

            {/* Cabeçalho do Editor */}
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
                    Cadastre perguntas e respostas para fixação de conteúdos. Cada cartão pode conter opcionalmente uma imagem (selecionada na Biblioteca de Mídia) e um campo para o aluno digitar sua resposta.
                </p>
            </div>

            {/* Configurações Gerais */}
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

            {/* Lista de Cartões */}
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
                <div className="space-y-6">
                    {normalized.cards.map((card, index) => {
                        const hasImageOption = Boolean(card.image_url || card.media_asset_id);

                        return (
                            <div
                                key={card.id || `card-${index}`}
                                className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5 transition hover:bg-white hover:shadow-sm space-y-4"
                            >
                                {/* Barra Superior do Cartão */}
                                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
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

                                {/* Opções da Composição do Cartão */}
                                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 space-y-3">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        Estrutura do Cartão
                                    </p>
                                    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={hasImageOption}
                                                onChange={(e) => {
                                                    if (!e.target.checked) {
                                                        handleRemoveImageFromCard(index);
                                                    } else {
                                                        setMediaLibraryCardIndex(index);
                                                    }
                                                }}
                                                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                            />
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                                <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
                                                Adicionar imagem
                                            </span>
                                        </label>

                                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(card.allow_student_answer)}
                                                onChange={(e) => updateCard(index, { allow_student_answer: e.target.checked })}
                                                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                            />
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                                <MessageSquareText className="h-3.5 w-3.5 text-slate-500" />
                                                Permitir resposta do aluno
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                {/* Seção de Imagem do Cartão */}
                                {hasImageOption && (
                                    <div className="rounded-xl border border-dashed border-teal-200 bg-teal-50/30 p-4 space-y-3">
                                        <p className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                                            <ImageIcon className="h-4 w-4 text-teal-600" />
                                            IMAGEM DO CARTÃO
                                        </p>

                                        {card.image_url ? (
                                            /* State: Imagem selecionada */
                                            <div className="space-y-3">
                                                <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-slate-200 bg-white p-3">
                                                    <div className="relative flex h-28 w-full sm:w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-900/5 border border-slate-200">
                                                        <img
                                                            src={normalizeSiteAssetPublicUrl(card.image_url) ?? card.image_url}
                                                            alt={card.image_alt || 'Preview'}
                                                            className="max-h-full max-w-full object-contain"
                                                        />
                                                    </div>
                                                    <div className="flex-1 space-y-3 w-full">
                                                        <label className="block space-y-1">
                                                            <span className="text-[11px] font-bold text-slate-600">
                                                                Texto Alternativo (alt)
                                                            </span>
                                                            <input
                                                                type="text"
                                                                value={card.image_alt ?? ''}
                                                                onChange={(e) => updateCard(index, { image_alt: e.target.value })}
                                                                placeholder="Descrição da imagem para leitores de tela..."
                                                                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-teal-500"
                                                            />
                                                        </label>

                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() => setMediaLibraryCardIndex(index)}
                                                                className="h-8 rounded-lg border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
                                                            >
                                                                Trocar imagem
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                onClick={() => handleRemoveImageFromCard(index)}
                                                                className="h-8 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50"
                                                            >
                                                                Remover do cartão
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* State: Nenhuma imagem selecionada */
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-bold text-slate-700">Nenhuma imagem selecionada</p>
                                                    <p className="text-[11px] text-slate-500">Escolha uma imagem da Biblioteca de Mídia.</p>
                                                </div>

                                                <Button
                                                    type="button"
                                                    onClick={() => setMediaLibraryCardIndex(index)}
                                                    className="w-full sm:w-auto rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 shadow-sm"
                                                >
                                                    <ImageIcon className="mr-1.5 h-4 w-4" />
                                                    Selecionar imagem
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Pergunta e Resposta */}
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
                                            Resposta Oficial <span className="text-rose-500">*</span>
                                        </span>
                                        <textarea
                                            rows={3}
                                            value={card.answer}
                                            onChange={(e) => updateCard(index, { answer: e.target.value })}
                                            placeholder="Digite a resposta oficial cadastrada..."
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-y"
                                        />
                                    </label>
                                </div>
                            </div>
                        );
                    })}

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
        return normalized.cards
            .map((c) => `${c.id}::${c.question}::${c.answer}::${c.image_url || ''}::${Boolean(c.allow_student_answer)}`)
            .join('||');
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
    const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
    const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>({});
    const [shuffledCards, setShuffledCards] = useState<LessonFlashcardItem[]>(() => {
        return shuffleFlashcards(normalized.cards);
    });

    const totalCards = shuffledCards.length;
    const currentCard = totalCards > 0 ? shuffledCards[currentIndex] : null;

    function handleStart() {
        setShuffledCards(shuffleFlashcards(normalized.cards));
        setCurrentIndex(0);
        setIsRevealed(false);
        setStudentAnswers({});
        setFailedImageIds({});
        setHasStarted(true);
    }

    function handleRestart() {
        setShuffledCards(shuffleFlashcards(normalized.cards));
        setCurrentIndex(0);
        setIsRevealed(false);
        setStudentAnswers({});
        setFailedImageIds({});
        setHasStarted(false);
    }

    function handleToggleReveal() {
        if (!isRevealed) {
            setIsRevealed(true);
        }
    }

    function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (currentCard?.allow_student_answer || isRevealed) {
            return;
        }
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

    const cardId = currentCard?.id ?? '';
    const hasImage = Boolean(currentCard?.image_url) && !failedImageIds[cardId];
    const resolvedImageUrl = currentCard?.image_url ? (normalizeSiteAssetPublicUrl(currentCard.image_url) ?? currentCard.image_url) : null;
    const allowStudentAnswer = Boolean(currentCard?.allow_student_answer);
    const currentTypedAnswer = currentCard ? (studentAnswers[currentCard.id] || '') : '';

    return (
        <div className={cn('hcm-flashcard-container my-8 overflow-hidden rounded-[32px] border border-slate-200/90 bg-white shadow-sm', className)}>
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
                                {normalized.description || 'Teste sua memória com os cartões a seguir. Leia a pergunta, pense na resposta e confira.'}
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
                        {/* Cartão Interativo */}
                        {(() => {
                            const isClickable = !allowStudentAnswer && !isRevealed;
                            return (
                                <div
                                    role={isClickable ? 'button' : 'region'}
                                    tabIndex={isClickable ? 0 : undefined}
                                    aria-expanded={isClickable ? isRevealed : undefined}
                                    aria-label={
                                        allowStudentAnswer
                                            ? `Cartão ${currentIndex + 1} de ${totalCards}`
                                            : isRevealed
                                                ? `Pergunta: ${currentCard?.question}. Resposta: ${currentCard?.answer}.`
                                                : `Pergunta: ${currentCard?.question}. Clique para ver a resposta.`
                                    }
                                    onClick={isClickable ? handleToggleReveal : undefined}
                                    onKeyDown={isClickable ? handleCardKeyDown : undefined}
                                    className={cn(
                                        'hcm-flashcard-card group relative rounded-[26px] border-2 p-6 sm:p-8 transition-all duration-300 outline-none',
                                        isClickable ? 'cursor-pointer select-none' : 'cursor-default',
                                        isClickable && 'focus-visible:ring-4 focus-visible:ring-teal-200 focus-visible:border-teal-500',
                                        isRevealed
                                            ? 'border-teal-500/80 bg-gradient-to-br from-teal-50/30 via-white to-emerald-50/20 shadow-md'
                                            : 'border-slate-200 bg-white hover:border-teal-300 hover:shadow-lg'
                                    )}
                                >
                                    {/* IMAGEM OPCIONAL (Sempre posicionada acima da pergunta se existir) */}
                                    {hasImage && resolvedImageUrl && (
                                        <div className="mb-6 flex items-center justify-center rounded-2xl bg-slate-900/5 p-3 border border-slate-100 max-h-[280px] overflow-hidden">
                                            <img
                                                src={resolvedImageUrl}
                                                alt={currentCard?.image_alt || 'Imagem da pergunta'}
                                                onError={() => {
                                                    if (cardId) {
                                                        setFailedImageIds((prev) => ({ ...prev, [cardId]: true }));
                                                    }
                                                }}
                                                className="max-h-[250px] w-auto max-w-full object-contain rounded-xl shadow-xs"
                                            />
                                        </div>
                                    )}

                                    {!isRevealed ? (
                                        /* ESTADO B: SOMENTE PERGUNTA (E CAMPO DO ALUNO SE HABILITADO) */
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

                                            <div className="min-h-[100px] flex items-center justify-center text-center px-2 py-2">
                                                <p className="text-base sm:text-lg font-bold text-slate-900 leading-snug whitespace-pre-wrap">
                                                    {currentCard?.question}
                                                </p>
                                            </div>

                                            {/* Campo Opcional para o aluno digitar sua resposta */}
                                            {allowStudentAnswer ? (
                                                <div
                                                    className="space-y-3 pt-4 border-t border-slate-100"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <label className="block space-y-1.5 text-left">
                                                        <span className="text-xs font-bold text-slate-700 block">
                                                            Sua resposta (opcional):
                                                        </span>
                                                        <textarea
                                                            rows={3}
                                                            value={currentTypedAnswer}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (currentCard) {
                                                                    setStudentAnswers((prev) => ({
                                                                        ...prev,
                                                                        [currentCard.id]: val,
                                                                    }));
                                                                }
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onKeyDown={(e) => {
                                                                e.stopPropagation();
                                                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    setIsRevealed(true);
                                                                }
                                                            }}
                                                            placeholder="Digite sua resposta antes de conferir..."
                                                            className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-y"
                                                        />
                                                    </label>

                                                    <div className="flex items-center justify-end pt-1">
                                                        <Button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIsRevealed(true);
                                                            }}
                                                            className="w-full sm:w-auto rounded-xl bg-teal-600 hover:bg-teal-700 px-6 py-2.5 text-xs font-black text-white shadow-sm transition"
                                                        >
                                                            Conferir resposta
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="pt-2 text-center border-t border-slate-100">
                                                    <p className="text-xs font-bold text-teal-700/90 group-hover:text-teal-800 transition-colors">
                                                        💡 Clique no cartão para ver a resposta
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* ESTADO C: RESPOSTA REVELADA */
                                        <div className="animate-in fade-in duration-300 motion-reduce:transition-none space-y-6">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-900">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                                    Resposta Revelada
                                                </span>
                                                <span className="text-[11px] font-extrabold text-slate-600">
                                                    Cartão {currentIndex + 1} de {totalCards}
                                                </span>
                                            </div>

                                            {/* Exibição quando O ALUNO DIGITOU RESPOSTA */}
                                            {allowStudentAnswer ? (
                                                <div className="space-y-4">
                                                    {/* Pergunta */}
                                                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                                                            Pergunta
                                                        </span>
                                                        <p className="text-xs sm:text-sm font-bold text-slate-900 leading-relaxed whitespace-pre-wrap">
                                                            {currentCard?.question}
                                                        </p>
                                                    </div>

                                                    {/* Sua Resposta */}
                                                    <div className="rounded-2xl bg-slate-100/90 p-4 border border-slate-200">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                                                            Sua resposta
                                                        </span>
                                                        <p className="text-xs sm:text-sm font-normal text-slate-950 leading-relaxed whitespace-pre-wrap">
                                                            {currentTypedAnswer.trim() ? (
                                                                currentTypedAnswer
                                                            ) : (
                                                                <span className="italic text-slate-500 font-medium">Nenhuma resposta digitada.</span>
                                                            )}
                                                        </p>
                                                    </div>

                                                    {/* Resposta Oficial */}
                                                    <div className="rounded-2xl bg-teal-50 p-5 border border-teal-200">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-teal-900 block mb-1">
                                                            Resposta Oficial do Professor
                                                        </span>
                                                        <p className="text-sm sm:text-base font-normal text-teal-950 leading-relaxed whitespace-pre-wrap">
                                                            {currentCard?.answer}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Exibição padrão sem campo de resposta (Duas colunas em desktop, empilhado em mobile) */
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[150px] items-stretch">
                                                    {/* Pergunta */}
                                                    <div className="rounded-2xl bg-slate-50 p-5 border border-slate-200 flex flex-col justify-between">
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-2">
                                                                Pergunta
                                                            </span>
                                                            <p className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed whitespace-pre-wrap">
                                                                {currentCard?.question}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Resposta */}
                                                    <div className="rounded-2xl bg-teal-50 p-5 border border-teal-200 flex flex-col justify-between">
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-teal-900 block mb-2">
                                                                Resposta
                                                            </span>
                                                            <p className="text-sm sm:text-base font-normal text-teal-950 leading-relaxed whitespace-pre-wrap">
                                                                {currentCard?.answer}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Barra de Navegação no Rodapé: Anterior | Cartão X/N | Próximo */}
                        <div className="flex items-center justify-between gap-2 sm:gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handlePrev}
                                disabled={currentIndex === 0}
                                className={cn(
                                    'shrink-0 rounded-xl border-slate-200 px-3 sm:px-4 py-2 font-bold text-xs transition',
                                    currentIndex === 0
                                        ? 'opacity-40 cursor-not-allowed bg-slate-50'
                                        : 'bg-white hover:bg-slate-50 text-slate-700'
                                )}
                            >
                                <ChevronLeft className="mr-1 h-4 w-4 shrink-0" />
                                Anterior
                            </Button>

                            <div className="flex items-center justify-center px-1 sm:px-2 text-center">
                                <span className="text-xs sm:text-sm font-black tracking-tight text-slate-800 whitespace-nowrap">
                                    Cartão {currentIndex + 1}/{totalCards}
                                </span>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleNext}
                                disabled={currentIndex === totalCards - 1}
                                className={cn(
                                    'shrink-0 rounded-xl border-slate-200 px-3 sm:px-4 py-2 font-bold text-xs transition',
                                    currentIndex === totalCards - 1
                                        ? 'opacity-40 cursor-not-allowed bg-slate-50'
                                        : 'bg-teal-600 hover:bg-teal-700 text-white border-transparent'
                                )}
                            >
                                Próximo
                                <ChevronRight className="ml-1 h-4 w-4 shrink-0" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
