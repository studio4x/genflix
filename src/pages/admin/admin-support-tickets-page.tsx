import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, RefreshCw, Search, Trash2 } from 'lucide-react'

import { TicketSlaBadge } from '@/components/support/ticket-sla-badge'
import { Button } from '@/components/ui/button'
import { deleteSupportTicket, fetchAdminSupportTickets, fetchSupportSettings, updateSupportTicketStatus } from '@/features/support/api'
import { formatSupportDate, getOrderedSupportCategories, getSupportPriorityBadgeClass, getSupportSlaStatusMeta, getSupportUserDisplayName, supportPriorityLabelMap } from '@/lib/support-sla'
import type { SupportTicketStatus, SupportTicketSummary } from '@/features/support/types'

type TicketSortMode = 'sla' | 'priority' | 'date'

function getPriorityWeight(priority: SupportTicketSummary['priority']) {
  switch (priority) {
    case 'urgent':
      return 4
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
    default:
      return 0
  }
}

export function AdminSupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([])
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof fetchSupportSettings>> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SupportTicketStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | SupportTicketSummary['category']>('all')
  const [sortMode, setSortMode] = useState<TicketSortMode>('sla')
  const [ticketToDelete, setTicketToDelete] = useState<SupportTicketSummary | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function loadData() {
    setIsRefreshing(true)
    setErrorMessage(null)

    try {
      const [ticketRows, supportSettings] = await Promise.all([
        fetchAdminSupportTickets(),
        fetchSupportSettings(),
      ])

      setTickets(ticketRows)
      setSettings(supportSettings)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'N?o foi possivel carregar a fila de tickets.')
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const orderedCategories = useMemo(
    () => getOrderedSupportCategories(settings?.sla),
    [settings?.sla],
  )

  const filteredTickets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    const rows = tickets.filter((ticket) => {
      const matchesQuery = normalizedQuery.length === 0
        || ticket.subject.toLowerCase().includes(normalizedQuery)
        || getSupportUserDisplayName(ticket.user ?? null).toLowerCase().includes(normalizedQuery)
        || (ticket.user?.email ?? '').toLowerCase().includes(normalizedQuery)
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter
      const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter
      return matchesQuery && matchesStatus && matchesCategory
    })

    return [...rows].sort((left, right) => {
      if (sortMode === 'date') {
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      }

      if (sortMode === 'priority') {
        const priorityGap = getPriorityWeight(right.priority) - getPriorityWeight(left.priority)
        if (priorityGap !== 0) {
          return priorityGap
        }
      }

      const leftPending = !left.first_response_at
      const rightPending = !right.first_response_at
      if (leftPending !== rightPending) {
        return leftPending ? -1 : 1
      }

      const dueGap = new Date(left.first_response_due_at ?? left.created_at).getTime()
        - new Date(right.first_response_due_at ?? right.created_at).getTime()
      if (dueGap !== 0) {
        return dueGap
      }

      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    })
  }, [categoryFilter, searchQuery, sortMode, statusFilter, tickets])

  const overdueCount = filteredTickets.filter((ticket) => getSupportSlaStatusMeta(ticket).key === 'overdue').length

  async function handleInlineStatusChange(ticketId: string, nextStatus: SupportTicketStatus) {
    try {
      const updated = await updateSupportTicketStatus(ticketId, nextStatus)
      setTickets((current) => current.map((ticket) => ticket.id === ticketId ? { ...ticket, ...updated } : ticket))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'N?o foi possivel atualizar o status do ticket.')
    }
  }

  async function handleDeleteTicket() {
    if (!ticketToDelete) {
      return
    }

    try {
      await deleteSupportTicket(ticketToDelete.id)
      setTickets((current) => current.filter((ticket) => ticket.id !== ticketToDelete.id))
      setTicketToDelete(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'N?o foi possivel excluir o ticket.')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Suporte</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Central de atendimento</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
            Trabalhe a fila operacional de tickets, acompanhe o SLA e responda os chamados em andamento.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadData()}
          disabled={isRefreshing}
          className="h-11 rounded-2xl border-[#D8E6EB] bg-white font-black text-[#15323b]"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar lista
        </Button>
      </header>

      {errorMessage ? (
        <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-[26px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">SLA publico</p>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#15323b]">Pagamentos em ate 2 horas uteis e demais categorias em ate 24 horas uteis.</p>
        </article>
        <article className="rounded-[26px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Chamados filtrados</p>
          <p className="mt-3 font-readex text-3xl font-semibold text-[#15323b]">{filteredTickets.length}</p>
        </article>
        <article className={`rounded-[26px] border p-5 shadow-sm ${overdueCount > 0 ? 'border-rose-200 bg-rose-50' : 'border-[#D8E6EB] bg-white'}`}>
          <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${overdueCount > 0 ? 'text-rose-700' : 'text-[#5F7077]'}`}>SLA atrasado</p>
          <p className={`mt-3 font-readex text-3xl font-semibold ${overdueCount > 0 ? 'text-rose-700' : 'text-[#15323b]'}`}>{overdueCount}</p>
        </article>
      </section>

      <section className="rounded-[30px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Buscar</span>
            <div className="flex h-12 items-center gap-2 rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] px-4">
              <Search className="h-4 w-4 text-[#8BA0A7]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar por assunto, nome ou e-mail..."
                className="w-full bg-transparent text-sm font-semibold text-[#15323b] outline-none"
              />
            </div>
          </label>

          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | SupportTicketStatus)}
              className="h-12 rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] px-4 text-sm font-semibold text-[#15323b] outline-none"
            >
              <option value="all">Todos os status</option>
              <option value="open">Abertos</option>
              <option value="in_progress">Em atendimento</option>
              <option value="closed">Fechados</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Categoria</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as 'all' | SupportTicketSummary['category'])}
              className="h-12 rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] px-4 text-sm font-semibold text-[#15323b] outline-none"
            >
              <option value="all">Todas as categorias</option>
              {orderedCategories.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">Ordenacao</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as TicketSortMode)}
              className="h-12 rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] px-4 text-sm font-semibold text-[#15323b] outline-none"
            >
              <option value="sla">Ordenar por SLA</option>
              <option value="priority">Ordenar por prioridade</option>
              <option value="date">Ordenar por data</option>
            </select>
          </label>
        </div>

        <div className="mt-6 overflow-x-auto">
          {isLoading ? (
            <p className="py-6 text-sm font-semibold text-[#5F7077]">Carregando tickets...</p>
          ) : filteredTickets.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-[#1398B7]/42" />
              <p className="mt-4 font-readex text-xl font-semibold text-[#15323b]">Nenhum chamado encontrado.</p>
            </div>
          ) : (
            <table className="min-w-[1180px] w-full border-collapse text-sm">
              <thead className="bg-[#F2F7F9] text-left">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Usuario</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Assunto</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Categoria</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">SLA</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Prioridade</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Prazo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => {
                  const rowTone = ticket.priority === 'urgent'
                    ? 'hover:bg-rose-50/70'
                    : ticket.priority === 'high'
                      ? 'hover:bg-orange-50/70'
                      : ticket.priority === 'medium'
                        ? 'hover:bg-amber-50/70'
                        : 'hover:bg-emerald-50/70'

                  return (
                    <tr key={ticket.id} className={`border-t border-[#D8E6EB] align-top transition-colors ${rowTone}`}>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="font-medium text-[#15323b]">{getSupportUserDisplayName(ticket.user ?? null)}</p>
                          <p className="text-xs text-[#6d7f84]">{ticket.user?.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="max-w-[240px] truncate font-medium text-[#15323b]">{ticket.subject}</p>
                          <p className="text-xs text-[#6d7f84]">{formatSupportDate(ticket.created_at)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <span className="inline-flex items-center rounded-md border border-[#D8E6EB] bg-[#F8FBFC] px-2.5 py-1 text-xs font-medium text-[#5F7077]">
                            {orderedCategories.find((item) => item.key === ticket.category)?.label ?? ticket.category}
                          </span>
                          <p className="max-w-[220px] text-xs leading-5 text-[#6d7f84]">
                            {orderedCategories.find((item) => item.key === ticket.category)?.description ?? 'Primeira resposta conforme a categoria.'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TicketSlaBadge ticket={ticket} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${getSupportPriorityBadgeClass(ticket.priority)}`}>
                          {supportPriorityLabelMap[ticket.priority]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={ticket.status}
                          onChange={(event) => void handleInlineStatusChange(ticket.id, event.target.value as SupportTicketStatus)}
                          className="h-10 rounded-[14px] border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none"
                        >
                          <option value="open">Aberto</option>
                          <option value="in_progress">Em atendimento</option>
                          <option value="closed">Fechado</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#6d7f84]">
                        {ticket.first_response_at
                          ? `Respondido em ${formatSupportDate(ticket.first_response_at)}`
                          : formatSupportDate(ticket.first_response_due_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            asChild
                            className="h-9 rounded-full border-[#D8E6EB] bg-white px-4 text-xs font-black text-[#15323b]"
                          >
                            <Link to={`/admin/suporte/${ticket.id}`}>Responder</Link>
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setTicketToDelete(ticket)}
                            className="h-9 rounded-full px-4 text-xs font-black"
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {ticketToDelete ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-[#061b21]/58 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[30px] border border-[#D8E6EB] bg-white p-6 shadow-[0_30px_90px_rgba(6,27,33,0.24)]">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-rose-700">Acao destrutiva</p>
            <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Excluir chamado permanentemente</h2>
            <p className="mt-3 text-sm leading-7 text-[#5F7077]">
              Esta acao remove o ticket e todo o historico de mensagens associado ao assunto <span className="font-black text-[#15323b]">{ticketToDelete.subject}</span>.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTicketToDelete(null)}
                className="h-11 rounded-2xl border-[#D8E6EB] bg-white font-black text-[#15323b]"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDeleteTicket()}
                className="h-11 rounded-2xl px-5 font-black"
              >
                Confirmar exclusao
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
