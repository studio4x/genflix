import { Link, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { PlatformFooter } from '@/components/layout/platform-footer'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { Button } from '@/components/ui/button'

const studentLinks = [
  {
    to: '/aluno/dashboard',
    label: 'Início',
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
    description: 'Dados e segurança',
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
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <header className="sticky top-0 z-40 border-b border-[#D8E6EB] bg-[#F2F7F9]/95 backdrop-blur-md">
        <div className="px-4 py-3 sm:px-6 lg:px-8">
          <div className="relative flex min-h-[68px] items-center justify-between gap-4">
            <Link to="/aluno/dashboard" className="flex min-w-0 items-center gap-4">
              <GenflixLogo />
              <p className="hidden rounded-full border border-[#D8E6EB] bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#1398B7] sm:block">
                Área do aluno
              </p>
            </Link>

            <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
              <p className="whitespace-nowrap text-sm font-extrabold uppercase tracking-[0.28em] text-[#5F7077]">
                Meu aprendizado
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/aluno/minha-conta"
                className={`hidden items-center gap-3 rounded-full border px-2 py-1.5 shadow-sm transition-colors md:flex ${
                  location.pathname.startsWith('/aluno/minha-conta')
                    ? 'border-[#1398B7]/30 bg-[#E8F6FA]'
                    : 'border-[#D8E6EB] bg-white hover:border-[#1398B7]/40'
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1398B7] to-[#0A3640] text-sm font-black text-white shadow-sm">
                  {firstName.slice(0, 2).toUpperCase()}
                </div>
                <div className="pr-2">
                  <p className="text-sm font-black text-[#163138]">{displayName}</p>
                  <p className="text-[11px] font-medium text-[#5F7077]">Minha conta</p>
                </div>
              </Link>
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

          <div className="mt-2 flex items-center justify-center md:hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#5F7077]">Área do aluno</p>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="self-start lg:sticky lg:top-[120px]">
          <div className="overflow-hidden rounded-[30px] border border-[#D8E6EB] bg-white shadow-[0_20px_50px_rgba(22,49,56,0.05)]">
            <div className="border-b border-[#D8E6EB] p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#1398B7] to-[#0A3640] text-base font-black text-white shadow-sm">
                  {firstName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-black tracking-tight text-[#163138]">{displayName}</p>
                  <p className="mt-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#1398B7]">Aluno</p>
                  <p className="mt-2 truncate text-sm font-medium text-[#6d7f84]">{profile?.email}</p>
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
                        ? 'bg-[#1398B7] text-white shadow-lg shadow-[#1398B7]/20'
                        : 'text-[#5f7077] hover:bg-[#F2F7F9] hover:text-[#163138]'
                    }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-[#8BA0A7]'}>{link.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black">{link.label}</span>
                      <span className={`block text-[11px] font-medium ${isActive ? 'text-white/78' : 'text-[#5F7077]'}`}>
                        {link.description}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </nav>

            <div className="border-t border-[#D8E6EB] p-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => void signOut()}
                className="h-12 w-full rounded-2xl border-[#D8E6EB] font-bold text-[#5f7077] hover:border-[#1398B7]/40 hover:text-[#163138]"
              >
                Sair da conta
              </Button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <section className="rounded-[34px] border border-[#D8E6EB] bg-white p-5 shadow-[0_20px_50px_rgba(22,49,56,0.04)] sm:p-7">
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
