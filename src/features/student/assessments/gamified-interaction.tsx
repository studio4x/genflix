import { useMemo, useState } from 'react'

import { assessmentInteractionContentSchema } from '@/features/assessments/gamified'
import type {
  DragDropLabelingInteractionContent,
  FillInTheBlanksInteractionContent,
} from '@/types/content'

import type { StudentAssessmentQuestionWithOptions } from './api'

interface GamifiedInteractionProps {
  question: StudentAssessmentQuestionWithOptions
  value: Record<string, string | null>
  onChange: (slotId: string, tokenId: string | null) => void
  readOnly?: boolean
}

export function GamifiedInteraction({
  question,
  value,
  onChange,
  readOnly = false,
}: GamifiedInteractionProps) {
  const parsed = assessmentInteractionContentSchema.safeParse(question.interaction?.content ?? null)

  if (!parsed.success) {
    return (
      <div className="rounded-[32px] border border-rose-200 bg-rose-50 px-6 py-5 text-sm font-semibold text-rose-700">
        A interação desta questão está inválida ou incompleta.
      </div>
    )
  }

  if (parsed.data.kind === 'drag_drop_labeling') {
    return (
      <DragDropLabelingView
        content={parsed.data}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
    )
  }

  return (
    <FillInTheBlanksView
      content={parsed.data}
      value={value}
      onChange={onChange}
      readOnly={readOnly}
    />
  )
}

