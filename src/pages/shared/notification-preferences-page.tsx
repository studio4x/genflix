import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  defaultNotificationPreferences,
  fetchNotificationPreferences,
  saveNotificationPreferences,
  type EmailDigestFrequency,
  type NotificationPreferencesInput,
} from '@/features/notifications/api'

const digestOptions: Array<{ value: EmailDigestFrequency; label: string; description: string }> = [
  {
    value: 'immediate',
    label: 'Imediato',
    description: 'Cada evento importante pode gerar e-mail assim que acontecer.',
  },
  {
    value: 'daily',
    label: 'Resumo diário',
    description: 'Agrupa comunicações menos urgentes em um resumo por dia.',
  },
  {
    value: 'weekly',
    label: 'Resumo semanal',
    description: 'Receba apenas um resumo semanal quando houver novidades.',
  },
  {
    value: 'never',
    label: 'Nunca',
    description: 'Desativa e-mails recorrentes, mantendo avisos críticos quando necessário.',
  },
]

const timezoneOptions = [
  { value: 'America/Sao_Paulo', label: 'Brasília (UTC-03:00)' },
  { value: 'America/Recife', label: 'Recife (UTC-03:00)' },
  { value: 'America/Manaus', label: 'Manaus (UTC-04:00)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-05:00)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-02:00)' },
]

interface NotificationPreferencesPageProps {
  contextLabel: 'Admin' | 'Aluno' | 'Autor'
}

function SwitchField({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`flex w-full items-center justify-between gap-4 border p-4 text-left transition ${
        checked
          ? 'border-[#1398B7] bg-[#E8F6FA]'
          : 'border-[#D8E6EB] bg-white hover:border-[#1398B7]/40'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span>
        <span className="block font-readex text-sm font-semibold text-[#15323b]">{title}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-[#5F7077]">{description}</span>
      </span>
      <span className={`relative h-6 w-11 shrink-0 border transition ${checked ? 'border-[#1398B7] bg-[#1398B7]' : 'border-[#D8E6EB] bg-[#EDF4F6]'}`}>
        <span className={`absolute top-1 h-4 w-4 bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  )
}

