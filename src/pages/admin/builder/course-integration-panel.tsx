import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { fetchCourseIntegrationSnapshot, toErrorMessage, type CourseIntegrationSnapshot } from '@/features/admin/integrations/api'
import { useCourseBuilder } from '@/app/layouts/admin-course-builder-layout'

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

function releaseStatusClass(status: string | null | undefined) {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700'
    case 'revoked':
      return 'bg-rose-100 text-rose-700'
    case 'expired':
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-slate-200 text-slate-600'
  }
}

export function CourseIntegrationPanel() {
  const { courseTree } = useCourseBuilder()
  const { courseId } = useParams<{ courseId: string }>()
  const [snapshot, setSnapshot] = useState<CourseIntegrationSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSnapshot() {
      if (!courseId) {
        setError('Curso invalido.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const nextSnapshot = await fetchCourseIntegrationSnapshot(courseId)
        setSnapshot(nextSnapshot)
      } catch (loadError) {
        setError(toErrorMessage(loadError))
      } finally {
        setIsLoading(false)
      }
    }

    void loadSnapshot()
  }, [courseId])

  const activeIntegrationReleases = snapshot?.releases.filter((release) => release.release_status === 'active') ?? []
  const revokedIntegrationReleases = snapshot?.releases.filter((release) => release.release_status === 'revoked') ?? []

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Integracao</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">HomeCare Match</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Aqui voce acompanha o que ja esta ativo para este curso: mapeamento externo, liberacoes gerenciadas pela
              integracao, logs recentes e eventos que retornam progresso para a plataforma principal.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/admin/integracoes">Abrir painel geral de integracoes</Link>
          </Button>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <article className="rounded-[28px] border border-blue-100 bg-blue-50/70 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">ID do curso na HCM</p>
            <p className="mt-3 text-lg font-black text-slate-900">
              {isLoading ? 'Carregando...' : snapshot?.mapping?.external_course_id ?? 'Nao configurado'}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {snapshot?.mapping
                ? 'Este curso ja pode ser encontrado pela integracao da plataforma principal.'
                : 'Sem esse mapeamento, a HomeCare Match nao consegue sincronizar compra, inscricao ou acesso direto.'}
            </p>
          </article>

          <article className="rounded-[28px] border border-emerald-100 bg-emerald-50/70 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Liberacoes externas ativas</p>
            <p className="mt-3 text-4xl font-black tracking-tight text-emerald-700">
              {isLoading ? '...' : activeIntegrationReleases.length}
            </p>
            <p className="mt-2 text-sm text-emerald-700/80">Usuarios ou grupos liberados hoje pela integracao com status ativo.</p>
          </article>

          <article className="rounded-[28px] border border-rose-100 bg-rose-50/70 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-600">Liberacoes revogadas</p>
            <p className="mt-3 text-4xl font-black tracking-tight text-rose-700">
              {isLoading ? '...' : revokedIntegrationReleases.length}
            </p>
            <p className="mt-2 text-sm text-rose-700/80">Acessos que vieram da HomeCare Match e ja foram revogados ou expiraram.</p>
          </article>
        </div>

        <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Prontidao do acesso direto</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {snapshot?.mapping
                  ? `A HomeCare Match ja pode apontar o acesso direto para o curso "${courseTree?.course.title ?? ''}".`
                  : 'Ainda falta preencher o ID do Curso na HomeCare Match nas configuracoes do curso.'}
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to={`/admin/cursos/${courseId}/builder/settings`}>Editar configuracoes do curso</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="border-b border-slate-100 pb-5">
            <h3 className="text-xl font-black tracking-tight text-slate-900">Liberacoes gerenciadas pela integracao</h3>
            <p className="mt-1 text-sm text-slate-500">Somente as liberacoes que vieram da HomeCare Match aparecem aqui.</p>
          </div>

          <div className="mt-5 space-y-3">
            {snapshot?.releases.map((release) => (
              <article key={release.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${releaseStatusClass(release.release_status)}`}>
                      {release.release_status ?? 'sem status'}
                    </span>
                    <p className="text-sm font-black text-slate-900">
                      {release.release_type === 'user'
                        ? release.user_label ?? release.user_id ?? 'Usuario sem identificacao'
                        : release.group_label ?? release.group_id ?? 'Grupo sem identificacao'}
                    </p>
                    <p className="text-sm text-slate-600">
                      Origem: {release.release_source ?? 'integration'}
                      {' · '}
                      Referencia externa: {release.external_reference_id ?? 'Nao informada'}
                    </p>
                  </div>
                  <div className="text-right text-xs font-semibold text-slate-500">
                    <p>Sync: {formatDateTime(release.last_synced_at ?? release.created_at)}</p>
                    {release.revoked_at ? <p className="mt-1">Revogado em {formatDateTime(release.revoked_at)}</p> : null}
                  </div>
                </div>
                {release.revoked_reason ? (
                  <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    {release.revoked_reason}
                  </p>
                ) : null}
              </article>
            ))}

            {!isLoading && (snapshot?.releases.length ?? 0) === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm font-semibold text-slate-500">
                Ainda nao houve liberacoes externas registradas para este curso.
              </div>
            ) : null}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="border-b border-slate-100 pb-5">
              <h3 className="text-xl font-black tracking-tight text-slate-900">Logs recentes do curso</h3>
              <p className="mt-1 text-sm text-slate-500">Chamadas de sync, revoke e acesso relacionadas a este curso.</p>
            </div>

            <div className="mt-5 space-y-3">
              {snapshot?.logs.map((log) => (
                <article key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">{log.direction}</p>
                      <p className="mt-2 text-sm font-black text-slate-900">{log.event_type}</p>
                      <p className="mt-1 text-sm text-slate-600">{log.user_label ?? log.external_user_id ?? 'Usuario nao identificado'}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${releaseStatusClass(log.status)}`}>
                      {log.status}
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">Em {formatDateTime(log.created_at)}</p>
                  {log.error_message ? (
                    <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {log.error_message}
                    </p>
                  ) : null}
                </article>
              ))}

              {!isLoading && (snapshot?.logs.length ?? 0) === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm font-semibold text-slate-500">
                  Nenhum log recente para este curso.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="border-b border-slate-100 pb-5">
              <h3 className="text-xl font-black tracking-tight text-slate-900">Eventos de retorno para a HomeCare Match</h3>
              <p className="mt-1 text-sm text-slate-500">Fila de progresso, conclusao e aprovacao deste curso.</p>
            </div>

            <div className="mt-5 space-y-3">
              {snapshot?.outbox.map((event) => (
                <article key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">{event.event_type}</p>
                      <p className="mt-1 text-sm text-slate-600">{event.user_label ?? event.user_id}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${releaseStatusClass(event.delivery_status)}`}>
                      {event.delivery_status}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-xs font-semibold text-slate-500">
                    <p>Criado em {formatDateTime(event.created_at)}</p>
                    <p>Proxima tentativa em {formatDateTime(event.next_attempt_at)}</p>
                    <p>{event.attempt_count} tentativa(s)</p>
                  </div>
                  {event.last_error ? (
                    <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {event.last_error}
                    </p>
                  ) : null}
                </article>
              ))}

              {!isLoading && (snapshot?.outbox.length ?? 0) === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm font-semibold text-slate-500">
                  Nenhum evento de retorno foi enfileirado para este curso ainda.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
