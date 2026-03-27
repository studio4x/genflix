import { Link, Outlet, useLocation } from 'react-router-dom'

import homeCareMatchLogoUrl from '@/assets/homecare-match-logo.jpg'
import { useAuth } from '@/app/providers/auth-provider'
import { PlatformFooter } from '@/components/layout/platform-footer'
import { Button } from '@/components/ui/button'

const studentLinks = [
  {
    to: '/aluno/dashboard',
    label: 'Inicio',
    description: 'Painel principal',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/aluno/cursos',
    label: 'Cursos',
    description: 'Treinamentos liberados',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    to: '/aluno/minha-conta',
    label: 'Minha Conta',
    description: 'Dados e seguranca',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

function getStudentDisplayName(fullName: string | null | undefined, email: string | null | undefined) {
  if (fullName?.trim()) {
    return fullName.trim()
  }

  if (email?.trim()) {
    return email.split('@')[0]
  }

  return 'Aluno'
}

export function StudentLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const displayName = getStudentDisplayName(profile?.full_name, profile?.email)
  const firstName = displayName.split(' ')[0] ?? displayName

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="px-4 py-3 sm:px-6 lg:px-8">
          <div className="relative flex min-h-[60px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link to="/aluno/dashboard" className="flex min-w-0 items-center gap-3">
                <img
                  src={homeCareMatchLogoUrl}
                  alt="HomeCare Match"
                  className="h-12 w-12 rounded-full bg-white object-contain shadow-sm"
                />
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-black tracking-tight text-slate-900">HomeCare Match</h1>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">Academy</p>
                </div>
              </Link>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
              <p className="whitespace-nowrap text-sm font-black uppercase tracking-[0.28em] text-slate-400">
                Área do Aluno
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/aluno/minha-conta"
                className={`hidden items-center gap-3 rounded-full border px-2 py-1.5 shadow-sm transition-colors md:flex ${
                  location.pathname.startsWith('/aluno/minha-conta')
                    ? 'border-cyan-200 bg-cyan-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-black text-white shadow-sm">
                  {firstName.slice(0, 2).toUpperCase()}
                </div>
                <div className="pr-2">
                  <p className="text-sm font-black text-slate-900">{displayName}</p>
                  <p className="text-[11px] font-medium text-slate-500">Minha Conta</p>
                </div>
              </Link>
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

          <div className="mt-3 flex items-center justify-center md:hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Área do Aluno</p>
          </div>

          <div className="mt-3 flex justify-center">
            <nav className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 lg:flex">
              {studentLinks.map((link) => {
                const isActive = location.pathname.startsWith(link.to)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                      isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="self-start lg:sticky lg:top-[120px]">
          <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-base font-black text-white shadow-sm">
                  {firstName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-black tracking-tight text-slate-900">{displayName}</p>
                  <p className="mt-1 text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">Aluno</p>
                  <p className="mt-2 truncate text-sm font-medium text-slate-500">{profile?.email}</p>
                </div>
              </div>
            </div>

            <nav className="space-y-2 p-3">
              {studentLinks.map((link) => {
                const isActive = location.pathname.startsWith(link.to)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>{link.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black">{link.label}</span>
                      <span className={`block text-[11px] font-medium ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                        {link.description}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </nav>

            <div className="border-t border-slate-100 p-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => void signOut()}
                className="h-12 w-full rounded-2xl border-slate-200 font-bold text-slate-600 hover:text-slate-900"
              >
                Sair da Conta
              </Button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <section className="rounded-[34px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <Outlet />
          </section>
          <PlatformFooter className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm" compact />
        </div>
      </div>
    </main>
  )
}
