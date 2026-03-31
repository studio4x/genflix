import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import homeCareMatchHeroUrl from '@/assets/hero.png'
import homeCareMatchLogoUrl from '@/assets/homecare-match-logo.jpg'
import { useAuth } from '@/app/providers/auth-provider'
import { PlatformFooter } from '@/components/layout/platform-footer'
import { Button } from '@/components/ui/button'
import {
  fetchReleasedCourses,
  toErrorMessage,
} from '@/features/student/courses/api'
import type { Course } from '@/types/content'

function formatCourseWorkload(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours === 0) {
    return `${remainingMinutes} min`
  }

  if (remainingMinutes === 0) {
    return `${hours} h`
  }

  return `${hours} h ${remainingMinutes} min`
}

function sanitizeCourseDescription(description: string | null) {
  if (!description) {
    return 'Treinamento disponivel para fortalecer sua atuacao profissional dentro do ecossistema HomeCare Match.'
  }

  return description
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function PublicHomePage() {
  const { isLoading, user, roles } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(true)
  const [coursesError, setCoursesError] = useState<string | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadCourses() {
      setIsLoadingCourses(true)
      setCoursesError(null)
      try {
        const data = await fetchReleasedCourses()
        if (isMounted) {
          setCourses(data)
        }
      } catch (loadError) {
        if (isMounted) {
          setCoursesError(toErrorMessage(loadError))
        }
      } finally {
        if (isMounted) {
          setIsLoadingCourses(false)
        }
      }
    }

    void loadCourses()
    return () => {
      isMounted = false
    }
  }, [])

  const totalWorkload = useMemo(
    () => courses.reduce((sum, course) => sum + course.workload_minutes, 0),
    [courses],
  )

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f172a] p-6">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-white/70">Carregando plataforma...</p>
      </main>
    )
  }

  if (user && roles.includes('admin')) {
    return <Navigate to="/admin" replace />
  }

  if (user) {
    return <Navigate to="/aluno" replace />
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <section className="relative overflow-hidden bg-[#0f172a] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.28),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.18),_transparent_34%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />

        <div className="relative mx-auto max-w-[1380px] px-6 pb-20 pt-6 sm:px-8 lg:px-10">
          <header className="flex flex-col gap-4 rounded-[32px] border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <img
                src={homeCareMatchLogoUrl}
                alt="HomeCare Match"
                className="h-16 w-auto rounded-2xl object-contain sm:h-20"
              />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">HomeCare Match Academy</p>
                <p className="mt-2 text-sm font-medium text-white/70">
                  Capacitação exclusiva para profissionais cadastrados na plataforma HomeCare Match.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                variant="outline"
                className="rounded-2xl border-white/20 bg-white/5 px-5 py-6 font-black text-white hover:bg-white/10"
              >
                <a href="https://homecarematch.com.br" target="_blank" rel="noreferrer">
                  Conhecer a HomeCare Match
                </a>
              </Button>
              <Button
                asChild
                className="rounded-2xl bg-white px-5 py-6 font-black text-slate-900 hover:bg-slate-100"
              >
                <Link to="/login">Entrar na plataforma</Link>
              </Button>
            </div>
          </header>

          <div className="grid gap-10 pt-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200">
                Plataforma oficial de cursos da rede HomeCare Match
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl text-4xl font-black leading-[1.02] tracking-tight text-white md:text-6xl">
                  Formação contínua para profissionais que evoluem junto com o ecossistema HomeCare Match.
                </h1>
                <p className="max-w-2xl text-lg font-medium leading-relaxed text-white/72">
                  A HomeCare Match conecta profissionais da saúde, operações de home care e oportunidades reais de trabalho.
                  Esta plataforma Academy concentra os treinamentos, trilhas e avaliações destinados aos profissionais cadastrados na rede.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  className="h-14 rounded-2xl bg-cyan-400 px-8 text-base font-black text-slate-950 hover:bg-cyan-300"
                >
                  <Link to="/login">Acessar minha conta</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-14 rounded-2xl border-white/15 bg-white/5 px-8 text-base font-black text-white hover:bg-white/10"
                >
                  <a href="https://homecarematch.com.br" target="_blank" rel="noreferrer">
                    Quero me cadastrar na HomeCare Match
                  </a>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">Cursos publicados</p>
                  <p className="mt-3 text-3xl font-black text-white">{courses.length}</p>
                </article>
                <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">Carga somada</p>
                  <p className="mt-3 text-3xl font-black text-white">{formatCourseWorkload(totalWorkload)}</p>
                </article>
                <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">Acesso</p>
                  <p className="mt-3 text-base font-black uppercase tracking-[0.16em] text-white">Exclusivo para cadastrados</p>
                </article>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-[40px] bg-cyan-400/15 blur-3xl" />
              <div className="relative overflow-hidden rounded-[44px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))] p-6 shadow-2xl shadow-slate-950/20 backdrop-blur">
                <div className="rounded-[32px] border border-white/10 bg-[#111827] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-200">Como a Academy funciona</p>
                      <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
                        Conteúdo, acompanhamento e evolução em um só fluxo.
                      </h2>
                    </div>
                    <img
                      src={homeCareMatchHeroUrl}
                      alt=""
                      className="hidden h-36 w-auto object-contain md:block"
                    />
                  </div>

                  <div className="mt-8 space-y-4">
                    {[
                      {
                        title: '1. Cadastro e validação',
                        description: 'O profissional se cadastra na HomeCare Match e passa a integrar a base autorizada para receber cursos e trilhas.',
                      },
                      {
                        title: '2. Liberação dos treinamentos',
                        description: 'Os cursos publicados são liberados de acordo com a jornada profissional, grupos e critérios operacionais definidos pela plataforma.',
                      },
                      {
                        title: '3. Estudo, avaliação e registro',
                        description: 'Dentro da Academy, o profissional consome aulas, realiza avaliações, revisa anotações e acompanha seu progresso.',
                      },
                    ].map((item) => (
                      <article
                        key={item.title}
                        className="rounded-[24px] border border-white/8 bg-white/5 px-5 py-4"
                      >
                        <p className="text-sm font-black text-white">{item.title}</p>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-white/68">{item.description}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1380px] space-y-16 px-6 py-16 sm:px-8 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-blue-700">
              Contexto institucional
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              A Academy existe para apoiar a atuação prática do profissional dentro da HomeCare Match.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                title: 'Plataforma principal',
                description: 'A HomeCare Match conecta profissionais da saúde às melhores oportunidades em home care e organiza a relação com o ecossistema da assistência domiciliar.',
              },
              {
                title: 'Plataforma de cursos',
                description: 'A Academy concentra capacitação, padronização operacional, revisão técnica e atualização profissional para os usuários cadastrados.',
              },
              {
                title: 'Acesso controlado',
                description: 'Os cursos não são de acesso aberto. O conteúdo é direcionado aos profissionais que já fazem parte da rede HomeCare Match.',
              },
              {
                title: 'Aprendizado aplicável',
                description: 'O foco é transformar treinamento em prática: aulas, avaliações, progresso por trilha e materiais complementares dentro da rotina do profissional.',
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="text-base font-black tracking-tight text-slate-900">{item.title}</p>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Cursos disponíveis</h2>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <p className="max-w-3xl text-base font-medium leading-relaxed text-slate-500">
            Esta vitrine apresenta os cursos publicados na plataforma. Para acessar qualquer conteúdo, é necessário ser profissional cadastrado na HomeCare Match e possuir liberação adequada.
          </p>

          {coursesError ? (
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-sm font-bold text-rose-600">
              {coursesError}
            </div>
          ) : null}

          {isLoadingCourses ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-[360px] animate-pulse rounded-[32px] border border-slate-100 bg-white shadow-sm" />
              ))}
            </div>
          ) : null}

          {!isLoadingCourses && courses.length === 0 && !coursesError ? (
            <div className="rounded-[32px] border border-dashed border-slate-200 bg-white p-12 text-center">
              <p className="text-lg font-black tracking-tight text-slate-900">Nenhum curso publicado neste momento.</p>
              <p className="mt-3 text-sm font-medium text-slate-500">
                Quando novos treinamentos forem publicados, eles aparecerão aqui para consulta.
              </p>
            </div>
          ) : null}

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => setSelectedCourse(course)}
                className="group flex h-full flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#0f172a,#1e3a8a)]">
                      <span className="text-4xl font-black uppercase tracking-[0.28em] text-white/12">Academy</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent" />
                  <div className="absolute right-4 top-4 rounded-full border border-white/25 bg-slate-950/50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.26em] text-white backdrop-blur-sm">
                    {formatCourseWorkload(course.workload_minutes)}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100">
                      Disponível para profissionais cadastrados
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-7">
                  <h3 className="line-clamp-2 text-2xl font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-700">
                    {course.title}
                  </h3>
                  <p className="mt-4 line-clamp-3 text-sm font-medium leading-7 text-slate-600">
                    {sanitizeCourseDescription(course.description)}
                  </p>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      HomeCare Match Academy
                    </div>
                    <span className="text-sm font-black text-blue-700">
                      Ver condições de acesso
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[40px] bg-[linear-gradient(135deg,#0f172a,#111827)] p-8 text-white shadow-2xl shadow-slate-200 md:p-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-white/12 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">
                Quero acessar os cursos
              </div>
              <h2 className="text-3xl font-black tracking-tight md:text-4xl">
                O acesso à Academy é liberado para profissionais cadastrados na HomeCare Match.
              </h2>
              <p className="max-w-3xl text-base font-medium leading-8 text-white/72">
                Se você ainda não faz parte da plataforma principal, comece por lá. Depois do cadastro e da liberação adequada, os cursos poderão ser disponibilizados em sua jornada profissional.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button
                asChild
                className="h-14 rounded-2xl bg-cyan-400 px-8 font-black text-slate-950 hover:bg-cyan-300"
              >
                <a href="https://homecarematch.com.br" target="_blank" rel="noreferrer">
                  Ir para HomeCare Match
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-14 rounded-2xl border-white/12 bg-white/5 px-8 font-black text-white hover:bg-white/10"
              >
                <Link to="/login">Já tenho acesso</Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <PlatformFooter compact />
        </div>
      </section>

      {selectedCourse ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">Acesso restrito</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                  {selectedCourse.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCourse(null)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 transition-colors hover:text-slate-900"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-8">
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4">
                <p className="text-sm font-bold leading-7 text-amber-900">
                  Este curso está disponível somente para profissionais cadastrados na plataforma HomeCare Match.
                </p>
              </div>

              <p className="text-sm font-medium leading-7 text-slate-600">
                Para acessar os conteúdos da Academy, é necessário fazer parte da base de profissionais da HomeCare Match e possuir a liberação correspondente para a trilha de treinamento.
              </p>

              <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Próximo passo</p>
                <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
                  Se você ainda não tem cadastro, acesse a HomeCare Match para conhecer a plataforma principal e iniciar seu processo.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedCourse(null)}
                className="h-12 rounded-2xl border-slate-200 bg-white font-black text-slate-600"
              >
                Fechar
              </Button>
              <Button
                asChild
                className="h-12 rounded-2xl bg-slate-900 px-6 font-black text-white hover:bg-slate-800"
              >
                <a href="https://homecarematch.com.br" target="_blank" rel="noreferrer">
                  Ir para HomeCare Match
                </a>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
