import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { NotificationPreferencesPage } from '@/pages/shared/notification-preferences-page'
import { NotificationsOverviewPanel } from '@/features/notifications/notifications-overview-panel'

type StudentNotificationsTab = 'notificacoes' | 'preferencias'

export function StudentNotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = useMemo<StudentNotificationsTab>(() => {
    return searchParams.get('tab') === 'preferencias' ? 'preferencias' : 'notificacoes'
  }, [searchParams])

  function renderTabButton(tab: StudentNotificationsTab, label: string) {
    const isActive = activeTab === tab

    return (
      <button
        key={tab}
        type="button"
        onClick={() =>
          setSearchParams((current) => {
            const next = new URLSearchParams(current)
            if (tab === 'notificacoes') {
              next.delete('tab')
            } else {
              next.set('tab', tab)
            }
            return next
          }, { replace: true })
        }
        className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
          isActive
            ? 'border-blue-200 bg-blue-600 text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-slate-900'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-slate-100 pb-8 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-blue-600">
            Painel do Aluno
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">Notificações</h1>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
              Consulte avisos transacionais, comunicados da plataforma e ajuste suas preferências sem voltar ao dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {renderTabButton('notificacoes', 'Notificações')}
            {renderTabButton('preferencias', 'Preferências')}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild type="button" variant="outline" className="h-12 rounded-2xl border-slate-200 px-5 font-bold text-slate-600">
            <Link to="/aluno/dashboard">Voltar ao dashboard</Link>
          </Button>
        </div>
      </header>

      {activeTab === 'preferencias' ? (
        <NotificationPreferencesPage contextLabel="Aluno" />
      ) : (
        <NotificationsOverviewPanel />
      )}
    </div>
  )
}
