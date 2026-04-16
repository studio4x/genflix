import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  COURSE_QUIZ_TYPE_OPTIONS,
  DEFAULT_COURSE_QUIZ_TYPE_SETTINGS,
  normalizeCourseQuizTypeSettings,
} from '@/features/assessments/course-quiz-type-settings'
import {
  fetchGlobalQuizTypeSettings,
  updateGlobalQuizTypeSettings,
} from '@/features/admin/quiz-types/api'
import type { CourseQuizTypeSettings } from '@/types/content'

export function AdminQuizTypesPage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<CourseQuizTypeSettings>({ ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      setIsLoading(true)

      try {
        const loadedSettings = await fetchGlobalQuizTypeSettings()
        if (isMounted) {
          setSettings(normalizeCourseQuizTypeSettings(loadedSettings))
        }
      } catch {
        if (isMounted) {
          setSettings({ ...DEFAULT_COURSE_QUIZ_TYPE_SETTINGS })
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      isMounted = false
    }
  }, [])

  const enabledCount = useMemo(
    () => Object.values(settings).filter(Boolean).length,
    [settings],
  )

  const disabledCount = COURSE_QUIZ_TYPE_OPTIONS.length - enabledCount

  async function handleSave() {
    setError(null)
    setSuccess(false)

    if (!user) {
      setError('Sessao expirada. Faça login novamente.')
      return
    }

    setIsSaving(true)

    try {
      const savedSettings = await updateGlobalQuizTypeSettings(settings, user.id)
      setSettings(savedSettings)
      setSuccess(true)
      window.setTimeout(() => setSuccess(false), 3000)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar os tipos globais de quiz.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-3 border-b border-slate-100 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Admin / Configurações</p>
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Tipos de Quiz Globais</h2>
            <p className="max-w-3xl text-sm font-medium leading-6 text-slate-500">
              Controle aqui quais formatos de quiz podem aparecer em qualquer curso. Se um tipo estiver desativado globalmente,
              ele não aparece nem como opção para ativar dentro das configurações do curso.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Ativos agora</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{enabledCount}</p>
            <p className="text-xs font-semibold text-slate-500">{disabledCount} desativado(s)</p>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          Tipos de quiz globais salvos com sucesso.
        </div>
      ) : null}

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Visibilidade global</p>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
              Use esta tela para definir a disponibilidade base da plataforma. As configurações do curso continuam existindo,
              mas apenas os tipos habilitados aqui aparecem no editor de cada curso.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Status</p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {isLoading ? 'Carregando...' : `${enabledCount} tipo(s) habilitado(s)`}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {COURSE_QUIZ_TYPE_OPTIONS.map((option) => {
            const isEnabled = settings[option.key]

            return (
              <label
                key={option.key}
                className={`block rounded-[24px] border p-5 shadow-sm transition-all ${
                  isEnabled ? option.accentClassName : 'border-slate-200 bg-slate-50/80 text-slate-500'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${
                      isEnabled ? option.badgeClassName : 'bg-slate-200 text-slate-600'
                    }`}>
                      {isEnabled ? 'Global ativo' : 'Global desativado'}
                    </span>
                    <div>
                      <p className="text-base font-black tracking-tight text-slate-900">{option.title}</p>
                      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{option.description}</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        [option.key]: event.target.checked,
                      }))
                    }
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                <p className="mt-4 text-xs font-semibold leading-relaxed text-slate-500">
                  {option.helper}
                </p>
              </label>
            )
          })}
        </div>

        <div className="mt-6 rounded-[24px] border border-blue-100 bg-blue-50/60 px-5 py-4 text-sm font-semibold text-blue-900">
          Tipos desativados globalmente não aparecem na configuração de cada curso.
        </div>

        <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || isLoading}
            className="h-14 rounded-2xl bg-slate-900 px-10 font-black shadow-xl shadow-slate-100 hover:bg-slate-800"
          >
            {isSaving ? 'Salvando...' : 'Salvar Configurações Globais'}
          </Button>
        </div>
      </section>
    </div>
  )
}

