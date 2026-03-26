import { Link, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { AppVersion } from '@/components/layout/AppVersion'
import { Button } from '@/components/ui/button'

export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  return (
    <main className="min-h-screen bg-slate-50/50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_4px_12px_rgba(0,119,255,0.25)]">
              <span className="font-bold text-lg leading-none">HM</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Painel Admin</p>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">HomeCare Match <span className="text-blue-600">Academy</span></h1>
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mt-1">LMS Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 rounded-full border border-slate-200 bg-white py-1.5 pl-2 pr-4 shadow-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {profile?.email?.[0].toUpperCase() || 'U'}
              </div>
              <p className="text-sm font-medium text-slate-700">{profile?.email}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => void signOut()} className="text-slate-500 hover:text-slate-900 font-medium">
              Sair
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl flex-col md:flex-row gap-8 p-6 lg:p-8">
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-col gap-1.5 text-sm font-medium text-slate-600">
            {[
              { to: '/admin', label: 'Dashboard' },
              { to: '/admin/cursos', label: 'Cursos e Módulos' },
              { to: '/admin/alunos', label: 'Alunos' },
              { to: '/admin/grupos', label: 'Grupos' },
              { to: '/admin/relatorios', label: 'Relatórios' }
            ].map(link => {
              const isActive = location.pathname === link.to || (link.to !== '/admin' && location.pathname.startsWith(link.to));
              return (
                <Link
                  key={link.to}
                  className={`rounded-xl px-4 py-3 transition-all ${
                    isActive 
                      ? 'bg-white text-blue-700 font-bold shadow-sm ring-1 ring-slate-100' 
                      : 'hover:bg-white hover:text-slate-900 hover:shadow-sm'
                  }`}
                  to={link.to}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <section className="flex-1 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
          <Outlet />
        </section>
      </div>
      <div className="mx-auto flex w-full max-w-7xl justify-end px-6 pb-6 lg:px-8">
        <AppVersion className="text-xs font-black uppercase tracking-widest text-slate-400" />
      </div>
    </main>
  )
}
