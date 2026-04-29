import { useEffect, useMemo, useState } from 'react'
import { HelpCircle, LifeBuoy, Search, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { SupportTicketModal } from '@/components/support/support-ticket-modal'
import { GenflixCtaButton, normalizeGenflixCtaTone } from '@/components/public/genflix-cta-button'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { PublicTextBlocksSection } from '@/components/public/public-text-blocks-section'
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot'
import { createSupportFaqSuggestion, fetchSupportFaqs, fetchSupportSettings, trackSupportFaqEvent } from '@/features/support/api'
import { genflixNavLinks } from '@/features/public/genflix-site-content'
import { formatSupportBusinessHours, getOrderedSupportCategories, getSupportListRoute } from '@/lib/support-sla'
import type { SupportFaqItem, SupportTicketCategory } from '@/features/support/types'

export function PublicSupportPage() {
  const { user, roles } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<SupportTicketCategory>('general')
  const [faqs, setFaqs] = useState<SupportFaqItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof fetchSupportSettings>> | null>(null)
  const [voteState, setVoteState] = useState<Record<string, 'helpful' | 'not_helpful'>>({})
  const [suggestedQuestion, setSuggestedQuestion] = useState('')
  const [suggestionDetails, setSuggestionDetails] = useState('')
  const [suggestionStatus, setSuggestionStatus] = useState<string | null>(null)
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false)

  const faqSessionId = useMemo(() => {
    const storageKey = 'genflix_support_faq_session_id'
    const existing = window.localStorage.getItem(storageKey)
    if (existing) {
      return existing
    }

    const created = crypto.randomUUID()
    window.localStorage.setItem(storageKey, created)
    return created
  }, [])

  useEffect(() => {
    let isMounted = true

    void Promise.all([fetchSupportFaqs(), fetchSupportSettings()])
      .then(([faqRows, supportSettings]) => {
        if (!isMounted) {
          return
        }

        setFaqs(faqRows)
        setSettings(supportSettings)
        setActiveCategory(supportSettings.sla.categories[0]?.key ?? 'general')
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const orderedCategories = useMemo(
    () => getOrderedSupportCategories(settings?.sla),
    [settings?.sla],
  )

  const normalizedSearchQuery = searchQuery.trim().toLowerCase()

  const filteredFaqs = useMemo(() => {
    return faqs.filter((item) => {
      const matchesCategory = normalizedSearchQuery.length > 0 ? true : item.category_key === activeCategory
      const matchesQuery = normalizedSearchQuery.length === 0
        || item.question.toLowerCase().includes(normalizedSearchQuery)
        || item.answer.toLowerCase().includes(normalizedSearchQuery)

      return matchesCategory && matchesQuery
    })
  }, [activeCategory, faqs, normalizedSearchQuery])

  useEffect(() => {
    const hasNoResult = searchQuery.trim().length > 0 && filteredFaqs.length === 0
    if (!hasNoResult) {
      return
    }

    void trackSupportFaqEvent({
      eventType: 'search_no_result',
      query: searchQuery,
      sessionId: faqSessionId,
    }).catch(() => undefined)
  }, [faqSessionId, filteredFaqs.length, searchQuery])

  useEffect(() => {
    if (filteredFaqs.length > 0 || searchQuery.trim().length === 0) {
      return
    }

    setSuggestedQuestion((current) => (current.trim().length > 0 ? current : searchQuery.trim()))
    setSuggestionStatus(null)
  }, [filteredFaqs.length, searchQuery])

  async function handleFaqVote(faqId: string, vote: 'helpful' | 'not_helpful') {
    setVoteState((current) => ({ ...current, [faqId]: vote }))
    await trackSupportFaqEvent({
      faqId,
      eventType: vote,
      sessionId: faqSessionId,
    })
  }

  async function handleFaqSuggestionSubmit() {
    const trimmedSearch = searchQuery.trim()
    const trimmedSuggestion = suggestedQuestion.trim()
    const trimmedDetails = suggestionDetails.trim()

    if (!trimmedSearch || !trimmedSuggestion) {
      setSuggestionStatus('Preencha a sugestão antes de enviar.')
      return
    }

    try {
      setIsSubmittingSuggestion(true)
      await createSupportFaqSuggestion({
        category_key: activeCategory,
        search_query: trimmedSearch,
        suggested_question: trimmedSuggestion,
        details: trimmedDetails,
        session_id: faqSessionId,
      })
      setSuggestedQuestion('')
      setSuggestionDetails('')
      setSuggestionStatus('Sugestão enviada. Obrigado por ajudar a expandir a FAQ.')
    } catch {
      setSuggestionStatus('Nao foi possivel enviar agora. Tente novamente em instantes.')
    } finally {
      setIsSubmittingSuggestion(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader currentPage="support" navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="support" placementKey="hero" />

      <section className="border-b border-[#D8E6EB] bg-white">
        <div className="public-site-container py-14 sm:py-16">
          <div className="mx-auto max-w-[780px] text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F6FA] text-[#1398B7]">
              <LifeBuoy className="h-6 w-6" />
            </div>
            <h1 className="mt-6 text-[2.4rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#15323B] sm:text-[3rem]">
              Como podemos ajudar?
            </h1>
            <p className="mx-auto mt-4 max-w-[620px] text-base leading-8 text-[#5F7077]">
              Consulte perguntas frequentes, entenda o SLA de primeira resposta e abra um chamado quando precisar de atendimento humano.
            </p>
          </div>
        </div>
      </section>

      <section className="public-site-container py-10 sm:py-12">
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="rounded-[30px] border border-[#D8E6EB] bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">SLA publico</p>
                <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">SLA de primeira resposta</h2>
              </div>
              <div className="rounded-full border border-[#D8E6EB] bg-[#F8FBFC] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">
                Horario util
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {orderedCategories.map((item) => (
                <article key={item.key} className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                  <p className="text-sm font-black text-[#15323b]">{item.label}</p>
                  <div className="mt-3 inline-flex rounded-full border border-[#BEE3EA] bg-[#E8F6FA] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#1398B7]">
                    ate {item.first_response_hours} hora{item.first_response_hours === 1 ? '' : 's'} uteis
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#5F7077]">{item.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-[22px] border border-[#D8E6EB] bg-[#F2F8FA] px-5 py-4">
              <p className="text-sm font-semibold leading-6 text-[#15323b]">
                Atendimento: {settings ? formatSupportBusinessHours(settings.businessHours) : '-'}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#5F7077]">
                {settings?.sla.public_note ?? 'Os prazos se referem apenas ao tempo da primeira resposta humana.'}
              </p>
            </div>
          </article>

          <article className="rounded-[30px] border border-[#D8E6EB] bg-[#0A3640] p-6 text-white shadow-sm sm:p-7">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="mt-6 font-readex text-2xl font-semibold">Casos graves ou sensiveis</h2>
            <p className="mt-4 text-sm leading-7 text-white/78">
              {settings?.crisisProtocol.description ?? 'Para situacoes com fraude, seguranca ou necessidade urgente de orientacao, abra um chamado com o maximo de contexto.'}
            </p>
            <p className="mt-4 text-sm leading-7 text-white/64">
              {settings?.crisisProtocol.note ?? 'Nossa equipe trata os chamados com responsabilidade e prioridade operacional adequada.'}
            </p>

            <GenflixCtaButton
              type="button"
              tone="surface"
              className="mt-8 h-12 w-full justify-between px-5 !text-[#0A3640] [&>span:first-child]:!text-[#0A3640]"
              onClick={() => setIsModalOpen(true)}
            >
              Abrir chamado
            </GenflixCtaButton>
          </article>
        </div>
      </section>

      <section className="public-site-container pb-10 sm:pb-12">
        <PublicTextBlocksSection
          entryKey="support.textBlocks"
          label="Blocos de texto"
          title="Adicionar novos textos de suporte"
          description="Use esta area para incluir avisos, orientacoes, mensagens institucionais ou qualquer bloco de apoio adicional."
          fallback={[]}
          pageKey="support"
        />
      </section>

      <section id="perguntas-frequentes" className="public-site-container pb-10 sm:pb-14">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
            <label className="relative block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Pesquisar</span>
              <Search className="pointer-events-none absolute left-5 top-[43px] h-5 w-5 -translate-y-1/2 text-[#8BA0A7]" />
              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setSuggestionStatus(null)
                }}
                placeholder="Busque por pagamentos, acesso, erro tecnico, conta..."
                className="h-14 w-full rounded-[18px] border border-[#D8E6EB] bg-white pl-14 pr-6 text-sm font-semibold text-[#15323b] outline-none shadow-sm"
              />
            </label>

            <div className="hidden rounded-[28px] border border-[#D8E6EB] bg-white p-4 shadow-sm lg:block">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Categorias</p>
              <div className="mt-4 space-y-2">
                {orderedCategories.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveCategory(item.key)}
                    className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-black transition-colors ${
                      activeCategory === item.key
                        ? 'bg-[#1398B7] text-white'
                        : 'bg-[#F8FBFC] text-[#15323b] hover:bg-[#EBF3F5]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="grid gap-2 lg:hidden">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Categoria</span>
              <select
                value={activeCategory}
                onChange={(event) => setActiveCategory(event.target.value as SupportTicketCategory)}
                className="h-12 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
              >
                {orderedCategories.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
          </aside>

          <div className="rounded-[30px] border border-[#D8E6EB] bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-[#1398B7]" />
              <h2 className="font-readex text-2xl font-semibold text-[#15323b]">Perguntas frequentes</h2>
            </div>

            {isLoading ? (
              <p className="mt-6 text-sm font-semibold text-[#5F7077]">Carregando FAQ...</p>
            ) : filteredFaqs.length === 0 ? (
              <div className="mt-6 rounded-[24px] border border-dashed border-[#D8E6EB] bg-[#F8FBFC] px-5 py-8">
                <p className="text-sm font-semibold text-[#5F7077]">Nenhuma resposta encontrada para essa busca.</p>
                <p className="mt-2 text-sm leading-7 text-[#5F7077]">
                  Envie uma sugestão para incluirmos essa duvida na FAQ.
                </p>

                <div className="mt-6 grid gap-4">
                  <label className="grid gap-2 text-left">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-[#5F7077]">Que pergunta frequente voce quer ver?</span>
                    <input
                      value={suggestedQuestion}
                      onChange={(event) => setSuggestedQuestion(event.target.value)}
                      placeholder="Ex.: Como recuperar o acesso ao curso depois da compra?"
                      className="h-12 rounded-[16px] border border-[#D8E6EB] bg-white px-4 text-sm font-semibold text-[#15323b] outline-none"
                    />
                  </label>

                  <label className="grid gap-2 text-left">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-[#5F7077]">Contexto adicional</span>
                    <textarea
                      value={suggestionDetails}
                      onChange={(event) => setSuggestionDetails(event.target.value)}
                      placeholder="Explique o que faltou, quando aconteceu ou por que a FAQ deveria ter essa resposta."
                      rows={4}
                      className="rounded-[16px] border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none"
                    />
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <GenflixCtaButton
                      type="button"
                      className="h-12 px-5"
                      onClick={() => void handleFaqSuggestionSubmit()}
                      disabled={isSubmittingSuggestion}
                    >
                      {isSubmittingSuggestion ? 'Enviando...' : 'Enviar sugestao'}
                    </GenflixCtaButton>
                    {suggestionStatus ? (
                      <p className="text-sm font-semibold text-[#5F7077]">{suggestionStatus}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {filteredFaqs.map((item) => (
                  <article key={item.id} className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FBFC] px-5 py-4">
                    <h3 className="text-base font-black text-[#15323b]">{item.question}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#5F7077]">{item.answer}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-[#5F7077]">Essa resposta foi útil?</p>
                      <button
                        type="button"
                        onClick={() => void handleFaqVote(item.id, 'helpful')}
                        className={`rounded-full px-3 py-1 text-xs font-black transition-colors ${
                          voteState[item.id] === 'helpful' ? 'bg-emerald-600 text-white' : 'bg-white text-[#15323b] hover:bg-emerald-50'
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleFaqVote(item.id, 'not_helpful')}
                        className={`rounded-full px-3 py-1 text-xs font-black transition-colors ${
                          voteState[item.id] === 'not_helpful' ? 'bg-rose-600 text-white' : 'bg-white text-[#15323b] hover:bg-rose-50'
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="public-site-container pb-16 sm:pb-20">
        <article className="overflow-hidden rounded-[32px] border border-[#D8E6EB] bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[10px_minmax(0,1fr)]">
            <div className="bg-gradient-to-b from-[#1398B7] to-[#0A3640]" />
            <div className="flex flex-col gap-6 px-6 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Ainda precisa de ajuda?</p>
                <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Abra um chamado com a equipe de suporte</h2>
                <p className="mt-3 text-sm leading-7 text-[#5F7077]">
                  Se a FAQ nao resolver, descreva o problema com o maximo de contexto. Assim conseguimos responder com mais precisao.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <GenflixCtaButton type="button" className="h-12 px-5" onClick={() => setIsModalOpen(true)}>
                  Abrir um chamado
                </GenflixCtaButton>
                {user ? (
                  <GenflixCtaButton asChild tone={normalizeGenflixCtaTone('surface')} className="h-12 px-5 text-[#0A3640]">
                    <Link to={getSupportListRoute(roles.includes('admin'))}>Ver historico de chamados</Link>
                  </GenflixCtaButton>
                ) : null}
              </div>
            </div>
          </div>
        </article>
      </section>

      <GenflixPublicFooter />

      {isModalOpen ? (
        <SupportTicketModal
          initialStep="form"
          onClose={() => setIsModalOpen(false)}
        />
      ) : null}
    </main>
  )
}
