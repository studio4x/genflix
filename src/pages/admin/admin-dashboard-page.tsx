import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
export function AdminDashboardPage() {
    const { profile } = useAuth();
    return (<div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Visão Geral</h2>
        <p className="text-base text-slate-500">
          Olá, {profile?.full_name?.split(' ')[0] ?? profile?.email?.split('@')[0] ?? 'Admin'}. Acompanhe os principais indicadores da plataforma.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col justify-between rounded-2xl border border-blue-100 bg-blue-50/50 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-600/80">Gestão de Conteúdo</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-6">Acesse e gerencie todos os cursos, módulos e aulas disponíveis.</p>
          <Button className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm" asChild>
            <Link to="/admin/cursos">Ir para Cursos</Link>
          </Button>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-sky-100 bg-sky-50/50 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-sky-700/80">Tipos Globais</p>
            </div>
          </div>
          <p className="mb-6 text-sm text-slate-600">Ative ou desative os formatos de quiz que poderão existir em qualquer curso.</p>
          <Button variant="outline" className="w-full border-sky-200 text-sky-800 hover:bg-sky-100 hover:text-sky-900 shadow-sm" asChild>
            <Link to="/admin/tipos-quiz">Acessar Tipos de Quiz</Link>
          </Button>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Alunos e Grupos</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-6">Gerencie o acesso, permissões e cadastro de novos usuários.</p>
          <div className="flex gap-3">
             <Button variant="outline" className="flex-1 shadow-sm" asChild>
              <Link to="/admin/usu?rios">Usuários</Link>
            </Button>
            <Button variant="outline" className="flex-1 shadow-sm" asChild>
              <Link to="/admin/grupos">Grupos</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700/80">Relatórios & BI</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-6">Monitore conclusão e performance dos alunos e turmas.</p>
          <Button variant="outline" className="w-full border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 shadow-sm" asChild>
            <Link to="/admin/relatorios">Acessar Relatórios</Link>
          </Button>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-cyan-100 bg-cyan-50/60 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-cyan-700/80">Pagamento</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-6">Acompanhe o gateway Asaas, o ambiente ativo e a URL do webhook.</p>
          <Button variant="outline" className="w-full border-cyan-200 text-cyan-800 hover:bg-cyan-100 hover:text-cyan-900 shadow-sm" asChild>
            <Link to="/admin/pagamento">Abrir Configurações</Link>
          </Button>
        </div>
      </div>
    </div>);
}
