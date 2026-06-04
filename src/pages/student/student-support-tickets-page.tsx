import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SupportTicketModal } from '@/components/support/support-ticket-modal';
import { TicketSlaBadge } from '@/components/support/ticket-sla-badge';
import { TicketStatusBadge } from '@/components/support/ticket-status-badge';
import { fetchMySupportTickets, fetchSupportSettings } from '@/features/support/api';
import { formatSupportDate, getOrderedSupportCategories } from '@/lib/support-sla';
import type { SupportModalStep, SupportTicketSummary } from '@/features/support/types';
interface SupportTicketsPageProps {
    contextLabel?: 'Aluno' | 'Criador';
    supportBasePath?: string;
}
export function StudentSupportTicketsPage({ contextLabel = 'Aluno', supportBasePath = '/aluno/suporte', }: SupportTicketsPageProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
    const [settings, setSettings] = useState<Awaited<ReturnType<typeof fetchSupportSettings>> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(searchParams.get('openTicketModal') === '1');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    async function loadData() {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const [ticketRows, supportSettings] = await Promise.all([
                fetchMySupportTickets(),
                fetchSupportSettings(),
            ]);
            setTickets(ticketRows);
            setSettings(supportSettings);
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "N?o foi possvel carregar os chamados.");
        }
        finally {
            setIsLoading(false);
        }
    }
    useEffect(() => {
        void loadData();
    }, []);
    useEffect(() => {
        setIsModalOpen(searchParams.get('openTicketModal') === '1');
    }, [searchParams]);
    const modalStep = (searchParams.get('ticketStep') === 'form' ? 'form' : 'choice') as SupportModalStep;
    const orderedCategories = useMemo(() => getOrderedSupportCategories(settings?.sla), [settings?.sla]);
    function handleCloseModal() {
        setIsModalOpen(false);
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.delete('openTicketModal');
            next.delete('ticketStep');
            return next;
        }, { replace: true });
    }
    function getCategoryDescription(ticket: SupportTicketSummary) {
        return orderedCategories.find((item) => item.key === ticket.category)?.description ?? 'Primeira resposta conforme SLA da categoria.';
    }
    return (<div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">{contextLabel} / Suporte</p>
          <h1 className="mt-2 flex items-center gap-3 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">
            <MessageSquare className="h-7 w-7 text-[#1398B7]"/>
            Meus chamados
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">Acompanhe seus tickets, veja o SLA da primeira resposta e continue a conversa com a equipe quando necessrio.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="outline" asChild className="h-11 rounded-2xl border-[#D8E6EB] bg-white font-black text-[#15323b]">
            <Link to="/suporte">Ver FAQs</Link>
          </Button>
          <Button type="button" onClick={() => setIsModalOpen(true)} className="h-11 rounded-2xl bg-gradient-to-b from-[#1398B7] to-[#0A3640] font-black text-white hover:opacity-95">Novo chamado
          </Button>
        </div>
      </header>

      {errorMessage ? (<div className="rounded-[22px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>) : null}

      <article className="rounded-[28px] border border-[#BEE3EA] bg-[#F2F8FA] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">SLA pblico de primeira resposta</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#15323b]">
              Pagamentos em ate 2 horas uteis. Demais categorias em ate 24 horas uteis, conforme o horario de atendimento.
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-[#D8E6EB] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#5F7077]">N?o e prazo de resolucao final
          </div>
        </div>
      </article>

      <section className="overflow-hidden rounded-[30px] border border-[#D8E6EB] bg-white shadow-sm">
        {isLoading ? (<p className="px-6 py-8 text-sm font-semibold text-[#5F7077]">Carregando chamados...</p>) : tickets.length === 0 ? (<div className="px-6 py-12 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-[#1398B7]/42"/>
            <p className="mt-4 font-readex text-xl font-semibold text-[#15323b]">Voc? ainda n?o abriu nenhum chamado.</p>
          </div>) : (<div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-left text-sm">
              <thead className="bg-[#F2F7F9]">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Assunto</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Categoria</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">SLA</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Prazo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-[#8BA0A7]">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (<tr key={ticket.id} className="border-t border-[#D8E6EB] align-top transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium text-[#15323b]">{ticket.subject}</p>
                        <p className="text-xs text-[#6d7f84]">Aberto em {formatSupportDate(ticket.created_at)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <span className="inline-flex items-center rounded-md border border-[#D8E6EB] bg-[#F8FBFC] px-2.5 py-1 text-xs font-medium text-[#5F7077]">
                          {orderedCategories.find((item) => item.key === ticket.category)?.label ?? ticket.category}
                        </span>
                        <p className="max-w-[220px] text-xs leading-5 text-[#6d7f84]">{getCategoryDescription(ticket)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TicketStatusBadge status={ticket.status}/>
                    </td>
                    <td className="px-4 py-3">
                      <TicketSlaBadge ticket={ticket}/>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-[#6d7f84]">
                      {ticket.first_response_at
                    ? `Respondido em ${formatSupportDate(ticket.first_response_at)}`
                    : formatSupportDate(ticket.first_response_due_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="ghost" asChild className="h-9 rounded-full px-4 text-xs font-black text-[#15323b]">
                        <Link to={`${supportBasePath}/${ticket.id}`}>Ver detalhes</Link>
                      </Button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </section>

      {isModalOpen ? (<SupportTicketModal supportBasePath={supportBasePath} initialStep={modalStep} onClose={handleCloseModal} onCreated={() => {
                void loadData();
            }}/>) : null}
    </div>);
}
