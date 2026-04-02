import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  createButtonTemplate,
  deleteButtonTemplate,
  fetchButtonTemplates,
  toErrorMessage,
  updateButtonTemplate,
} from '@/features/admin/content/api'
import {
  buttonTemplateFormSchema,
  type ButtonTemplateFormInput,
} from '@/features/admin/content/schemas'
import type { ButtonTemplate } from '@/types/content'

const INITIAL_FORM: ButtonTemplateFormInput = {
  name: '',
  default_label: '',
  variant: 'outline',
  theme: 'blue',
  icon: 'link',
  is_active: true,
}

const VARIANTS: ButtonTemplateFormInput['variant'][] = ['primary', 'secondary', 'outline', 'ghost', 'link']
const THEMES: ButtonTemplateFormInput['theme'][] = ['blue', 'emerald', 'amber', 'rose', 'slate', 'violet']

export function AdminButtonTemplatesPage() {
  const [templates, setTemplates] = useState<ButtonTemplate[]>([])
  const [form, setForm] = useState<ButtonTemplateFormInput>(INITIAL_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        setTemplates(await fetchButtonTemplates())
      } catch (err) {
        setError(toErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }

    void load()
  }, [])

  function startEdit(template: ButtonTemplate) {
    setEditingId(template.id)
    setForm({
      name: template.name,
      default_label: template.default_label,
      variant: template.variant,
      theme: template.theme,
      icon: template.icon,
      is_active: template.is_active,
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(INITIAL_FORM)
  }

  async function handleSubmit() {
    setError(null)
    const parsed = buttonTemplateFormSchema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dados invalidos.')
      return
    }

    setIsSaving(true)
    try {
      const saved = editingId
        ? await updateButtonTemplate(editingId, parsed.data)
        : await createButtonTemplate(parsed.data)

      setTemplates((prev) => {
        if (editingId) {
          return prev.map((template) => (template.id === editingId ? saved : template))
        }
        return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      })

      resetForm()
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(template: ButtonTemplate) {
    if (!window.confirm(`Excluir o padrao "${template.name}"?`)) return

    try {
      await deleteButtonTemplate(template.id)
      setTemplates((prev) => prev.filter((item) => item.id !== template.id))
      if (editingId === template.id) {
        resetForm()
      }
    } catch (err) {
      setError(toErrorMessage(err))
    }
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Padroes de Botoes das Aulas</h2>
        <p className="mt-1 text-sm text-slate-500">
          Defina o visual, o rotulo padrao e o icone que poderao ser usados no rodape de cada aula.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-6">
          <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">
            {editingId ? 'Editar padrao' : 'Novo padrao'}
          </h3>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Nome interno</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Rotulo padrao</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                value={form.default_label}
                onChange={(event) => setForm((prev) => ({ ...prev, default_label: event.target.value }))}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Icone</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                value={form.icon}
                onChange={(event) => setForm((prev) => ({ ...prev, icon: event.target.value }))}
                placeholder="download, external-link, book-open..."
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Variante</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                value={form.variant}
                onChange={(event) => setForm((prev) => ({ ...prev, variant: event.target.value as ButtonTemplateFormInput['variant'] }))}
              >
                {VARIANTS.map((variant) => (
                  <option key={variant} value={variant}>{variant}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Tema</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                value={form.theme}
                onChange={(event) => setForm((prev) => ({ ...prev, theme: event.target.value as ButtonTemplateFormInput['theme'] }))}
              >
                {THEMES.map((theme) => (
                  <option key={theme} value={theme}>{theme}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              <span className="text-sm font-bold text-slate-700">Padrao ativo</span>
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex gap-3">
            <Button className="flex-1 rounded-2xl bg-blue-600 hover:bg-blue-700" disabled={isSaving} onClick={() => void handleSubmit()}>
              {isSaving ? 'Salvando...' : editingId ? 'Salvar Padrao' : 'Criar Padrao'}
            </Button>
            {editingId ? (
              <Button variant="outline" className="rounded-2xl" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Catalogo</h3>

          {isLoading ? (
            <p className="mt-5 text-sm text-slate-500">Carregando padroes...</p>
          ) : templates.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              Nenhum padrao encontrado.
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {templates.map((template) => (
                <article key={template.id} className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-black text-slate-900">{template.name}</h4>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                          template.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {template.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-600">{template.default_label}</p>
                      <p className="mt-1 text-xs uppercase tracking-wider text-slate-400">
                        {template.variant} • {template.theme} • {template.icon}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => startEdit(template)}>
                        Editar
                      </Button>
                      <Button variant="outline" className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => void handleDelete(template)}>
                        Excluir
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
