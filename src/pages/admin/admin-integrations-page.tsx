import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  fetchIntegrationDashboardSnapshot,
  toErrorMessage,
  type IntegrationDashboardSnapshot,
  type IntegrationLogStatus,
  type IntegrationOutboxStatus,
} from '@/features/admin/integrations/api'

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Nao disponivel'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed)
}

function logStatusClass(status: IntegrationLogStatus) {
  switch (status) {
    case 'processed':
      return 'bg-emerald-100 text-emerald-700'
    case 'failed':
      return 'bg-rose-100 text-rose-700'
    case 'ignored':
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-blue-100 text-blue-700'
  }
}

function outboxStatusClass(status: IntegrationOutboxStatus) {
  switch (status) {
    case 'delivered':
      return 'bg-emerald-100 text-emerald-700'
    case 'failed':
    case 'dead_letter':
      return 'bg-rose-100 text-rose-700'
    case 'processing':
      return 'bg-blue-100 text-blue-700'
    default:
      return 'bg-amber-100 text-amber-700'
  }
}

export function AdminIntegrationsPage() {
  const [snapshot, setSnapshot] = useState<IntegrationDashboardSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logFilter, setLogFilter] = useState<'all' | 'failed'>('all')
  const [outboxFilter, setOutboxFilter] = useState<'all' | 'attention'>('all')

  useEffect(() => {
    async function loadSnapshot() {
      setIsLoading(true)
      setError(null)

      try {
        const nextSnapshot = await fetchIntegrationDashboardSnapshot()
        setSnapshot(nextSnapshot)
      } catch (loadError) {
        setError(toErrorMessage(loadError))
      } finally {
        setIsLoading(false)
      }
    }

    void loadSnapshot()
  }, [])

  const logs =
    logFilter === 'failed'
      ? (snapshot?.logs ?? []).filter((log) => log.status === 'failed')
      : snapshot?.logs ?? []

  const outbox =
    outboxFilter === 'attention'
      ? (snapshot?.outbox ?? []).filter((event) => event.delivery_status !== 'delivered')
      : snapshot?.outbox ?? []

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-3 border-b border-slate-100 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Integracoes</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Acompanhe o estado da integração com a GenFlix: mapeamentos de cursos, logs de sincronização,
              fila de eventos de progresso e entregas que exigem atencao.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/admin/cursos">Abrir catalogo de cursos</Link>
          </Button>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-4 text-sm font-medium text-blue-900">
          Os segredos operacionais e as configuracoes do cron do Supabase continuam protegidos no backend. Esta tela
          mostra apenas monitoramento seguro para administracao.
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Cursos mapeados</p>
          <p className="mt-3 text-4xl font-black tracking-tight text-slate-900">
            {isLoading ? '...' : snapshot?.mapping_count ?? 0}
          </p>
          <p className="mt-2 text-sm text-slate-500">Cursos do LMS já vinculados ao identificador da plataforma.</p>
        </article>

        <article className="rounded-[28px] border border-rose-100 bg-rose-50/70 p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-500">Logs com falha</p>
          <p className="mt-3 text-4xl font-black tracking-tight text-rose-700">
            {isLoading ? '...' : snapshot?.failed_logs_count ?? 0}
          </p>
          <p className="mt-2 text-sm text-rose-700/80">Requests inbound ou outbound que falharam e precisam de revisao.</p>
        </article>

        <article className="rounded-[28px] border border-amber-100 bg-amber-50/70 p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-600">Fila pendente</p>
          <p className="mt-3 text-4xl font-black tracking-tight text-amber-700">
            {isLoading ? '...' : snapshot?.pending_outbox_count ?? 0}
          </p>
          <p className="mt-2 text-sm text-amber-700/80">Eventos aguardando envio, em processamento ou com tentativa falhada.</p>
        </article>

        <article className="rounded-[28px] border border-emerald-100 bg-emerald-50/70 p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Logs processados</p>
          <p className="mt-3 text-4xl font-black tracking-tight text-emerald-700">
            {isLoading ? '...' : snapshot?.processed_logs_count ?? 0}
          </p>
          <p className="mt-2 text-sm text-emerald-700/80">Chamadas da integracao concluidas com sucesso no periodo recente.</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900">Logs recentes da integracao</h3>
              <p className="mt-1 text-sm text-slate-500">Inbound, outbound e diagnósticos internos associados à integração.</p>
            </div>
            <div className="flex rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setLogFilter('all')}
                className={`rounded-[14px] px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                  logFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('failed')}
                className={`rounded-[14px] px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                  logFilter === 'failed' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                So falhas
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {logs.map((log) => (
              <article key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${logStatusClass(log.status)}`}>
                        {log.status}
                      </span>
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">
                        {log.direction}
                      </span>
                    </div>
                    <p className="text-sm font-black text-slate-900">{log.event_type}</p>
                    <p className="text-sm text-slate-600">
                      {log.course_title ?? log.external_course_id ?? 'Curso nao identificado'}
                      {' · '}
                      {log.user_label ?? log.external_user_id ?? 'Usuario nao identificado'}
                    </p>
                  </div>
                  <div className="text-right text-xs font-semibold text-slate-500">
                    <p>{formatDateTime(log.created_at)}</p>
                    {log.http_status ? <p className="mt-1">HTTP {log.http_status}</p> : null}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                  <p>Request ID: <span className="font-semibold text-slate-700">{log.request_id ?? 'Nao informado'}</span></p>
                  <p>Correlacao: <span className="font-semibold text-slate-700">{log.correlation_id ?? 'Nao informada'}</span></p>
                </div>
                {log.error_message ? (
                  <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    {log.error_message}
                  </p>
                ) : null}
              </article>
            ))}

            {!isLoading && logs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm font-semibold text-slate-500">
                Nenhum log encontrado para o filtro selecionado.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900">Fila de eventos para a plataforma principal</h3>
              <p className="mt-1 text-sm text-slate-500">Eventos de progresso, conclusao e aprovacao aguardando ou tentando entrega.</p>
            </div>
            <div className="flex rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setOutboxFilter('all')}
                className={`rounded-[14px] px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                  outboxFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setOutboxFilter('attention')}
                className={`rounded-[14px] px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                  outboxFilter === 'attention' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                Exigem atencao
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {outbox.map((event) => (
              <article key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${outboxStatusClass(event.delivery_status)}`}>
                      {event.delivery_status}
                    </span>
                    <p className="text-sm font-black text-slate-900">{event.event_type}</p>
                    <p className="text-sm text-slate-600">
                      {event.course_title ?? event.course_id}
                      {' · '}
                      {event.user_label ?? event.user_id}
                    </p>
                  </div>
                  <div className="text-right text-xs font-semibold text-slate-500">
                    <p>{formatDateTime(event.created_at)}</p>
                    <p className="mt-1">{event.attempt_count} tentativa(s)</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-slate-500">
                  <p>Proxima tentativa: <span className="font-semibold text-slate-700">{formatDateTime(event.next_attempt_at)}</span></p>
                  <p>Ultimo envio: <span className="font-semibold text-slate-700">{formatDateTime(event.last_attempt_at)}</span></p>
                  {event.delivered_at ? (
                    <p>Entregue em: <span className="font-semibold text-slate-700">{formatDateTime(event.delivered_at)}</span></p>
                  ) : null}
                </div>

                {event.last_error ? (
                  <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    {event.last_error}
                  </p>
                ) : null}
              </article>
            ))}

            {!isLoading && outbox.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm font-semibold text-slate-500">
                Nenhum evento encontrado para o filtro selecionado.
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