export function NotificationPreferencesPage({ contextLabel }: NotificationPreferencesPageProps) {
  const { user } = useAuth()
  const [form, setForm] = useState<NotificationPreferencesInput>(defaultNotificationPreferences)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadPreferences = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const preferences = await fetchNotificationPreferences(user.id)
      setForm({
        push_enabled: preferences.push_enabled,
        email_enabled: preferences.email_enabled,
        whatsapp_enabled: preferences.whatsapp_enabled,
        in_app_enabled: preferences.in_app_enabled,
        quiet_hours_enabled: preferences.quiet_hours_enabled,
        quiet_hours_start: preferences.quiet_hours_start ?? defaultNotificationPreferences.quiet_hours_start,
        quiet_hours_end: preferences.quiet_hours_end ?? defaultNotificationPreferences.quiet_hours_end,
        quiet_hours_timezone: preferences.quiet_hours_timezone,
        email_digest: preferences.email_digest,
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar as preferências.')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadPreferences()
  }, [loadPreferences])

  const enabledChannels = useMemo(() => {
    return [
      form.in_app_enabled ? 'In-app' : null,
      form.email_enabled ? 'E-mail' : null,
      form.push_enabled ? 'Push' : null,
      form.whatsapp_enabled ? 'WhatsApp' : null,
    ].filter(Boolean)
  }, [form.email_enabled, form.in_app_enabled, form.push_enabled, form.whatsapp_enabled])

  function updateForm(patch: Partial<NotificationPreferencesInput>) {
    setForm((current) => ({ ...current, ...patch }))
    setSuccessMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user?.id) {
      setErrorMessage('Sessão expirada. Faça login novamente.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await saveNotificationPreferences(user.id, {
        ...form,
        quiet_hours_start: form.quiet_hours_enabled ? form.quiet_hours_start : null,
        quiet_hours_end: form.quiet_hours_enabled ? form.quiet_hours_end : null,
      })
      setSuccessMessage('Preferências de notificação salvas com sucesso.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível salvar as preferências.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 border-b border-[#D8E6EB] pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#1398B7]">
            {contextLabel} / Notificações
          </p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">
            Preferências de Notificação
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#5F7077]">
            Escolha por quais canais você quer receber avisos da plataforma e defina um horário de silêncio para reduzir interrupções.
          </p>
        </div>

        <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Canais ativos</p>
          <p className="mt-2 font-readex text-lg font-semibold text-[#15323b]">
            {enabledChannels.length > 0 ? enabledChannels.join(', ') : 'Nenhum'}
          </p>
        </div>
      </header>

      {errorMessage ? (
        <div className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <section className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <div className="border-b border-[#D8E6EB] pb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Canais</p>
            <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Como você quer ser avisado</h2>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <SwitchField
              title="Notificações in-app"
              description="Mantém avisos dentro do painel e no sino de notificações."
              checked={form.in_app_enabled}
              disabled={isLoading}
              onChange={(checked) => updateForm({ in_app_enabled: checked })}
            />
            <SwitchField
              title="E-mail"
              description="Permite comunicações por e-mail quando houver eventos importantes."
              checked={form.email_enabled}
              disabled={isLoading}
              onChange={(checked) => updateForm({ email_enabled: checked })}
            />
            <SwitchField
              title="Push"
              description="Reserva o canal para avisos do navegador quando ele estiver habilitado."
              checked={form.push_enabled}
              disabled={isLoading}
              onChange={(checked) => updateForm({ push_enabled: checked })}
            />
            <SwitchField
              title="WhatsApp"
              description="Canal preparado para futuras integrações externas da operação."
              checked={form.whatsapp_enabled}
              disabled={isLoading}
              onChange={(checked) => updateForm({ whatsapp_enabled: checked })}
            />
          </div>
        </section>

        <section className="border border-[#D8E6EB] bg-[#F2F7F9] p-5 shadow-sm">
          <div className="border-b border-[#D8E6EB] pb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Frequência</p>
            <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Resumo por e-mail</h2>
          </div>

          <div className="mt-5 space-y-3">
            {digestOptions.map((option) => {
              const isSelected = form.email_digest === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={isLoading || !form.email_enabled}
                  onClick={() => updateForm({ email_digest: option.value })}
                  className={`w-full border p-4 text-left transition ${
                    isSelected
                      ? 'border-[#1398B7] bg-white'
                      : 'border-[#D8E6EB] bg-white/70 hover:border-[#1398B7]/40'
                  } ${!form.email_enabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <span className="font-readex text-sm font-semibold text-[#15323b]">{option.label}</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-[#5F7077]">{option.description}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="border border-[#D8E6EB] bg-white p-5 shadow-sm xl:col-span-2">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Horário de silêncio</p>
              <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Evitar interrupções</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[#5F7077]">
                Quando ativo, os canais externos podem respeitar essa janela e adiar comunicações não urgentes.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SwitchField
                title="Ativar silêncio"
                description="Aplicar janela de pausa para avisos não urgentes."
                checked={form.quiet_hours_enabled}
                disabled={isLoading}
                onChange={(checked) => updateForm({ quiet_hours_enabled: checked })}
              />

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Início</span>
                <input
                  type="time"
                  value={form.quiet_hours_start ?? ''}
                  disabled={isLoading || !form.quiet_hours_enabled}
                  onChange={(event) => updateForm({ quiet_hours_start: event.target.value })}
                  className="h-12 w-full border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm font-black text-[#15323b] outline-none focus:border-[#1398B7]"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Fim</span>
                <input
                  type="time"
                  value={form.quiet_hours_end ?? ''}
                  disabled={isLoading || !form.quiet_hours_enabled}
                  onChange={(event) => updateForm({ quiet_hours_end: event.target.value })}
                  className="h-12 w-full border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm font-black text-[#15323b] outline-none focus:border-[#1398B7]"
                />
              </label>

              <label className="block space-y-2 md:col-span-3">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">Fuso horário</span>
                <select
                  value={form.quiet_hours_timezone}
                  disabled={isLoading || !form.quiet_hours_enabled}
                  onChange={(event) => updateForm({ quiet_hours_timezone: event.target.value })}
                  className="h-12 w-full border border-[#D8E6EB] bg-[#F2F7F9] px-4 text-sm font-black text-[#15323b] outline-none focus:border-[#1398B7]"
                >
                  {timezoneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 xl:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-[#5F7077]">
            Preferências críticas de segurança e pagamento podem continuar sendo enviadas mesmo com canais reduzidos.
          </p>
          <Button
            type="submit"
            disabled={isLoading || isSaving}
            className="h-12 rounded-2xl bg-[#1398B7] px-7 font-black text-white hover:bg-[#0A3640]"
          >
            {isSaving ? 'Salvando...' : 'Salvar preferências'}
          </Button>
        </div>
      </form>
    </div>
  )
}
