import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AssessmentInteractionContent, ImageHotspotInteractionContent, ImageHotspotTarget } from '@/types/content';
import { deleteAssessmentAsset, uploadAssessmentAsset, } from './api';
interface ImageHotspotQuestionEditorProps {
    content: ImageHotspotInteractionContent;
    onDraftChange: (content: AssessmentInteractionContent) => void;
    onPersist: (content: AssessmentInteractionContent) => Promise<void> | void;
    onError: (message: string | null) => void;
}
const DEFAULT_TARGET_WIDTH = 18;
const DEFAULT_TARGET_HEIGHT = 12;
const MIN_SIZE_PERCENT = 2;
function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}
function roundPercent(value: number) {
    return Math.round(value * 100) / 100;
}
function readImageDimensions(file: File) {
    return new Promise<{
        width: number;
        height: number;
    }>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            resolve({
                width: image.naturalWidth || image.width,
                height: image.naturalHeight || image.height,
            });
            URL.revokeObjectURL(objectUrl);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Não foi possvel ler a imagem selecionada."));
        };
        image.src = objectUrl;
    });
}
export function ImageHotspotQuestionEditor({ content, onDraftChange, onPersist, onError, }: ImageHotspotQuestionEditorProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const dragStateRef = useRef<{
        pointerId: number;
        targetId: string;
        startClientX: number;
        startClientY: number;
        startX: number;
        startY: number;
    } | null>(null);
    const [selectedTargetId, setSelectedTargetId] = useState<string | null>(content.targets[0]?.id ?? null);
    const [zoomPercent, setZoomPercent] = useState(100);
    const [isUploadingAsset, setIsUploadingAsset] = useState(false);
    const [assetError, setAssetError] = useState<string | null>(null);
    const selectedTarget = useMemo(() => content.targets.find((target) => target.id === selectedTargetId) ?? content.targets[0] ?? null, [content.targets, selectedTargetId]);
    useEffect(() => {
        if (selectedTargetId && content.targets.some((target) => target.id === selectedTargetId)) {
            return;
        }
        setSelectedTargetId(content.targets[0]?.id ?? null);
    }, [content.targets, selectedTargetId]);
    useEffect(() => {
        function handlePointerMove(event: PointerEvent) {
            const dragState = dragStateRef.current;
            const stage = stageRef.current;
            if (!dragState || !stage) {
                return;
            }
            const stageRect = stage.getBoundingClientRect();
            const deltaXPercent = ((event.clientX - dragState.startClientX) / stageRect.width) * 100;
            const deltaYPercent = ((event.clientY - dragState.startClientY) / stageRect.height) * 100;
            const nextContent: ImageHotspotInteractionContent = {
                ...content,
                targets: content.targets.map((target) => (target.id !== dragState.targetId
                    ? target
                    : {
                        ...target,
                        x: roundPercent(clamp(dragState.startX + deltaXPercent, 0, 100 - target.w)),
                        y: roundPercent(clamp(dragState.startY + deltaYPercent, 0, 100 - target.h)),
                    })),
            };
            onDraftChange(nextContent);
        }
        function handlePointerUp(event: PointerEvent) {
            const dragState = dragStateRef.current;
            if (!dragState || event.pointerId !== dragState.pointerId) {
                return;
            }
            dragStateRef.current = null;
            void onPersist(content);
        }
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [content, onDraftChange, onPersist]);
    function emit(nextContent: ImageHotspotInteractionContent, persist = false) {
        onDraftChange(nextContent);
        if (persist) {
            void onPersist(nextContent);
        }
    }
    function updateTarget(targetId: string, updates: Partial<ImageHotspotTarget>, persist = false) {
        emit({
            ...content,
            targets: content.targets.map((target) => (target.id === targetId
                ? { ...target, ...updates }
                : target)),
        }, persist);
    }
    function handleCanvasClick(event: ReactPointerEvent<HTMLDivElement>) {
        if (!stageRef.current) {
            return;
        }
        const rect = stageRef.current.getBoundingClientRect();
        const xPercent = clamp((((event.clientX - rect.left) / rect.width) * 100) - (DEFAULT_TARGET_WIDTH / 2), 0, 100 - DEFAULT_TARGET_WIDTH);
        const yPercent = clamp((((event.clientY - rect.top) / rect.height) * 100) - (DEFAULT_TARGET_HEIGHT / 2), 0, 100 - DEFAULT_TARGET_HEIGHT);
        const nextTarget: ImageHotspotTarget = {
            id: crypto.randomUUID(),
            x: roundPercent(xPercent),
            y: roundPercent(yPercent),
            w: DEFAULT_TARGET_WIDTH,
            h: DEFAULT_TARGET_HEIGHT,
            label: `Hotspot ${content.targets.length + 1}`,
            is_correct: content.targets.every((target) => !target.is_correct),
            feedback_text: '',
        };
        setSelectedTargetId(nextTarget.id);
        emit({
            ...content,
            targets: [...content.targets, nextTarget],
        }, true);
    }
    function handleTargetPointerDown(target: ImageHotspotTarget, event: ReactPointerEvent<HTMLButtonElement>) {
        event.preventDefault();
        event.stopPropagation();
        setSelectedTargetId(target.id);
        dragStateRef.current = {
            pointerId: event.pointerId,
            targetId: target.id,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startX: target.x,
            startY: target.y,
        };
    }
    async function handleAssetSelected(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        setIsUploadingAsset(true);
        setAssetError(null);
        onError(null);
        try {
            const previousStoragePath = content.asset.storage_path;
            const [uploaded, dimensions] = await Promise.all([
                uploadAssessmentAsset(file),
                readImageDimensions(file),
            ]);
            const nextContent: ImageHotspotInteractionContent = {
                ...content,
                asset: {
                    storage_path: uploaded.storage_path,
                    signed_url: uploaded.signed_url,
                    alt: content.asset.alt || file.name,
                    width: dimensions.width,
                    height: dimensions.height,
                },
            };
            emit(nextContent, true);
            if (previousStoragePath && previousStoragePath !== uploaded.storage_path) {
                void deleteAssessmentAsset(previousStoragePath).catch(() => null);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ação enviar a imagem base do hotspot.';
            setAssetError(message);
            onError(message);
        }
        finally {
            setIsUploadingAsset(false);
            if (event.target) {
                event.target.value = '';
            }
        }
    }
    function handleModeChange(nextMode: ImageHotspotInteractionContent['mode']) {
        if (content.mode === nextMode) {
            return;
        }
        const confirmed = window.confirm(nextMode === 'single_attempt'
            ? "Trocar para \"Clique \u00FAnico\" O aluno passar\u00E1 a encerrar a quest\u00E3o no primeiro clique v\u00E1lido." : "Trocar para \"Encontrar todos\" O aluno passar\u00E1 a precisar localizar todos os hotspots corretos.");
        if (!confirmed) {
            return;
        }
        emit({
            ...content,
            mode: nextMode,
        }, true);
    }
    function deleteSelectedTarget() {
        if (!selectedTarget) {
            return;
        }
        if (content.targets.length === 1) {
            onError('Mantenha ação menos um hotspot na imagem.');
            return;
        }
        const nextTargets = content.targets.filter((target) => target.id !== selectedTarget.id);
        setSelectedTargetId(nextTargets[0]?.id ?? null);
        emit({
            ...content,
            targets: nextTargets,
        }, true);
    }
    const correctTargetsCount = content.targets.filter((target) => target.is_correct).length;
    const stageUrl = content.asset.signed_url || content.asset.storage_path;
    return (<div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_380px] xl:items-start">
      <div className="space-y-4 xl:sticky xl:top-6">
        <div className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-700">Imagem Base</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Envie uma imagem e clique para criar hotspots retangulares sobre as áreas desejadas.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => fileInputRef.current?.click()} disabled={isUploadingAsset}>
                {content.asset.storage_path ? 'Trocar imagem' : 'Enviar imagem'}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
            <div className="min-w-[240px] flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Área de trabalho</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Clique na imagem para criar um hotspot e arraste o retângulo para ajustar a área clicável.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Zoom</span>
              <div className="flex items-center gap-1">
                {[75, 100, 150].map((preset) => (<button key={preset} type="button" onClick={() => setZoomPercent(preset)} className={cn('rounded-full px-3 py-1 text-xs font-black transition-colors', zoomPercent === preset
                ? 'bg-sky-600 text-white'
                : 'text-slate-500 hover:bg-slate-50')}>
                    {preset}%
                  </button>))}
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleAssetSelected(event)}/>

            <div className="overflow-auto rounded-[32px] border border-slate-200 bg-slate-50/60 p-4">
              <div ref={stageRef} className="relative mx-auto overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-inner" style={{
            width: '100%',
            aspectRatio: `${content.asset.width} / ${content.asset.height}`,
            transform: `scale(${zoomPercent / 100})`,
            transformOrigin: 'top center',
        }} onClick={handleCanvasClick}>
                {stageUrl ? (<img src={stageUrl} alt={content.asset.alt} className="h-full w-full object-contain" draggable={false}/>) : (<div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),_transparent_55%),linear-gradient(180deg,_#f8fbff,_#ffffff)] px-8 text-center">
                    <div className="max-w-md rounded-[28px] border border-dashed border-sky-200 bg-white/80 px-8 py-10 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-sky-700">Imagem base</p>
                      <p className="mt-4 text-lg font-black text-slate-900">Envie uma imagem para posicionar os hotspots</p>
                      <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">
                        Depois do upload, clique sobre a imagem para criar áreas retangulares e marque quais são corretas.
                      </p>
                    </div>
                  </div>)}

                {content.targets.map((target, index) => {
            const isSelected = target.id === selectedTargetId;
            return (<button key={target.id} type="button" onClick={(event) => {
                    event.stopPropagation();
                    setSelectedTargetId(target.id);
                }} onPointerDown={(event) => handleTargetPointerDown(target, event)} className={cn('absolute rounded-[18px] border-2 transition-all', target.is_correct
                    ? 'border-emerald-500 bg-emerald-400/12'
                    : 'border-rose-500 bg-rose-400/12', isSelected ? 'ring-4 ring-sky-300/70' : '')} style={{
                    left: `${target.x}%`,
                    top: `${target.y}%`,
                    width: `${target.w}%`,
                    height: `${target.h}%`,
                }}>
                      <span className={cn('absolute -top-3 left-2 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm', target.is_correct ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white')}>
                        {index + 1}
                      </span>
                    </button>);
        })}
              </div>
            </div>

            {assetError ? (<div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {assetError}
              </div>) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Resumo rápido</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Hotspots</p>
                <p className="mt-1 text-lg font-black text-slate-900">{content.targets.length}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Corretos</p>
                <p className="mt-1 text-lg font-black text-emerald-700">{correctTargetsCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Fluxo do aluno</p>
            <p className="mt-2 text-base font-black text-slate-900">
              {content.mode === 'single_attempt' ? 'Clique único' : 'Encontrar todos'}
            </p>
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">
              {content.mode === 'single_attempt'
            ? 'A pergunta encerra no primeiro clique válido do aluno.'
            : 'O aluno continua clicando até localizar todos os hotspots corretos.'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Configuração da questão</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Ajuste a modalidade, o feedback geral e o formato de retorno exibido para o aluno.
              </p>
            </div>
            <button type="button" onClick={() => emit({
            ...content,
            show_feedback_as_popup: !content.show_feedback_as_popup,
        }, true)} className={cn('rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest transition-all', content.show_feedback_as_popup
            ? 'border border-sky-300 bg-sky-50 text-sky-800'
            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300')}>
              {content.show_feedback_as_popup ? 'Popup ativo' : 'Feedback no card'}
            </button>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => handleModeChange('single_attempt')} className={cn('rounded-[24px] border px-4 py-4 text-left transition-all', content.mode === 'single_attempt'
            ? 'border-sky-300 bg-sky-50 text-sky-900 shadow-sm'
            : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:bg-sky-50/50')}>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Modalidade</p>
                <p className="mt-2 text-base font-black">Clique único</p>
                <p className="mt-2 text-xs font-medium leading-relaxed">
                  Encerra a questão no primeiro clique válido do aluno.
                </p>
              </button>

              <button type="button" onClick={() => handleModeChange('find_all')} className={cn('rounded-[24px] border px-4 py-4 text-left transition-all', content.mode === 'find_all'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm'
            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50')}>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Modalidade</p>
                <p className="mt-2 text-base font-black">Encontrar todos</p>
                <p className="mt-2 text-xs font-medium leading-relaxed">
                  O aluno continua clicando até encontrar todos os hotspots corretos.
                </p>
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Feedback ação clicar fora</span>
              <textarea value={content.outside_click_feedback ?? ''} onChange={(event) => emit({
            ...content,
            outside_click_feedback: event.target.value,
        })} onBlur={() => void onPersist(content)} rows={4} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Mensagem exibida quando o aluno clicar fora dos hotspots."/>
            </label>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Feedback imediato</p>
              <p className="mt-2 text-base font-black text-slate-900">
                {content.show_feedback_as_popup ? 'Exibir como popup' : 'Exibir no card da questão'}
              </p>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">Define se o retorno do clique aparece em popup destacado ou na própria área da pergunta.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Hotspots</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                {content.targets.length} criado(s), {correctTargetsCount} correto(s).
              </p>
            </div>
            <Button type="button" variant="outline" className="rounded-full" onClick={deleteSelectedTarget} disabled={!selectedTarget || content.targets.length === 1}>
              Remover selecionado
            </Button>
          </div>

          <div className="mt-5 grid max-h-[340px] gap-3 overflow-auto pr-1">
            {content.targets.map((target, index) => {
            const isSelected = target.id === selectedTargetId;
            return (<button key={target.id} type="button" onClick={() => setSelectedTargetId(target.id)} className={cn('flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all', isSelected
                    ? 'border-sky-300 bg-sky-50 text-sky-900 shadow-sm'
                    : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:border-sky-200')}>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Hotspot {index + 1}</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{target.label?.trim() || `Hotspot ${index + 1}`}</p>
                  </div>
                  <span className={cn('rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest', target.is_correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                    {target.is_correct ? 'Correto' : 'Incorreto'}
                  </span>
                </button>);
        })}
          </div>
        </div>

        {selectedTarget ? (<div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Ajuste detalhado</p>
                <p className="mt-2 text-lg font-black text-slate-900">{selectedTarget.label?.trim() || 'Hotspot selecionado'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest', selectedTarget.is_correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                  {selectedTarget.is_correct ? 'Correto' : 'Incorreto'}
                </span>
                <Button type="button" variant="outline" className="rounded-full" onClick={deleteSelectedTarget} disabled={content.targets.length === 1}>
                  Remover
                </Button>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Nãome interno</span>
                <input type="text" value={selectedTarget.label ?? ''} onChange={(event) => updateTarget(selectedTarget.id, { label: event.target.value })} onBlur={() => void onPersist(content)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Ex.: área do crânio, osso frontal, hotspot 1..."/>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => updateTarget(selectedTarget.id, { is_correct: true }, true)} className={cn('rounded-2xl border px-4 py-4 text-left transition-all', selectedTarget.is_correct
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50')}>
                  <p className="text-sm font-black">Hotspot correto</p>
                  <p className="mt-2 text-xs font-medium leading-relaxed">Conta como acerto quando clicado pelo aluno.</p>
                </button>

                <button type="button" onClick={() => updateTarget(selectedTarget.id, { is_correct: false }, true)} className={cn('rounded-2xl border px-4 py-4 text-left transition-all', !selectedTarget.is_correct
                ? 'border-rose-300 bg-rose-50 text-rose-900 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50/50')}>
                  <p className="text-sm font-black">Hotspot incorreto</p>
                  <p className="mt-2 text-xs font-medium leading-relaxed">Mostra feedback, mas não conta como acerto.</p>
                </button>
              </div>

              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Feedback do hotspot</span>
                <textarea value={selectedTarget.feedback_text ?? ''} onChange={(event) => updateTarget(selectedTarget.id, { feedback_text: event.target.value })} onBlur={() => void onPersist(content)} rows={4} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100" placeholder="Mensagem exibida quando o aluno clicar neste hotspot."/>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                {([
                ['x', 'X (%)', selectedTarget.x],
                ['y', 'Y (%)', selectedTarget.y],
                ['w', 'Largura (%)', selectedTarget.w],
                ['h', 'Altura (%)', selectedTarget.h],
            ] as const).map(([key, label, value]) => (<label key={key} className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">{label}</span>
                    <input type="number" min={0} max={key === 'w' || key === 'h' ? 100 : 100} step={0.1} value={value} onChange={(event) => {
                    const nextValue = Number(event.target.value || 0);
                    if (key === 'x') {
                        updateTarget(selectedTarget.id, { x: roundPercent(clamp(nextValue, 0, 100 - selectedTarget.w)) });
                        return;
                    }
                    if (key === 'y') {
                        updateTarget(selectedTarget.id, { y: roundPercent(clamp(nextValue, 0, 100 - selectedTarget.h)) });
                        return;
                    }
                    if (key === 'w') {
                        updateTarget(selectedTarget.id, { w: roundPercent(clamp(nextValue, MIN_SIZE_PERCENT, 100 - selectedTarget.x)) });
                        return;
                    }
                    updateTarget(selectedTarget.id, { h: roundPercent(clamp(nextValue, MIN_SIZE_PERCENT, 100 - selectedTarget.y)) });
                }} onBlur={() => void onPersist(content)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"/>
                  </label>))}
              </div>
            </div>
          </div>) : null}
      </div>
    </div>);
}
