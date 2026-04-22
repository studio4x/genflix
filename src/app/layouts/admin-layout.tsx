import { Link, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { PlatformFooter } from '@/components/layout/platform-footer'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { Button } from '@/components/ui/button'
import { NotificationCenter } from '@/features/notifications/notification-center'

const adminLinks = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/cursos', label: 'Catálogo de Cursos' },
  { to: '/admin/botoes-aula', label: 'Botões de Aula' },
  { to: '/admin/usuarios', label: 'Usuários' },
  { to: '/admin/grupos', label: 'Grupos' },
  { to: '/admin/formularios', label: 'Formulários' },
  { to: '/admin/notificacoes', label: 'Notificações' },
  { to: '/admin/preferencias-notificacoes', label: 'Preferências' },
  { to: '/admin/mensagens', label: 'Mensagens' },
  { to: '/admin/reviews', label: 'Reviews' },
  { to: '/admin/pagamentos', label: 'Pagamentos' },
  { to: '/admin/repasses', label: 'Repasses PIX' },
  { to: '/admin/tipos-quiz', label: 'Tipos de Quiz' },
  { to: '/admin/banners', label: 'Banners' },
  { to: '/admin/configuracoes-site', label: 'Configuracoes do Site' },
  { to: '/admin/site-editor', label: 'Editor Visual' },
  { to: '/admin/pendencias', label: 'Pendências' },
  { to: '/admin/minha-conta', label: 'Minha Conta' },
  { to: '/admin/relatorios', label: 'Relatórios' },
]

export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <header className="sticky top-0 z-40 border-b border-[#D8E6EB] bg-[#F2F7F9]/95 backdrop-blur-md">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Ir para a home da GenFlix">
              <GenflixLogo />
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Painel Admin</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationCenter compact />
            <div className="hidden items-center gap-3 rounded-full border border-[#D8E6EB] bg-white px-2 py-1.5 shadow-sm md:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8F6FA] text-xs font-black text-[#1398B7]">
                {profile?.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="pr-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Conta</p>
                <p className="max-w-[220px] truncate text-sm font-semibold text-[#163138]">{profile?.email}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void signOut()}
              className="rounded-xl border-[#D8E6EB] bg-white font-bold text-[#5f7077] hover:border-[#1398B7]/40 hover:text-[#163138]"
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="self-start lg:sticky lg:top-[92px]">
          <div className="overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white shadow-[0_20px_50px_rgba(22,49,56,0.05)]">
            <div className="border-b border-[#D8E6EB] px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Navegação</p>
              <h2 className="mt-1 font-readex text-lg font-semibold tracking-tight text-[#15323b]">Admin</h2>
            </div>
            <nav className="space-y-1 p-3">
              {adminLinks.map((link) => {
                const isActive =
                  location.pathname === link.to ||
                  (link.to !== '/admin' && location.pathname.startsWith(link.to))

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-[#1398B7] text-white shadow-lg shadow-[#1398B7]/20'
                        : 'text-[#5f7077] hover:bg-[#F2F7F9] hover:text-[#163138]'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <section className="rounded-[32px] border border-[#D8E6EB] bg-white p-5 shadow-[0_20px_50px_rgba(22,49,56,0.04)] sm:p-7">
            <Outlet />
          </section>
          <PlatformFooter
            className="rounded-[28px] border border-[#D8E6EB] bg-white px-5 py-5 shadow-sm"
            linksClassName="text-[#5F7077]"
            versionClassName="text-[#5F7077]"
            compact
          />
        </div>
      </div>
    </main>
  )
}
