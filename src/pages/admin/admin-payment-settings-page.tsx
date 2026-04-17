import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import {
  fetchPaymentGatewaySettings,
  updatePaymentGatewaySettings,
  type PaymentGatewayEnvironment,
} from '@/features/admin/commerce/api'

function buildWebhookUrl() {
  if (typeof window === 'undefined') {
    return '/api/webhooks/asaas'
  }

  return `${window.location.origin}/api/webhooks/asaas`
}

export function AdminPaymentSettingsPage() {
  const { user } = useAuth()
  const [environment, setEnvironment] = useState<PaymentGatewayEnvironment>('sandbox')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      setIsLoading(true)
      setError(null)
      try {
        const settings = await fetchPaymentGatewaySettings()
        if (isMounted) {
          setEnvironment(settings.environment)
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as configurações.')
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

  const webhookUrl = useMemo(() => buildWebhookUrl(), [])

  async function handleSave(nextEnvironment: PaymentGatewayEnvironment) {
    if (!user) {
      setError('Usuario nao autenticado.')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await updatePaymentGatewaySettings(nextEnvironment, user.id)
      setEnvironment(nextEnvironment)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar as configurações.')
    } finally {
      setIsSaving(false)
    }
  }

  async function copyWebhook() {
    await navigator.clipboard.writeText(webhookUrl)
    setCopySuccess(true)
    window.setTimeout(() => setCopySuccess(false), 2000)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-3 border-b border-slate-100 pb-6">
        <div className="inline-flex rounded-full border border-cyan-100 bg-cyan-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-700">
          Pagamento Asaas
        </div>
        <h2 className="text-3xl font-black tracking-tight text-slate-900">Configurações de pagamento</h2>
        <p className="max-w-3xl text-sm text-slate-500">
          Use esta tela para conferir o que precisa ser configurado no gateway, copiar a URL do webhook e alternar
          entre produção e sandbox.
        </p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Checklist</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">O que precisa estar configurado</h3>
            <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
              <p>1. Defina a chave de API do Asaas para produção e sandbox nas variáveis de ambiente do deploy.</p>
              <p>2. Aponte o webhook do Asaas para a URL exibida nesta tela.</p>
              <p>3. Escolha o ambiente ativo abaixo e salve a configuração.</p>
              <p>4. Quando o pagamento for confirmado, o acesso ao curso será liberado automaticamente.</p>
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Ambiente</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">Trocar entre sandbox e produção</h3>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void handleSave('sandbox')}
                disabled={isSaving || isLoading}
                className={`rounded-2xl border px-5 py-3 text-sm font-black transition-all ${
                  environment === 'sandbox'
                    ? 'border-cyan-300 bg-cyan-50 text-cyan-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Sandbox
              </button>
              <button
                type="button"
                onClick={() => void handleSave('production')}
                disabled={isSaving || isLoading}
                className={`rounded-2xl border px-5 py-3 text-sm font-black transition-all ${
                  environment === 'production'
                    ? 'border-cyan-300 bg-cyan-50 text-cyan-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Produção
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Ambiente atual: <span className="font-black text-slate-900">{environment}</span>
            </p>
          </article>
        </div>

        <div className="space-y-6">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Webhook</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">URL para cadastrar no Asaas</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Cadastre esta URL na área de webhooks do Asaas, selecionando os eventos de checkout. Ela recebe a
              confirmação de pagamento e libera o curso automaticamente.
            </p>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="break-all text-sm font-semibold text-slate-700">{webhookUrl}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="button" onClick={() => void copyWebhook()} className="rounded-2xl bg-cyan-600 hover:bg-cyan-700">
                {copySuccess ? 'Copiado' : 'Copiar URL'}
              </Button>
              <Button asChild variant="outline" className="rounded-2xl">
                <a href="https://docs.asaas.com/docs/checkout-asaas" target="_blank" rel="noreferrer">
                  Abrir docs
                </a>
              </Button>
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Variáveis</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">Chaves necessárias no deploy</h3>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              <li><span className="font-black text-slate-900">ASAAS_ACCESS_TOKEN_SANDBOX</span> para testes.</li>
              <li><span className="font-black text-slate-900">ASAAS_ACCESS_TOKEN_PRODUCTION</span> para produção.</li>
              <li><span className="font-black text-slate-900">ASAAS_WEBHOOK_SECRET</span> se você quiser validar a assinatura do webhook.</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  )
}
