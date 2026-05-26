import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RefreshCw, Search, Send, Trash2, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  deleteBlogComment,
  listAdminBlogComments,
  moderateBlogComment,
  replyBlogComment,
  type BlogComment,
  type BlogCommentStatus,
} from '@/features/blog/comments-api'
import { cn } from '@/lib/utils'

const statusLabels: Record<BlogCommentStatus | 'all', string> = {
  all: 'Todos',
  pending: 'Pendentes',
  approved: 'Aprovados',
  rejected: 'Rejeitados',
}

function sanitizeCommentHtml(rawValue: string) {
  if (!rawValue.trim()) {
    return ''
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(rawValue, 'text/html')
  const blockedTags = new Set(['script', 'style', 'iframe', 'object', 'embed'])

  const nodes = Array.from(doc.body.querySelectorAll('*'))
  nodes.forEach((node) => {
    if (blockedTags.has(node.tagName.toLowerCase())) {
      node.remove()
      return
    }

    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim().toLowerCase()
      if (name.startsWith('on')) {
        node.removeAttribute(attribute.name)
        return
      }
      if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
        node.removeAttribute(attribute.name)
      }
    })
  })

  return doc.body.innerHTML
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function AdminBlogCommentsPanel() {
  const [items, setItems] = useState<BlogComment[]>([])
  const [status, setStatus] = useState<BlogCommentStatus | 'all'>('pending')
  const [query, setQuery] = useState('')
  const [moderationReason, setModerationReason] = useState('')
  const [adminResponse, setAdminResponse] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadComments = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const rows = await listAdminBlogComments({ status, query })
      setItems(rows)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar comentários.')
    } finally {
      setIsLoading(false)
    }
  }, [query, status])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadComments()
    }, 250)

    return () => window.clearTimeout(timer)
  }, [loadComments])

  const counters = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1
        acc[item.moderation_status] += 1
        return acc
      },
      { total: 0, pending: 0, approved: 0, rejected: 0 },
    )
  }, [items])

  async function handleModerate(commentId: string, action: 'approve' | 'reject') {
    setActiveId(commentId)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await moderateBlogComment(commentId, action, action === 'reject' ? moderationReason : undefined, adminResponse)
      setModerationReason('')
      setAdminResponse('')
      setSuccessMessage(action === 'approve' ? 'Comentário aprovado.' : 'Comentário rejeitado.')
      await loadComments()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível moderar o comentário.')
    } finally {
      setActiveId(null)
    }
  }

  async function handleReply(commentId: string) {
    if (!adminResponse.trim()) {
      setErrorMessage('Informe uma resposta do administrador antes de salvar.')
      return
    }

    setActiveId(commentId)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await replyBlogComment(commentId, adminResponse)
      setAdminResponse('')
      setSuccessMessage('Resposta salva.')
      await loadComments()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível salvar a resposta.')
    } finally {
      setActiveId(null)
    }
  }

  async function handleDelete(commentId: string) {
    if (!window.confirm('Excluir este comentário?')) {
      return
    }

    setActiveId(commentId)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await deleteBlogComment(commentId)
      setSuccessMessage('Comentário excluido.')
      await loadComments()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível excluir o comentário.')
    } finally {
      setActiveId(null)
    }
  }

  return (
    <section className="space-y-4">
      {errorMessage ? <div className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{errorMessage}</div> : null}
      {successMessage ? <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{successMessage}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ['Total', counters.total],
          ['Pendentes', counters.pending],
          ['Aprovados', counters.approved],
          ['Rejeitados', counters.rejected],
        ].map(([label, value]) => (
          <div key={label} className="border border-[#D8E6EB] bg-white p-4 shadow-[0_12px_28px_rgba(10,54,64,0.04)]">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8BA0A7]">{label}</p>
            <p className="mt-2 font-readex text-3xl font-semibold text-[#15323b]">{value}</p>
          </div>
        ))}
      </section>

      <section className="border border-[#D8E6EB] bg-[#F8FBFC] p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8BA0A7]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 w-full border border-[#D8E6EB] bg-white pl-10 pr-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"
              placeholder="Buscar por artigo, nome, e-mail ou comentário"
            />
          </label>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as BlogCommentStatus | 'all')}
            className="h-12 border border-[#D8E6EB] bg-white px-3 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]"
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <Button type="button" variant="outline" onClick={() => void loadComments()} disabled={isLoading} className="h-12 rounded-none border-[#D8E6EB] bg-white font-black text-[#0A3640] hover:border-[#1398B7]">
            <RefreshCw className={cn('mr-2 h-4 w-4', isLoading ? 'animate-spin' : '')} />
            Atualizar
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        {isLoading && items.length === 0 ? (
          <div className="border border-[#D8E6EB] bg-white p-6 text-sm font-bold text-[#6d7f84]">Carregando comentários...</div>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-[#D8E6EB] bg-white p-8 text-center">
            <p className="font-readex text-lg font-semibold text-[#15323b]">Nenhum comentário neste recorte</p>
          </div>
        ) : items.map((item) => (
          <article key={item.id} className="border border-[#D8E6EB] bg-white p-5 shadow-[0_14px_32px_rgba(21,50,59,0.04)]">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]', item.moderation_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : item.moderation_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800')}>
                  {statusLabels[item.moderation_status]}
                </span>
                <span className="text-xs font-bold text-[#8BA0A7]">{formatDate(item.created_at)}</span>
                <span className="text-xs font-semibold text-[#5f7077]">/{item.post_slug}</span>
              </div>

              <p className="text-sm font-bold text-[#15323b]">{item.first_name} {item.last_name} - {item.email}</p>
              <div
                className="prose prose-sm max-w-none text-[#5f7077]"
                dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(item.content) }}
              />

              {item.admin_response ? (
                <div className="rounded border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                  <p className="mb-2 font-bold">Resposta do admin:</p>
                  <div
                    className="prose prose-sm max-w-none text-blue-700"
                    dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(item.admin_response) }}
                  />
                </div>
              ) : null}
              {item.moderation_reason ? <p className="rounded border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">Motivo da rejeição: {item.moderation_reason}</p> : null}

              <textarea
                value={adminResponse}
                onChange={(event) => setAdminResponse(event.target.value)}
                rows={2}
                maxLength={500}
                className="w-full resize-none border border-[#D8E6EB] bg-white px-3 py-2 text-sm font-semibold leading-6 text-[#15323b] outline-none focus:border-[#1398B7]"
                placeholder="Resposta publica do administrador (opcional na aprovacao)"
              />
              <textarea
                value={moderationReason}
                onChange={(event) => setModerationReason(event.target.value)}
                rows={2}
                maxLength={300}
                className="w-full resize-none border border-[#D8E6EB] bg-white px-3 py-2 text-sm font-semibold leading-6 text-[#15323b] outline-none focus:border-[#1398B7]"
                placeholder="Motivo para rejeição"
              />

              <div className="grid gap-2 sm:grid-cols-4">
                <Button type="button" onClick={() => void handleModerate(item.id, 'approve')} disabled={activeId === item.id} className="rounded-none bg-emerald-600 font-black text-white hover:bg-emerald-700">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                </Button>
                <Button type="button" onClick={() => void handleModerate(item.id, 'reject')} disabled={activeId === item.id} variant="destructive" className="rounded-none font-black">
                  <XCircle className="mr-2 h-4 w-4" /> Rejeitar
                </Button>
                <Button type="button" onClick={() => void handleReply(item.id)} disabled={activeId === item.id} variant="outline" className="rounded-none border-[#D8E6EB] font-black text-[#0A3640]">
                  <Send className="mr-2 h-4 w-4" /> Responder
                </Button>
                <Button type="button" onClick={() => void handleDelete(item.id)} disabled={activeId === item.id} variant="outline" className="rounded-none border-red-200 font-black text-red-700 hover:bg-red-50">
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </section>
  )
}

