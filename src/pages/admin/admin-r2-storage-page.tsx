import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { fetchR2UsageOverview, type R2UsageOverview } from '@/features/admin/storage-r2/api'

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / (1024 ** power)
  return `${value.toFixed(value >= 100 || power === 0 ? 0 : 2)} ${units[power]}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function formatDate(value: string) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function AdminR2StoragePage() {
  const [overview, setOverview] = useState<R2UsageOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadData(mode: 'initial' | 'refresh' = 'initial') {
    if (mode === 'initial') {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    setError(null)
    try {
      const payload = await fetchR2UsageOverview()
      setOverview(payload)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar dados do R2.')
    } finally {
      if (mode === 'initial') {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }

  useEffect(() => {
    void loadData('initial')
  }, [])

  const topBucket = useMemo(() => {
    if (!overview?.buckets?.length) {
      return null
    }

    return [...overview.buckets].sort((a, b) => b.total_size_bytes - a.total_size_bytes)[0] ?? null
  }, [overview])

  return (
    <div className="space-y-6 text-[#163138]">
      <header className="flex flex-col gap-4 rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Cloudflare R2</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#15323B]">Storage R2</h1>
          <p className="mt-2 text-sm text-[#5F7077]">
            Acompanhe consumo de armazenamento, objetos e uploads por bucket.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void loadData('refresh')}
          disabled={loading || refreshing}
          className="h-11 rounded-2xl border-[#BEE3EA] bg-white px-4 font-black text-[#15323B] hover:bg-[#F2F7F9]"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </header>

      {error ? (
        <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Buckets</p>
          <p className="mt-2 text-3xl font-black text-[#15323B]">
            {loading ? '—' : formatNumber(overview?.bucket_count ?? 0)}
          </p>
        </article>
        <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Armazenamento total</p>
          <p className="mt-2 text-3xl font-black text-[#15323B]">
            {loading ? '—' : formatBytes(overview?.totals.total_size_bytes ?? 0)}
          </p>
        </article>
        <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Objetos</p>
          <p className="mt-2 text-3xl font-black text-[#15323B]">
            {loading ? '—' : formatNumber(overview?.totals.object_count ?? 0)}
          </p>
        </article>
        <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Uploads acumulados</p>
          <p className="mt-2 text-3xl font-black text-[#15323B]">
            {loading ? '—' : formatNumber(overview?.totals.upload_count ?? 0)}
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Camada principal</p>
          <p className="mt-2 text-2xl font-black text-[#15323B]">
            {loading ? '—' : formatBytes(overview?.totals.payload_size_bytes ?? 0)}
          </p>
          <p className="mt-1 text-sm text-[#5F7077]">
            Dados de payload no storage padrão.
          </p>
        </article>
        <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Metadata</p>
          <p className="mt-2 text-2xl font-black text-[#15323B]">
            {loading ? '—' : formatBytes(overview?.totals.metadata_size_bytes ?? 0)}
          </p>
          <p className="mt-1 text-sm text-[#5F7077]">
            Espaço consumido por metadados dos objetos.
          </p>
        </article>
      </section>

      <section className="rounded-[24px] border border-[#D8E6EB] bg-white p-5">
        <div className="mb-4 flex flex-col gap-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Detalhamento por bucket</p>
          <p className="text-sm text-[#5F7077]">
            Última atualização: {loading ? '—' : formatDate(overview?.checked_at ?? '')}
          </p>
        </div>

        {loading ? (
          <p className="text-sm font-semibold text-[#5F7077]">Carregando métricas...</p>
        ) : (overview?.buckets?.length ?? 0) === 0 ? (
          <p className="text-sm font-semibold text-[#5F7077]">Nenhum bucket R2 encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-[11px] font-black uppercase tracking-[0.14em] text-[#5F7077]">
                  <th className="px-3 py-2">Bucket</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Objetos</th>
                  <th className="px-3 py-2">Uploads</th>
                  <th className="px-3 py-2">Região</th>
                  <th className="px-3 py-2">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {overview?.buckets.map((bucket) => (
                  <tr key={bucket.name} className="rounded-2xl bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                    <td className="rounded-l-2xl px-3 py-3">
                      <div>
                        <p className="font-black text-[#15323B]">{bucket.name}</p>
                        <p className="text-xs font-semibold text-[#5F7077]">{bucket.storage_class}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">{formatBytes(bucket.total_size_bytes)}</td>
                    <td className="px-3 py-3">{formatNumber(bucket.object_count)}</td>
                    <td className="px-3 py-3">{formatNumber(bucket.upload_count)}</td>
                    <td className="px-3 py-3">{bucket.location}</td>
                    <td className="rounded-r-2xl px-3 py-3">{formatDate(bucket.usage_end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {topBucket ? (
        <section className="rounded-[24px] border border-[#D8E6EB] bg-white p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Bucket com maior consumo</p>
          <p className="mt-2 text-xl font-black text-[#15323B]">{topBucket.name}</p>
          <p className="mt-1 text-sm text-[#5F7077]">
            {formatBytes(topBucket.total_size_bytes)} em {formatNumber(topBucket.object_count)} objetos.
          </p>
        </section>
      ) : null}
    </div>
  )
}
