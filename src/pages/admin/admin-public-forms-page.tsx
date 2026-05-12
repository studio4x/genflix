import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase/client'

interface PublicFormSubmission {
  id: string
  form_type: string
  name: string | null
  email: string | null
  message: string | null
  payload: Record<string, unknown>
  source_path: string | null
  source_url: string | null
  created_at: string
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function escapeCsvValue(value: unknown) {
  const stringValue = value == null ? '' : String(value)
  return `"${stringValue.replace(/"/g, '""')}"`
}

function readInterestAreas(item: PublicFormSubmission) {
  const interestAreas = item.payload.interest_areas
  if (!Array.isArray(interestAreas)) {
    return []
  }

  return interestAreas
    .map((area) => (typeof area === 'string' ? area.trim() : ''))
    .filter((area) => area.length > 0)
}

export function AdminPublicFormsPage() {
  const [items, setItems] = useState<PublicFormSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [formFilter, setFormFilter] = useState('all')
  const [interestAreaFilter, setInterestAreaFilter] = useState('all')

  async function loadSubmissions() {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const result = await supabase
        .from('public_form_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(250)

      if (result.error) {
        throw result.error
      }

      setItems((result.data ?? []) as PublicFormSubmission[])
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel carregar formularios.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSubmissions()
  }, [])

  useEffect(() => {
    if (formFilter !== 'newsletter') {
      setInterestAreaFilter('all')
    }
  }, [formFilter])

  const filteredItems = useMemo(() => {
    let currentItems = formFilter === 'all'
      ? items
      : items.filter((item) => item.form_type === formFilter)

    if (formFilter === 'newsletter' && interestAreaFilter !== 'all') {
      currentItems = currentItems.filter((item) => readInterestAreas(item).includes(interestAreaFilter))
    }

    return currentItems
  }, [formFilter, interestAreaFilter, items])

  const newsletterInterestAreas = useMemo(() => {
    const areaSet = new Set<string>()

    items
      .filter((item) => item.form_type === 'newsletter')
      .forEach((item) => {
        readInterestAreas(item).forEach((area) => areaSet.add(area))
      })

    return Array.from(areaSet).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [items])

  function exportCsv() {
    const header = ['id', 'tipo', 'nome', 'email', 'areas_interesse', 'mensagem', 'origem', 'criado_em']
    const rows = filteredItems.map((item) => [
      item.id,
      item.form_type,
      item.name ?? '',
      item.email ?? '',
      readInterestAreas(item).join(' | '),
      item.message ?? '',
      item.source_url ?? item.source_path ?? '',
      item.created_at,
    ])
    const csv = [header, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `formularios_genflix_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Formularios</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Formularios publicos</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">
            Leads de contato, newsletter e outros formularios enviados pelas paginas publicas.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={formFilter}
            onChange={(event) => setFormFilter(event.target.value)}
            className="h-11 rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-black text-[#15323b] outline-none"
          >
            <option value="all">Todos</option>
            <option value="contact">Contato</option>
            <option value="teach">Ensine na GenFlix</option>
            <option value="newsletter">Newsletter</option>
            <option value="lead">Lead</option>
            <option value="support">Suporte</option>
          </select>
          {formFilter === 'newsletter' ? (
            <select
              value={interestAreaFilter}
              onChange={(event) => setInterestAreaFilter(event.target.value)}
              className="h-11 rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-black text-[#15323b] outline-none"
            >
              <option value="all">Todas as áreas</option>
              {newsletterInterestAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          ) : null}
          <Button type="button" variant="outline" onClick={() => void loadSubmissions()} className="rounded-2xl border-[#D8E6EB]">
            Atualizar
          </Button>
          <Button type="button" onClick={exportCsv} className="rounded-2xl bg-[#1398B7] hover:bg-[#0A3640]">
            Exportar CSV
          </Button>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white">
        {isLoading ? (
          <p className="p-5 text-sm font-medium text-[#6d7f84]">Carregando formularios...</p>
        ) : filteredItems.length === 0 ? (
          <p className="p-5 text-sm font-medium text-[#6d7f84]">Nenhum formulario encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
              <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
                <tr>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Contato</th>
                  <th className="px-5 py-3">Mensagem</th>
                  <th className="px-5 py-3">Origem</th>
                  <th className="px-5 py-3">Recebido em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E6EB]">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-5 py-4 font-black uppercase text-[#15323b]">{item.form_type}</td>
                    <td className="px-5 py-4">
                      <p className="font-black text-[#15323b]">{item.name || 'Sem nome'}</p>
                      <p className="mt-1 text-xs font-semibold text-[#6d7f84]">{item.email || 'Sem e-mail'}</p>
                      {readInterestAreas(item).length > 0 ? (
                        <p className="mt-2 inline-flex rounded-full border border-[#D8E6EB] bg-[#F2F7F9] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                          Áreas: {readInterestAreas(item).join(', ')}
                        </p>
                      ) : null}
                    </td>
                    <td className="max-w-[360px] px-5 py-4 text-[#5f7077]">
                      {item.message || JSON.stringify(item.payload)}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-[#6d7f84]">
                      {item.source_url || item.source_path || '-'}
                    </td>
                    <td className="px-5 py-4 font-semibold text-[#5f7077]">{formatDateTime(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
