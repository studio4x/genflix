import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, ChevronRight, ChevronDownSquare, Maximize2, Minimize2, RefreshCcw, Sparkles, Trash2, X } from 'lucide-react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { PlatformFooter } from '@/components/layout/platform-footer';
import { GenflixLogo } from '@/components/public/genflix-logo';
import { Button } from '@/components/ui/button';
import { clearBrowserCache, clearServerCache } from '@/features/admin/cache/api';
import { AdminTutorialsProvider, useAdminTutorials } from '@/features/admin/tutorials/admin-tutorials';
import { NotificationCenter } from '@/features/notifications/notification-center';
type AdminNavItem = {
    to: string;
    label: string;
};
type AdminNavGroup = {
    key: string;
    label: string;
    description: string;
    links: AdminNavItem[];
};
const adminNavGroups: AdminNavGroup[] = [
    {
        key: 'overview',
        label: 'Visão Geral',
        description: 'Painel executivo e acompanhamento operacional.',
        links: [
            { to: '/admin', label: 'Dashboard' },
            { to: '/admin/relatorios', label: 'Relatórios' },
            { to: '/admin/pendencias', label: 'Pendências' },
            { to: '/admin/storage-r2', label: 'Storage R2' },
            { to: '/admin/seguranca', label: 'Segurança' },
        ],
    },
    {
        key: 'content',
        label: "Conteúdo",
        description: "Catálogo, experiência pública e edição da plataforma.",
        links: [
            { to: '/admin/cursos', label: 'Catálogo de Cursos' },
            { to: '/admin/blog', label: 'Blog' },
            { to: '/admin/botoes-aula', label: 'Botões de Aula' },
            { to: '/admin/banners', label: 'Banners' },
            { to: '/admin/site-editor', label: 'Editor Visual' },
            { to: '/admin/recursos', label: 'Recursos' },
            { to: '/admin/formularios', label: 'Formulários' },
            { to: '/admin/tipos-quiz', label: 'Tipos de Quiz' },
        ],
    },
    {
        key: 'community',
        label: 'Relacionamento',
        description: 'Pessoas, mensagens, reputação e atendimento.',
        links: [
            { to: "/admin/usuarios", label: "Usuários" },
            { to: '/admin/grupos', label: 'Grupos' },
            { to: '/admin/notificacoes', label: "Notificações" },
            { to: '/admin/mensagens', label: 'Mensagens' },
            { to: '/admin/suporte', label: 'Tickets' },
            { to: '/admin/faq', label: 'FAQ/Ajuda' },
            { to: '/admin/reviews', label: 'Reviews' },
        ],
    },
    {
        key: 'finance',
        label: 'Financeiro',
        description: 'Recebimentos, repasses e parametros de monetizacao.',
        links: [
            { to: '/admin/pagamentos', label: 'Pagamentos' },
            { to: '/admin/repasses', label: 'Repasses PIX' },
        ],
    },
    {
        key: 'system',
        label: 'Plataforma',
        description: "Configurações de apoio e administração da conta.",
        links: [
            { to: '/admin/minha-conta', label: 'Minha Conta' },
            { to: '/admin/tutoriais', label: 'Tutoriais' },
            { to: '/admin/configuracoes-site', label: "Configurações do Site" },
        ],
    },
];
function isLinkActive(pathname: string, linkTo: string) {
    return pathname === linkTo || (linkTo !== '/admin' && pathname.startsWith(linkTo));
}
export function AdminLayout() {
    const { profile, signOut } = useAuth();
    const location = useLocation();
    const [isClearingServerCache, setIsClearingServerCache] = useState(false);
    const [isClearingBrowserCache, setIsClearingBrowserCache] = useState(false);
    const [cacheStatusMessage, setCacheStatusMessage] = useState<string | null>(null);
    const activeGroupKey = useMemo(() => {
        return adminNavGroups.find((group) => group.links.some((link) => isLinkActive(location.pathname, link.to)))?.key ?? adminNavGroups[0].key;
    }, [location.pathname]);
    const [expandedGroups, setExpandedGroups] = useState<string[]>([activeGroupKey]);
    useEffect(() => {
        setExpandedGroups((current) => current.includes(activeGroupKey) ? current : [...current, activeGroupKey]);
    }, [activeGroupKey]);
    function toggleGroup(groupKey: string) {
        setExpandedGroups((current) => current.includes(groupKey)
            ? current.filter((entry) => entry !== groupKey)
            : [...current, groupKey]);
    }
    async function handleClearServerCache() {
        const shouldProceed = window.confirm("Esta ação vai:\n- Acionar limpeza de cache no servidor\n- Recarregar configurações do PostgREST (schema/config)\n- Refletir alterações recentes de dados/config mais rápido\n- Não encerrar seu login no navegador\n\nDeseja continuar");
        if (!shouldProceed) {
            return;
        }
        setIsClearingServerCache(true);
        setCacheStatusMessage(null);
        try {
            await clearServerCache();
            setCacheStatusMessage('Cache do servidor limpo com sucesso.');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao limpar cache do servidor.';
            setCacheStatusMessage(message);
        }
        finally {
            setIsClearingServerCache(false);
        }
    }
    async function handleClearBrowserCache(preserveLogin: boolean) {
        const shouldProceed = window.confirm(preserveLogin
            ? "Esta ação vai:\n- Limpar cache do navegador (arquivos, caches e IndexedDB)\n- Limpar dados locais temporários do painel\n- Preservar sua sessão de login atual\n- Recarregar a página ao final\n\nDeseja continuar" : "Esta ação vai:\n- Limpar cache do navegador (arquivos, caches e IndexedDB)\n- Limpar localStorage e sessionStorage completos\n- Encerrar sua sessão atual (logout)\n- Recarregar a página ao final\n\nDeseja continuar");
        if (!shouldProceed) {
            return;
        }
        setIsClearingBrowserCache(true);
        setCacheStatusMessage(null);
        try {
            await clearBrowserCache({ preserveLogin });
            window.location.reload();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Falha ao limpar cache do navegador.';
            setCacheStatusMessage(message);
            setIsClearingBrowserCache(false);
        }
    }
    return (<AdminTutorialsProvider>
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
            <div className="hidden items-center gap-2 xl:flex">
              <Button type="button" variant="outline" size="sm" onClick={() => void handleClearServerCache()} disabled={isClearingServerCache || isClearingBrowserCache} className="rounded-xl border-[#D8E6EB] bg-white font-bold text-[#5f7077] hover:border-[#1398B7]/40 hover:text-[#163138]" title="Limpar cache do servidor">
                <RefreshCcw className="h-3.5 w-3.5"/>
                {isClearingServerCache ? 'Limpando servidor...' : 'Cache servidor'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleClearBrowserCache(true)} disabled={isClearingServerCache || isClearingBrowserCache} className="rounded-xl border-[#D8E6EB] bg-white font-bold text-[#5f7077] hover:border-[#1398B7]/40 hover:text-[#163138]" title="Limpar cache do navegador mantendo login">
                <Trash2 className="h-3.5 w-3.5"/>
                {isClearingBrowserCache ? 'Limpando navegador...' : 'Cache navegador (manter login)'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleClearBrowserCache(false)} disabled={isClearingServerCache || isClearingBrowserCache} className="rounded-xl border-[#D8E6EB] bg-white font-bold text-[#5f7077] hover:border-[#1398B7]/40 hover:text-[#163138]" title="Limpar cache do navegador e deslogar">
                <Trash2 className="h-3.5 w-3.5"/>
                {isClearingBrowserCache ? 'Limpando completo...' : 'Cache completo'}
              </Button>
            </div>
            <NotificationCenter compact/>
            <div className="hidden items-center gap-3 rounded-full border border-[#D8E6EB] bg-white px-2 py-1.5 shadow-sm md:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8F6FA] text-xs font-black text-[#1398B7]">
                {profile?.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="pr-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Conta</p>
                <p className="max-w-[220px] truncate text-sm font-semibold text-[#163138]">{profile?.email}</p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void signOut()} className="rounded-xl border-[#D8E6EB] bg-white font-bold text-[#5f7077] hover:border-[#1398B7]/40 hover:text-[#163138]">
              Sair
            </Button>
          </div>
        </div>
        {cacheStatusMessage ? (<div className="px-4 pb-3 sm:px-6 lg:px-8">
            <p className="rounded-xl border border-[#D8E6EB] bg-white px-3 py-2 text-xs font-semibold text-[#5F7077]">
              {cacheStatusMessage}
            </p>
          </div>) : null}
      </header>

      <div className="grid min-h-[calc(100vh-73px)] grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="self-start lg:sticky lg:top-[92px]">
          <div className="overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white shadow-[0_20px_50px_rgba(22,49,56,0.05)]">
            <div className="border-b border-[#D8E6EB] px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Navegacao</p>
              <h2 className="mt-1 font-readex text-lg font-semibold tracking-tight text-[#15323b]">Admin</h2>
            </div>
            <nav className="space-y-3 p-3">
              {adminNavGroups.map((group) => {
            const isExpanded = expandedGroups.includes(group.key);
            const hasActiveLink = group.links.some((link) => isLinkActive(location.pathname, link.to));
            return (<section key={group.key} className={`overflow-hidden rounded-[24px] border transition-colors ${hasActiveLink ? 'border-[#BEE3EA] bg-[#F8FBFC]' : 'border-[#D8E6EB] bg-white'}`}>
                    <button type="button" onClick={() => toggleGroup(group.key)} className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">{group.label}</p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-[#5F7077]">{group.description}</p>
                      </div>
                      <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D8E6EB] bg-white text-[#5F7077]">
                        {isExpanded ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
                      </span>
                    </button>

                    {isExpanded ? (<div className="grid gap-2 border-t border-[#D8E6EB] px-3 py-3">
                        {group.links.map((link) => {
                        const isActive = isLinkActive(location.pathname, link.to);
                        return (<Link key={link.to} to={link.to} className={`flex items-center rounded-2xl px-4 py-3 text-sm font-bold transition-all ${isActive
                                ? 'bg-[#1398B7] text-white shadow-lg shadow-[#1398B7]/20'
                                : 'text-[#5f7077] hover:bg-[#F2F7F9] hover:text-[#163138]'}`}>
                              {link.label}
                            </Link>);
                    })}
                      </div>) : null}
                  </section>);
        })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <section className="rounded-[32px] border border-[#D8E6EB] bg-white p-5 shadow-[0_20px_50px_rgba(22,49,56,0.04)] sm:p-7">
            <Outlet />
          </section>
          <PlatformFooter className="rounded-[28px] border border-[#D8E6EB] bg-white px-5 py-5 shadow-sm" linksClassName="text-[#5F7077]" versionClassName="text-[#5F7077]" compact/>
        </div>
      </div>
      <AdminTutorialsFloatingPanel />
    </main>
    </AdminTutorialsProvider>);
}

function AdminTutorialsFloatingPanel() {
  const {
    tutorials,
    activeTutorial,
    activeTutorialId,
    isDrawerOpen,
    isDrawerMinimized,
    openTutorial,
    closeDrawer,
    minimizeDrawer,
    restoreDrawer,
    selectTutorial,
  } = useAdminTutorials();

  const showDrawer = isDrawerOpen && !isDrawerMinimized;
  const showMinimized = isDrawerMinimized;

  return (
    <>
      {showDrawer ? (
        <div className="fixed inset-0 z-[90] bg-slate-950/20 backdrop-blur-[1px]" onClick={closeDrawer} aria-hidden="true" />
      ) : null}

      {showDrawer ? (
        <aside className="fixed right-4 top-4 z-[100] flex h-[calc(100vh-2rem)] w-[min(92vw,460px)] flex-col overflow-hidden rounded-[32px] border border-[#BEE3EA] bg-white shadow-[0_30px_90px_rgba(10,54,64,0.24)]">
          <div className="flex items-start justify-between gap-4 border-b border-[#D8E6EB] bg-[linear-gradient(145deg,#0A3640_0%,#0E677C_55%,#1398B7_100%)] px-5 py-4 text-white">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/80">
                <BookOpen className="h-3.5 w-3.5" />
                Tutorial admin
              </div>
              <h2 className="mt-3 font-readex text-xl font-semibold tracking-tight">{activeTutorial.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/82">{activeTutorial.summary}</p>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => minimizeDrawer()} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20" aria-label="Minimizar tutorial">
                <Minimize2 className="h-4 w-4" />
              </button>
              <button type="button" onClick={closeDrawer} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20" aria-label="Fechar tutorial">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-5">
              <section className="rounded-[28px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Tutoriais disponíveis</p>
                    <h3 className="mt-1 text-sm font-black tracking-tight text-[#15323b]">Escolha um tutorial para ler</h3>
                  </div>
                  <span className="rounded-full border border-[#D8E6EB] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                    {tutorials.length} itens
                  </span>
                </div>

                <div className="mt-4 rounded-[22px] border border-[#D8E6EB] bg-white p-3 shadow-sm">
                  <label className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                      <ChevronDownSquare className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Selecionar tutorial</p>
                      <select
                        value={activeTutorialId}
                        onChange={(event) => selectTutorial(event.target.value)}
                        className="mt-2 h-11 w-full rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] px-4 text-sm font-semibold text-[#15323b] outline-none transition focus:border-[#1398B7]"
                      >
                        {tutorials.map((tutorial) => (
                          <option key={tutorial.id} value={tutorial.id}>
                            {tutorial.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>
              </section>

              <section className="rounded-[28px] border border-[#D8E6EB] bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Tutorial ativo</p>
                <h3 className="mt-2 font-readex text-xl font-semibold tracking-tight text-[#15323b]">{activeTutorial.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5F7077]">{activeTutorial.summary}</p>

                <div className="mt-5 space-y-4">
                  {activeTutorial.steps.map((step, index) => (
                    <div key={`${activeTutorial.id}-${step.title}`} className="rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1398B7] text-xs font-black text-white">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="text-sm font-black tracking-tight text-[#15323b]">{step.title}</h4>
                          <p className="mt-1 text-sm leading-6 text-[#5F7077]">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[24px] border border-[#BEE3EA] bg-[#F2FBFD] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0E677C]">Dicas rápidas</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[#155160]">
                    {activeTutorial.notes.map((note) => (
                      <li key={note} className="flex gap-2">
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#1398B7]" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="rounded-[28px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Tutoriais disponíveis</p>
                    <h3 className="mt-1 text-sm font-black tracking-tight text-[#15323b]">Troque de guia a qualquer momento</h3>
                  </div>
                  <span className="rounded-full border border-[#D8E6EB] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                    {tutorials.length} itens
                  </span>
                </div>

                <div className="mt-4 rounded-[22px] border border-[#D8E6EB] bg-white p-3 shadow-sm">
                  <label className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                      <ChevronDownSquare className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Selecionar tutorial</p>
                      <select
                        value={activeTutorialId}
                        onChange={(event) => selectTutorial(event.target.value)}
                        className="mt-2 h-11 w-full rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] px-4 text-sm font-semibold text-[#15323b] outline-none transition focus:border-[#1398B7]"
                      >
                        {tutorials.map((tutorial) => (
                          <option key={`${tutorial.id}-footer`} value={tutorial.id}>
                            {tutorial.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>
              </section>
            </div>
          </div>

          <div className="border-t border-[#D8E6EB] bg-white px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link to="/admin/tutoriais" onClick={closeDrawer} className="inline-flex items-center gap-2 text-sm font-black text-[#1398B7] transition-colors hover:text-[#0E677C]">
                <Sparkles className="h-4 w-4" />
                Abrir página completa
              </Link>
              <Button type="button" onClick={() => minimizeDrawer()} className="h-10 rounded-2xl bg-[#1398B7] px-4 font-black text-white hover:bg-[#1089A5]">
                Minimizar painel
              </Button>
            </div>
          </div>
        </aside>
      ) : null}

      {showMinimized ? (
        <button
          type="button"
          onClick={restoreDrawer}
          className="fixed bottom-5 right-5 z-[100] inline-flex items-center gap-3 rounded-full border border-[#BEE3EA] bg-white px-4 py-3 text-left shadow-[0_20px_60px_rgba(10,54,64,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(10,54,64,0.24)]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(145deg,#0A3640_0%,#1398B7_100%)] text-white">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="pr-2">
            <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Tutoriais</span>
            <span className="block text-sm font-black text-[#15323b]">{activeTutorial.title}</span>
          </span>
          <Maximize2 className="h-4 w-4 text-[#1398B7]" />
        </button>
      ) : null}

      {!showDrawer && !showMinimized ? (
        <button
          type="button"
          onClick={() => openTutorial(activeTutorial.id)}
          className="fixed bottom-5 right-5 z-[100] inline-flex items-center gap-3 rounded-full border border-[#1398B7]/20 bg-[linear-gradient(145deg,#0A3640_0%,#0E677C_55%,#1398B7_100%)] px-4 py-3 text-left text-white shadow-[0_20px_60px_rgba(10,54,64,0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(10,54,64,0.28)]"
          aria-label="Abrir tutoriais do admin"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="pr-2">
            <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-white/75">Ajuda rápida</span>
            <span className="block text-sm font-black">{activeTutorial.title}</span>
          </span>
        </button>
      ) : null}
    </>
  );
}
