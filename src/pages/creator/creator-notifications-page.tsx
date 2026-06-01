import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { NotificationsOverviewPanel } from '@/features/notifications/notifications-overview-panel'
import { NotificationPreferencesPage } from '@/pages/shared/notification-preferences-page'

type CreatorNotificationsTab = 'notificacoes' | 'preferencias'

export function CreatorNotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = useMemo<CreatorNotificationsTab>(() => {
    return searchParams.get('tab') === 'preferencias' ? 'preferencias' : 'notificacoes'
  }, [searchParams])

  function renderTabButton(tab: CreatorNotificationsTab, label: string) {
    const isActive = activeTab === tab

    return (
      <button
        key={tab}
        type="button"
        onClick={() => setSearchParams((current) => {
          const next = new URLSearchParams(current)
          if (tab === 'notificacoes') {
            next.delete('tab')
          } else {
            next.set('tab', tab)
          }
          return next
        }, { replace: true })}
        className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
          isActive
            ? 'border-[#1398B7] bg-[#1398B7] text-white'
            : 'border-[#D8E6EB] bg-white text-[#5F7077] hover:border-[#1398B7] hover:text-[#15323b]'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Criador / Relacionamento</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">
            {activeTab === 'preferencias' ? 'Preferencias' : 'Notificacoes'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
            {activeTab === 'preferencias'
              ? 'Ajuste seus canais e horarios de silencio sem misturar essas configura??es com a tela de relatorios.'
              : 'Consulte avisos transacionais e comunicados da plataforma em uma area dedicada para notificacoes.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {renderTabButton('notificacoes', 'Notificacoes')}
            {renderTabButton('preferencias', 'Preferencias')}
          </div>
        </div>
      </header>

      {activeTab === 'preferencias' ? (
        <NotificationPreferencesPage contextLabel="Criador" />
      ) : (
        <NotificationsOverviewPanel />
      )}
    </div>
  )
}