function DragDropLabelingView({
  content,
  value,
  onChange,
  readOnly,
}: {
  content: DragDropLabelingInteractionContent
  value: Record<string, string | null>
  onChange: (slotId: string, tokenId: string | null) => void
  readOnly: boolean
}) {
  const [armedTokenId, setArmedTokenId] = useState<string | null>(null)
  const tokenById = useMemo(
    () => new Map(content.tokens.map((token) => [token.id, token])),
    [content.tokens],
  )

  const assignedTokenIds = new Set(Object.values(value).filter((tokenId): tokenId is string => Boolean(tokenId)))
  const availableTokens = content.tokens.filter((token) => !assignedTokenIds.has(token.id))
  const stageUrl = content.asset.signed_url || content.asset.storage_path

  function handleSlotClick(slotId: string) {
    if (readOnly || !armedTokenId) return
    onChange(slotId, armedTokenId)
    setArmedTokenId(null)
  }

  function clearSlot(slotId: string) {
    if (readOnly) return
    onChange(slotId, null)
  }

  function clearAllAssignments() {
    if (readOnly) return
    setArmedTokenId(null)

    for (const target of content.targets) {
      if (value[target.id]) {
        onChange(target.id, null)
      }
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.85fr)_320px] 2xl:grid-cols-[minmax(0,2.1fr)_340px]">
      <div className="overflow-hidden rounded-[36px] border border-slate-200 bg-[#fcfdff] shadow-inner">
        <div className="border-b border-slate-200 bg-white/80 px-6 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-700">Arrastar e Soltar</p>
          <p className="mt-2 text-sm font-semibold text-slate-600">{content.instruction}</p>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          <div
            className="relative mx-auto overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-lg 2xl:mx-0"
            style={{ aspectRatio: `${content.asset.width} / ${content.asset.height}` }}
          >
            {stageUrl ? (
              <img
                src={stageUrl}
                alt={content.asset.alt}
                className="h-full w-full object-contain"
                draggable={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-100 text-sm font-bold text-slate-400">
                Imagem do exercício não disponível
              </div>
            )}

            {content.targets.map((target) => {
              const assignedToken = value[target.id] ? tokenById.get(value[target.id] ?? '') : null
              return (
                <div
                  key={target.id}
                  className="absolute"
                  style={{
                    left: `${target.x}%`,
                    top: `${target.y}%`,
                    width: `${target.w}%`,
                    height: `${target.h}%`,
                  }}
                >
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => handleSlotClick(target.id)}
                    onDragOver={(event) => {
                      if (!readOnly) event.preventDefault()
                    }}
                    onDrop={(event) => {
                      if (readOnly) return
                      event.preventDefault()
                      const tokenId = event.dataTransfer.getData('text/plain')
                      if (tokenId) {
                        onChange(target.id, tokenId)
                        setArmedTokenId(null)
                      }
                    }}
                    className={`flex h-full w-full items-center justify-center rounded-2xl border-2 px-3 py-2 pr-8 text-center text-xs font-black shadow-lg backdrop-blur transition-all ${
                      assignedToken
                        ? 'border-cyan-500 bg-cyan-500/90 text-white'
                        : armedTokenId
                          ? 'border-cyan-400 bg-white/90 text-cyan-700'
                          : 'border-rose-300 bg-white/85 text-rose-500'
                    } ${readOnly ? 'cursor-default' : 'hover:scale-[1.02]'}`}
                  >
                    <span className="line-clamp-2">
                      {assignedToken?.label ?? target.label ?? 'Solte aqui'}
                    </span>
                  </button>

                  {assignedToken && !readOnly ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        clearSlot(target.id)
                      }}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-slate-950/20 text-white transition-colors hover:bg-slate-950/35"
                      aria-label={`Remover ${assignedToken.label}`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="self-start rounded-[32px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/30 xl:sticky xl:top-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Banco de Itens</p>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Arraste ou toque em um item e depois escolha a área correspondente.
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={clearAllAssignments}
              className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
            >
              Limpar seleção
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-3">
          {content.tokens.map((token) => {
            const isAssigned = assignedTokenIds.has(token.id)
            const isArmed = armedTokenId === token.id

            return (
              <button
                key={token.id}
                type="button"
                disabled={readOnly || isAssigned}
                draggable={!readOnly && !isAssigned}
                onDragStart={(event) => event.dataTransfer.setData('text/plain', token.id)}
                onClick={() => {
                  if (readOnly || isAssigned) return
                  setArmedTokenId((current) => current === token.id ? null : token.id)
                }}
                className={`flex min-h-[60px] items-center justify-center rounded-2xl border px-4 py-3 text-center text-sm font-black transition-all ${
                  isAssigned
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'
                    : isArmed
                      ? 'border-cyan-500 bg-cyan-50 text-cyan-800 shadow-lg shadow-cyan-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/60'
                }`}
              >
                {token.label}
              </button>
            )
          })}
        </div>

        {availableTokens.length < content.tokens.length && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Itens posicionados</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {content.targets
                .filter((target) => value[target.id])
                .map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => !readOnly && onChange(target.id, null)}
                    className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-black text-cyan-700 hover:bg-cyan-100"
                  >
                    {tokenById.get(value[target.id] ?? '')?.label ?? 'Item'}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FillInTheBlanksView({
  content,
  value,
  onChange,
  readOnly,
}: {
  content: FillInTheBlanksInteractionContent
  value: Record<string, string | null>
  onChange: (slotId: string, tokenId: string | null) => void
  readOnly: boolean
}) {
  const [armedTokenId, setArmedTokenId] = useState<string | null>(null)
  const tokenById = useMemo(
    () => new Map(content.tokens.map((token) => [token.id, token])),
    [content.tokens],
  )

  const assignedTokenIds = new Set(Object.values(value).filter((tokenId): tokenId is string => Boolean(tokenId)))

  function handleBlankClick(blankId: string) {
    if (readOnly || !armedTokenId) return
    onChange(blankId, armedTokenId)
    setArmedTokenId(null)
  }

  return (
    <div className="rounded-[36px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/30">
      <div className="border-b border-slate-200 bg-gradient-to-r from-[#f7fcff] to-white px-6 py-5">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-700">Preencher Lacunas</p>
        <p className="mt-2 text-sm font-semibold text-slate-600">{content.instruction}</p>
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.75fr)_320px]">
        <div className="rounded-[30px] border border-slate-200 bg-[#fcfdff] px-6 py-6 text-lg leading-[2.2] text-slate-800">
          {content.segments.map((segment, index) => {
            if (segment.type === 'text') {
              return (
                <span key={`text-${index}`} className="whitespace-pre-wrap">
                  {segment.text}
                </span>
              )
            }

            const assignedToken = value[segment.id] ? tokenById.get(value[segment.id] ?? '') : null
            return (
              <button
                key={segment.id}
                type="button"
                disabled={readOnly}
                onClick={() => handleBlankClick(segment.id)}
                onDragOver={(event) => {
                  if (!readOnly) event.preventDefault()
                }}
                onDrop={(event) => {
                  if (readOnly) return
                  event.preventDefault()
                  const tokenId = event.dataTransfer.getData('text/plain')
                  if (tokenId) {
                    onChange(segment.id, tokenId)
                    setArmedTokenId(null)
                  }
                }}
                className={`mx-1 inline-flex min-w-[140px] items-center justify-center rounded-2xl border-2 px-3 py-1.5 align-middle text-base font-black transition-all ${
                  assignedToken
                    ? 'border-cyan-500 bg-cyan-500 text-white shadow-lg shadow-cyan-100'
                    : armedTokenId
                      ? 'border-cyan-400 bg-cyan-50 text-cyan-700'
                      : 'border-slate-300 bg-slate-100 text-slate-400'
                }`}
              >
                {assignedToken?.label ?? segment.placeholder ?? 'lacuna'}
              </button>
            )
          })}
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Banco de Palavras</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">Arraste ou toque em um item e depois toque na lacuna.</p>
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setArmedTokenId(null)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
              >
                Limpar seleção
              </button>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {content.tokens.map((token) => {
              const isAssigned = assignedTokenIds.has(token.id)
              const isArmed = armedTokenId === token.id

              return (
                <button
                  key={token.id}
                  type="button"
                  disabled={readOnly || isAssigned}
                  draggable={!readOnly && !isAssigned}
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', token.id)}
                  onClick={() => {
                    if (readOnly || isAssigned) return
                    setArmedTokenId((current) => current === token.id ? null : token.id)
                  }}
                  className={`rounded-2xl border px-4 py-2.5 text-sm font-black transition-all ${
                    isAssigned
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'
                      : isArmed
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-800 shadow-lg shadow-cyan-100'
                        : 'border-white bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60'
                  }`}
                >
                  {token.label}
                </button>
              )
            })}
          </div>

          {Object.values(value).some(Boolean) && (
            <div className="mt-6 rounded-2xl border border-white bg-white px-4 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Itens usados</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {content.segments
                  .filter((segment): segment is Extract<FillInTheBlanksInteractionContent['segments'][number], { type: 'blank' }> => segment.type === 'blank')
                  .filter((segment) => Boolean(value[segment.id]))
                  .map((segment) => (
                    <button
                      key={segment.id}
                      type="button"
                      disabled={readOnly}
                      onClick={() => !readOnly && onChange(segment.id, null)}
                      className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-black text-cyan-700 hover:bg-cyan-100"
                    >
                      {tokenById.get(value[segment.id] ?? '')?.label ?? 'Item'}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
