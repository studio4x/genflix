import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'

const MAIN_PLATFORM_URL = 'https://homecarematch.com.br'

export function StudentAccountPage() {
  const { profile } = useAuth()

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-slate-100 pb-8 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Minha Conta
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">Dados da conta</h2>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
              Esta área apenas exibe os dados sincronizados pela HomeCare Match. Alterações de cadastro e segurança são feitas na plataforma principal.
            </p>
          </div>
        </div>

        <a
          href={MAIN_PLATFORM_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#1473ff] px-5 text-sm font-black text-white shadow-[0_14px_35px_rgba(20,115,255,0.22)] transition hover:bg-[#1067e6]"
        >
          Abrir HomeCare Match
        </a>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Perfil sincronizado</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Informações pessoais</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">
              Somente leitura
            </span>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700">Nome completo</span>
              <div className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
                {profile?.full_name?.trim() || 'Nome não informado'}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700">E-mail</span>
              <div className="min-h-12 break-all rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800">
                {profile?.email ?? 'E-mail não informado'}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
            <p className="text-sm font-bold leading-7 text-blue-900">
              Nome, e-mail e credenciais são administrados pela plataforma principal da HomeCare Match. O LMS recebe esses dados pela integração e os utiliza apenas para liberar e registrar sua jornada de estudos.
            </p>
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Conta vinculada</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight">HomeCare Match principal</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">
              Para alterar cadastro, e-mail, dados de acesso ou preferências de conta, acesse a plataforma principal. Depois da atualização, os dados serão refletidos no LMS pela integração.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={MAIN_PLATFORM_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-black text-slate-900 transition-colors hover:bg-slate-100"
              >
                Ir para HomeCare Match
              </a>
              <Link
                to="/aluno/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 text-sm font-black text-white transition-colors hover:bg-white/15"
              >
                Voltar ao dashboard
              </Link>
            </div>
          </article>

          <article className="rounded-[32px] border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Senha e segurança</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Sem senha local no LMS</h3>
            <p className="mt-3 text-sm font-medium leading-7 text-slate-700">
              O acesso do aluno é feito por token seguro gerado na HomeCare Match. Por isso, esta plataforma não oferece troca de senha para usuários alunos.
            </p>
          </article>
        </div>
      </section>
    </div>
  )
}
