import { useMemo, useState } from 'react'

import { assessmentInteractionContentSchema } from '@/features/assessments/gamified'
import type {
  AssessmentInteractionToken,
  ColoringInteractionContent,
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
        A interacao desta questao esta invalida ou incompleta.
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

  if (parsed.data.kind === 'coloring') {
    return (
      <ColoringView
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

function ColoringView({
  content,
  value,
  onChange,
  readOnly,
}: {
  content: ColoringInteractionContent
  value: Record<string, string | null>
  onChange: (slotId: string, tokenId: string | null) => void
  readOnly: boolean
}) {
  const [armedColorId, setArmedColorId] = useState<string | null>(null)
  const colorById = useMemo(
    () => new Map(content.tokens.map((token) => [token.id, token])),
    [content.tokens],
  )
  const stageUrl = content.asset.signed_url || content.asset.storage_path

  function clearAllAssignments() {
    if (readOnly) return
    setArmedColorId(null)

    for (const target of content.targets) {
      if (value[target.id]) {
        onChange(target.id, null)
      }
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 overflow-hidden rounded-[36px] border border-slate-200 bg-[#fcfdff] shadow-inner">
        <div className="border-b border-slate-200 bg-white/80 px-6 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-700">Quiz de Colorir</p>
          <p className="mt-2 text-sm font-semibold text-slate-600">{content.instruction}</p>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          <div
            className="relative mx-auto overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-lg"
            style={{ aspectRatio: `${content.asset.width} / ${content.asset.height}` }}
          >
            {stageUrl ? (
              <img src={stageUrl} alt={content.asset.alt} className="h-full w-full object-contain" draggable={false} />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-100 text-sm font-bold text-slate-400">
                Imagem para colorir indisponivel
              </div>
            )}

            {content.targets.map((target) => {
              const selectedColor = value[target.id] ? colorById.get(value[target.id] ?? '') : null

              return (
                <button
                  key={target.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    if (readOnly || !armedColorId) return
                    onChange(target.id, armedColorId)
                  }}
                  className="absolute rounded-2xl border-2 border-white/80 shadow-lg transition-transform hover:scale-[1.02]"
                  style={{
                    left: `${target.x}%`,
                    top: `${target.y}%`,
                    width: `${target.w}%`,
                    height: `${target.h}%`,
                    backgroundColor: selectedColor?.hex ?? 'rgba(255,255,255,0.18)',
                  }}
                  title={target.label ?? 'Area'}
                >
                  <span className="sr-only">{target.label ?? 'Area para colorir'}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="self-start rounded-[32px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/30 lg:sticky lg:top-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Paleta</p>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Escolha uma cor e clique nas areas da imagem para preencher.
            </p>
          </div>
          {!readOnly ? (
            <button
              type="button"
              onClick={clearAllAssignments}
              className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
            >
              Limpar
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3">
          {content.tokens.map((token) => {
            const isArmed = armedColorId === token.id
            return (
              <button
                key={token.id}
                type="button"
                disabled={readOnly}
                onClick={() => {
                  if (readOnly) return
                  setArmedColorId((current) => current === token.id ? null : token.id)
                }}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-black transition-all ${
                  isArmed
                    ? 'border-cyan-500 bg-cyan-50 text-cyan-800 shadow-lg shadow-cyan-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/60'
                }`}
              >
                <span className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: token.hex }} />
                <span>{token.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1.55fr)_320px] 2xl:grid-cols-[minmax(0,2.1fr)_340px]">
      <div className="min-w-0 overflow-hidden rounded-[36px] border border-slate-200 bg-[#fcfdff] shadow-inner">
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
                Imagem do exercicio nao disponivel
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

      <div className="self-start rounded-[32px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/30 lg:sticky lg:top-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Banco de Itens</p>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Arraste ou toque em um item e depois escolha a area correspondente.
            </p>
          </div>
          {!readOnly ? (
            <button
              type="button"
              onClick={clearAllAssignments}
              className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
            >
              Limpar selecao
            </button>
          ) : null}
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

        {availableTokens.length < content.tokens.length ? (
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
        ) : null}
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
  const [armedSelection, setArmedSelection] = useState<{ tokenId: string; groupId: string } | null>(null)
  const tokenById = useMemo(
    () => new Map(content.tokens.map((token) => [token.id, token])),
    [content.tokens],
  )

  const groups = useMemo(() => {
    if (content.editor_groups?.length) {
      return content.editor_groups.map((group) => {
        const segments: Array<
          | { type: 'text'; text: string }
          | { type: 'blank'; id: string; placeholder?: string | null }
        > = []
        const tokens: AssessmentInteractionToken[] = []
        const seenTokenIds = new Set<string>()

        if (group.leading_text) {
          segments.push({ type: 'text', text: group.leading_text })
        }

        for (const blank of group.blanks) {
          segments.push({
            type: 'blank',
            id: blank.blank_id,
            placeholder: blank.placeholder,
          })

          if (!seenTokenIds.has(blank.token_id)) {
            tokens.push({
              id: blank.token_id,
              label: tokenById.get(blank.token_id)?.label ?? blank.answer_text,
            })
            seenTokenIds.add(blank.token_id)
          }

          if (blank.trailing_text) {
            segments.push({ type: 'text', text: blank.trailing_text })
          }
        }

        for (const extraToken of group.extra_tokens ?? []) {
          if (seenTokenIds.has(extraToken.id)) continue
          tokens.push({
            id: extraToken.id,
            label: tokenById.get(extraToken.id)?.label ?? extraToken.label,
          })
          seenTokenIds.add(extraToken.id)
        }

        return {
          id: group.id,
          segments,
          tokens,
          blankIds: group.blanks.map((blank) => blank.blank_id),
        }
      })
    }

    return [
      {
        id: 'group-1',
        segments: content.segments,
        tokens: content.tokens,
        blankIds: content.segments
          .filter((segment): segment is Extract<FillInTheBlanksInteractionContent['segments'][number], { type: 'blank' }> => segment.type === 'blank')
          .map((segment) => segment.id),
      },
    ]
  }, [content.editor_groups, content.segments, content.tokens, tokenById])

  function handleBlankClick(groupId: string, blankId: string) {
    if (readOnly || !armedSelection || armedSelection.groupId !== groupId) return
    onChange(blankId, armedSelection.tokenId)
    setArmedSelection(null)
  }

  function clearGroupAssignments(groupId: string, blankIds: string[]) {
    if (readOnly) return
    if (armedSelection?.groupId === groupId) {
      setArmedSelection(null)
    }

    for (const blankId of blankIds) {
      if (value[blankId]) {
        onChange(blankId, null)
      }
    }
  }

  return (
    <div className="rounded-[36px] border border-slate-200 bg-white shadow-2xl shadow-slate-200/30">
      <div className="border-b border-slate-200 bg-gradient-to-r from-[#f7fcff] to-white px-6 py-5">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-700">Preencher Lacunas</p>
        <p className="mt-2 text-sm font-semibold text-slate-600">{content.instruction}</p>
      </div>

      <div className="space-y-6 p-6">
        {groups.map((group, groupIndex) => {
          const assignedTokenIds = new Set(
            group.blankIds
              .map((blankId) => value[blankId])
              .filter((tokenId): tokenId is string => Boolean(tokenId)),
          )
          const availableTokens = group.tokens.filter((token) => !assignedTokenIds.has(token.id))
          const isGroupArmed = armedSelection?.groupId === group.id

          return (
            <section key={group.id} className="rounded-[32px] border border-slate-200 bg-slate-50/50 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-full bg-white px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-700 shadow-sm">
                  Pergunta {groupIndex + 1}
                </span>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_320px]">
                <div className="rounded-[30px] border border-slate-200 bg-[#fcfdff] px-6 py-6 text-lg leading-[2.2] text-slate-800">
                  {group.segments.map((segment, index) => {
                    if (segment.type === 'text') {
                      return (
                        <span key={`${group.id}-text-${index}`} className="whitespace-pre-wrap">
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
                        onClick={() => handleBlankClick(group.id, segment.id)}
                        onDragOver={(event) => {
                          if (!readOnly) event.preventDefault()
                        }}
                        onDrop={(event) => {
                          if (readOnly) return
                          event.preventDefault()
                          const tokenId = event.dataTransfer.getData('text/plain')
                          if (!tokenId || !group.tokens.some((token) => token.id === tokenId)) {
                            return
                          }
                          onChange(segment.id, tokenId)
                          setArmedSelection(null)
                        }}
                        className={`mx-1 inline-flex min-w-[140px] items-center justify-center rounded-2xl border-2 px-3 py-1.5 align-middle text-base font-black transition-all ${
                          assignedToken
                            ? 'border-cyan-500 bg-cyan-500 text-white shadow-lg shadow-cyan-100'
                            : isGroupArmed
                              ? 'border-cyan-400 bg-cyan-50 text-cyan-700'
                              : 'border-slate-300 bg-slate-100 text-slate-400'
                        }`}
                      >
                        {assignedToken?.label ?? segment.placeholder ?? 'lacuna'}
                      </button>
                    )
                  })}
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Banco de Palavras</p>
                      <p className="mt-2 text-sm font-semibold text-slate-600">Escolha um item desta pergunta e depois toque na lacuna correspondente.</p>
                    </div>
                    {!readOnly ? (
                      <button
                        type="button"
                        onClick={() => clearGroupAssignments(group.id, group.blankIds)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50"
                      >
                        Limpar selecao
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {group.tokens.map((token) => {
                      const isAssigned = assignedTokenIds.has(token.id)
                      const isArmed = armedSelection?.tokenId === token.id && armedSelection.groupId === group.id

                      return (
                        <button
                          key={token.id}
                          type="button"
                          disabled={readOnly || isAssigned}
                          draggable={!readOnly && !isAssigned}
                          onDragStart={(event) => event.dataTransfer.setData('text/plain', token.id)}
                          onClick={() => {
                            if (readOnly || isAssigned) return
                            setArmedSelection((current) => (
                              current?.tokenId === token.id && current.groupId === group.id
                                ? null
                                : { tokenId: token.id, groupId: group.id }
                            ))
                          }}
                          className={`rounded-2xl border px-4 py-2.5 text-sm font-black transition-all ${
                            isAssigned
                              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'
                              : isArmed
                                ? 'border-cyan-500 bg-cyan-50 text-cyan-800 shadow-lg shadow-cyan-100'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/60'
                          }`}
                        >
                          {token.label}
                        </button>
                      )
                    })}
                  </div>

                  {availableTokens.length < group.tokens.length ? (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Itens usados nesta pergunta</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.blankIds
                          .filter((blankId) => Boolean(value[blankId]))
                          .map((blankId) => (
                            <button
                              key={blankId}
                              type="button"
                              disabled={readOnly}
                              onClick={() => !readOnly && onChange(blankId, null)}
                              className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-black text-cyan-700 hover:bg-cyan-100"
                            >
                              {tokenById.get(value[blankId] ?? '')?.label ?? 'Item'}
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
