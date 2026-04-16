import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import genflixWordmarkUrl from '@/assets/genflix-wordmark.svg'
import { PlatformFooter } from '@/components/layout/platform-footer'
import { Button } from '@/components/ui/button'

interface AuthShellProps {
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f5f9ff_72%,#f7f9fc_100%)]">
        <div className="absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-cyan-100/60 blur-3xl" />
        <div className="absolute -right-16 top-16 h-56 w-56 rounded-full bg-blue-100/70 blur-3xl" />

        <div className="relative mx-auto flex min-h-screen max-w-[1380px] flex-col px-6 pb-8 pt-5 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-6 border-b border-slate-200/80 pb-5">
            <Link to="/" className="shrink-0">
              <img
                src={genflixWordmarkUrl}
                alt="GenFlix"
                className="h-16 w-auto rounded-2xl object-contain sm:h-20"
              />
            </Link>

            <nav className="hidden items-center gap-9 text-[15px] font-medium text-slate-700 lg:flex">
              {[
                { label: 'Início', href: '/#inicio' },
                { label: 'Como Funciona', href: '/#como-funciona' },
                { label: 'Cursos', href: '/#cursos' },
                { label: 'Acesso', href: '/#acesso' },
              ].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="transition-colors hover:text-[#1473ff]"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <Button
                asChild
                variant="outline"
                className="hidden rounded-2xl border-slate-200 bg-white px-5 font-bold text-slate-700 shadow-sm hover:bg-slate-50 md:inline-flex"
              >
                <Link to="/">Ver Cursos</Link>
              </Button>
              <Button
                asChild
                className="rounded-2xl bg-[#1473ff] px-5 font-bold text-white shadow-[0_12px_30px_rgba(20,115,255,0.22)] hover:bg-[#1067e6]"
              >
                <Link to="/login">Entrar</Link>
              </Button>
            </div>
          </header>

          <div className="flex flex-1 items-center justify-center py-12 sm:py-16">
            <section className="w-full max-w-[540px] rounded-[34px] border border-slate-200 bg-white/95 p-7 shadow-[0_32px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10">
              <div className="flex justify-center">
                <img
                  src={genflixWordmarkUrl}
                  alt="GenFlix"
                  className="h-24 w-auto object-contain sm:h-28"
                />
              </div>

              <div className="mt-6 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-blue-600">
                  Plataforma de Cursos
                </p>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900 sm:text-[3rem]">
                  {title}
                </h1>
                <p className="mt-4 text-base font-medium leading-8 text-slate-500">
                  {subtitle}
                </p>
              </div>

              <div className="mt-8">{children}</div>
            </section>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/90 px-6 py-6 shadow-sm">
            <PlatformFooter compact />
          </div>
        </div>
      </section>
    </main>
  )
}
