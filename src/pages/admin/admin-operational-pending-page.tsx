import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, KeyRound, Mail, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'

type PendingItemStatus = 'blocked' | 'partial' | 'ready'

type PendingItem = {
  title: string
  area: string
  status: PendingItemStatus
  description: string
  missing: string[]
  nextSteps: string[]
  actionLabel?: string
  actionTo?: string
}

const pendingItems: PendingItem[] = [
  {
    title: 'Envio externo de e-mails',
    area: 'SMTP e domínio',
    status: 'ready',
    description:
      'A fila de notificações e o processador de e-mails já estão operando com SMTP ativo no deploy principal. Enquanto a plataforma estiver em construção, o remetente configurado é genflix@e-clix.com.br.',
    missing: [
      'Executar um teste real de envio para convite, recuperação de senha e notificações',
      'Substituir o remetente temporário pelo domínio final da GenFlix quando ele estiver pronto',
    ],
    nextSteps: [
      'Monitorar entregabilidade e autenticação do remetente atual.',
      'Quando o domínio final estiver disponível, atualizar SPF, DKIM e DMARC.',
      'Trocar o remetente operacional para o e-mail definitivo da plataforma.',
    ],
    actionLabel: 'Ver notificações',
    actionTo: '/admin/notificacoes',
  },
  {
    title: 'Asaas em produção',
    area: 'Pagamentos',
    status: 'ready',
    description:
      'O checkout e os repasses PIX já estão operando com o ambiente de produção do Asaas configurado no deploy principal da plataforma.',
    missing: [
      'Validar uma compra real controlada',
      'Confirmar recebimento do webhook de produção no painel Asaas',
    ],
    nextSteps: [
      'Cadastrar o webhook apontando para /api/webhooks/asaas no painel Asaas, se ainda não estiver ativo.',
      'Executar uma compra real controlada para validar a liberação automática do curso.',
      'Conferir eventos e checkout em /admin/pagamentos.',
    ],
    actionLabel: 'Abrir pagamentos',
    actionTo: '/admin/pagamentos',
  },
  {
    title: 'Validação Asaas sandbox',
    area: 'Pagamentos',
    status: 'ready',
    description:
      'A plataforma já possui credenciais e segredo dedicados para sandbox do Asaas, permitindo validar compras e repasses em ambiente de testes sem afetar a produção.',
    missing: [
      'Executar um checkout de teste em sandbox',
      'Confirmar o callback do webhook sandbox com um evento real',
    ],
    nextSteps: [
      'Rodar diagnóstico em /admin/pagamentos para confirmar os checks.',
      'Criar uma compra de teste em sandbox.',
      'Validar o processamento do webhook sandbox e a liberação controlada do curso.',
    ],
    actionLabel: 'Diagnosticar Asaas',
    actionTo: '/admin/pagamentos',
  },
  {
    title: 'Domínio final GenFlix',
    area: 'Infraestrutura',
    status: 'partial',
    description:
      'O projeto segue publicado no domínio temporário da Vercel. Algumas URLs e o remetente final devem ser revisados quando genflix.com.br estiver apontado.',
    missing: ['DNS do domínio final apontado para Vercel', 'APP_PUBLIC_URL atualizado para https://genflix.com.br'],
    nextSteps: [
      'Configurar o domínio final na Vercel.',
      'Apontar DNS conforme instruções da Vercel.',
      'Atualizar APP_PUBLIC_URL no ambiente de produção.',
      'Revalidar links de recuperação de senha, magic link, checkout e webhook.',
    ],
  },
]

function statusMeta(status: PendingItemStatus) {
  if (status === 'ready') {
    return {
      icon: CheckCircle2,
      label: 'Pronto',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    }
  }

  if (status === 'partial') {
    return {
      icon: Clock3,
      label: 'Parcial',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    }
  }

  return {
    icon: AlertTriangle,
    label: 'Bloqueado',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  }
}

function areaIcon(area: string) {
  if (area.includes('SMTP')) return Mail
  if (area.includes('Pagamento')) return WalletCards
  return KeyRound
}

export function AdminOperationalPendingPage() {
  const blockedCount = pendingItems.filter((item) => item.status === 'blocked').length
  const partialCount = pendingItems.filter((item) => item.status === 'partial').length

  return (
    <div className="animate-in space-y-7 fade-in duration-500">
      <header className="border-b border-[#D8E6EB] pb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Operação</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Pendências Operacionais</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#5F7077]">
              Centralize aqui funcionalidades que já têm estrutura técnica, mas ainda dependem de credenciais, domínio,
              SMTP, DNS ou validações externas antes de entrarem em operação real.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-5 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Bloqueadas</p>
              <p className="mt-1 font-readex text-2xl font-semibold text-[#15323b]">{blockedCount}</p>
            </div>
            <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-5 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Parciais</p>
              <p className="mt-1 font-readex text-2xl font-semibold text-[#15323b]">{partialCount}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-2">
        {pendingItems.map((item) => {
          const status = statusMeta(item.status)
          const StatusIcon = status.icon
          const AreaIcon = areaIcon(item.area)

          return (
            <article key={item.title} className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center border border-[#D8E6EB] bg-[#F2F7F9] text-[#1398B7]">
                    <AreaIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">{item.area}</p>
                    <h2 className="mt-1 font-readex text-xl font-semibold tracking-tight text-[#15323b]">{item.title}</h2>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-2 border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${status.className}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {status.label}
                </span>
              </div>

              <p className="mt-4 text-sm font-medium leading-7 text-[#5F7077]">{item.description}</p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="border border-[#D8E6EB] bg-[#F2F7F9] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Falta informar/configurar</p>
                  <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-[#15323b]">
                    {item.missing.map((missing) => (
                      <li key={missing}>- {missing}</li>
                    ))}
                  </ul>
                </div>
                <div className="border border-[#D8E6EB] bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Próximos passos</p>
                  <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-[#15323b]">
                    {item.nextSteps.map((step) => (
                      <li key={step}>- {step}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {item.actionTo && item.actionLabel ? (
                <div className="mt-5">
                  <Link
                    to={item.actionTo}
                    className="inline-flex items-center gap-2 bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-5 py-3 text-sm font-black text-white transition hover:opacity-95"
                  >
                    {item.actionLabel}
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              ) : null}
            </article>
          )
        })}
      </section>
    </div>
  )
}
