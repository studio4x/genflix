import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { NotificationPreferencesPage } from '@/pages/shared/notification-preferences-page'
import { NotificationsOverviewPanel } from '@/features/notifications/notifications-overview-panel'

type StudentNotificationsTab = 'notificacoes' | 'preferencias'

interface StudentNotificationsPageProps {
  initialTab?: StudentNotificationsTab
}

export function StudentNotificationsPage({ initialTab = 'notificacoes' }: StudentNotificationsPageProps) {
  const activeTab = initialTab

  function renderTabLink(tab: StudentNotificationsTab, label: string, to: string) {
    const isActive = activeTab === tab

    return (
      <Link
        to={to}
        className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
          isActive
            ? 'border-blue-200 bg-blue-600 text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-slate-900'
        }`}
      >
        {label}
      </Link>
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
            {renderTabLink('notificacoes', 'Notificações', '/aluno/notificacoes')}
            {renderTabLink('preferencias', 'Preferências', '/aluno/preferencias-notificacoes')}
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
