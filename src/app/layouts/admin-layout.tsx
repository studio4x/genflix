import { Link, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { PlatformFooter } from '@/components/layout/platform-footer'
import { Button } from '@/components/ui/button'

const adminLinks = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/cursos', label: 'Catálogo de Cursos' },
  { to: '/admin/alunos', label: 'Alunos' },
  { to: '/admin/grupos', label: 'Grupos' },
  { to: '/admin/relatorios', label: 'Relatórios' },
]

export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  return (
    <main className="min-h-screen bg-slate-100/70">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="flex w-full items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_8px_24px_rgba(37,99,235,0.28)]">
              <span className="text-lg font-black leading-none">HM</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Painel Admin</p>
              <h1 className="text-xl font-black tracking-tight text-slate-900">HomeCare Match Academy</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-sm md:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">
                {profile?.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="pr-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Conta</p>
                <p className="max-w-[220px] truncate text-sm font-semibold text-slate-700">{profile?.email}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void signOut()}
              className="rounded-xl border-slate-200 bg-white font-bold text-slate-600 hover:text-slate-900"
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="self-start lg:sticky lg:top-[92px]">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Navegação</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900">Admin</h2>
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
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
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
          <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <Outlet />
          </section>
          <PlatformFooter className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm" compact />
        </div>
      </div>
    </main>
  )
}
