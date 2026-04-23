import { useEffect, useMemo, useState } from 'react'
import { HelpCircle, LifeBuoy, Search, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { SupportTicketModal } from '@/components/support/support-ticket-modal'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { fetchSupportFaqs, fetchSupportSettings } from '@/features/support/api'
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

  const filteredFaqs = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return faqs.filter((item) => {
      const matchesCategory = normalizedQuery.length > 0 ? true : item.category_key === activeCategory
      const matchesQuery = normalizedQuery.length === 0
        || item.question.toLowerCase().includes(normalizedQuery)
        || item.answer.toLowerCase().includes(normalizedQuery)

      return matchesCategory && matchesQuery
    })
  }, [activeCategory, faqs, searchQuery])

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader currentPage="support" navLinks={genflixNavLinks} />

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

            <label className="relative mx-auto mt-8 block max-w-[640px]">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8BA0A7]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Busque por pagamentos, acesso, erro tecnico, conta..."
                className="h-14 w-full rounded-full border border-[#D8E6EB] bg-[#F8FBFC] pl-14 pr-6 text-sm font-semibold text-[#15323b] outline-none"
              />
            </label>
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

      <section className="public-site-container pb-10 sm:pb-14">
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-4">
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
              <div className="mt-6 rounded-[24px] border border-dashed border-[#D8E6EB] bg-[#F8FBFC] px-5 py-8 text-center">
                <p className="text-sm font-semibold text-[#5F7077]">Nenhuma resposta encontrada para essa busca.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {filteredFaqs.map((item) => (
                  <article key={item.id} className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FBFC] px-5 py-4">
                    <h3 className="text-base font-black text-[#15323b]">{item.question}</h3>
                    <p className="mt-3 text-sm leading-7 text-[#5F7077]">{item.answer}</p>
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
                  <GenflixCtaButton asChild tone="surface" className="h-12 px-5 text-[#0A3640]">
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
