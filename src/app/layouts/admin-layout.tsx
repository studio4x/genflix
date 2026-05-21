import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCcw, Trash2 } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { PlatformFooter } from '@/components/layout/platform-footer'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { Button } from '@/components/ui/button'
import { clearBrowserCache, clearServerCache } from '@/features/admin/cache/api'
import { NotificationCenter } from '@/features/notifications/notification-center'

type AdminNavItem = {
  to: string
  label: string
}

type AdminNavGroup = {
  key: string
  label: string
  description: string
  links: AdminNavItem[]
}

const adminNavGroups: AdminNavGroup[] = [
  {
    key: 'overview',
    label: 'Visao Geral',
    description: 'Painel executivo e acompanhamento operacional.',
    links: [
      { to: '/admin', label: 'Dashboard' },
      { to: '/admin/relatorios', label: 'Relatorios' },
      { to: '/admin/pendencias', label: 'Pendencias' },
      { to: '/admin/storage-r2', label: 'Storage R2' },
    ],
  },
  {
    key: 'content',
    label: 'Conteudo',
    description: 'Catalogo, experiencia publica e edicao da plataforma.',
    links: [
      { to: '/admin/cursos', label: 'Catalogo de Cursos' },
      { to: '/admin/blog', label: 'Blog' },
      { to: '/admin/botoes-aula', label: 'Botoes de Aula' },
      { to: '/admin/banners', label: 'Banners' },
      { to: '/admin/site-editor', label: 'Editor Visual' },
      { to: '/admin/recursos', label: 'Recursos' },
      { to: '/admin/formularios', label: 'Formularios' },
      { to: '/admin/tipos-quiz', label: 'Tipos de Quiz' },
    ],
  },
  {
    key: 'community',
    label: 'Relacionamento',
    description: 'Pessoas, mensagens, reputacao e atendimento.',
    links: [
      { to: '/admin/usuarios', label: 'Usuarios' },
      { to: '/admin/grupos', label: 'Grupos' },
      { to: '/admin/notificacoes', label: 'Notificacoes' },
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
    description: 'Configuracoes de apoio e administracao da conta.',
    links: [
      { to: '/admin/minha-conta', label: 'Minha Conta' },
      { to: '/admin/configuracoes-site', label: 'Configuracoes do Site' },
    ],
  },
]

function isLinkActive(pathname: string, linkTo: string) {
  return pathname === linkTo || (linkTo !== '/admin' && pathname.startsWith(linkTo))
}

export function AdminLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [isClearingServerCache, setIsClearingServerCache] = useState(false)
  const [isClearingBrowserCache, setIsClearingBrowserCache] = useState(false)
  const [cacheStatusMessage, setCacheStatusMessage] = useState<string | null>(null)

  const activeGroupKey = useMemo(() => {
    return adminNavGroups.find((group) => group.links.some((link) => isLinkActive(location.pathname, link.to)))?.key ?? adminNavGroups[0].key
  }, [location.pathname])

  const [expandedGroups, setExpandedGroups] = useState<string[]>([activeGroupKey])

  useEffect(() => {
    setExpandedGroups((current) => current.includes(activeGroupKey) ? current : [...current, activeGroupKey])
  }, [activeGroupKey])

  function toggleGroup(groupKey: string) {
    setExpandedGroups((current) => current.includes(groupKey)
      ? current.filter((entry) => entry !== groupKey)
      : [...current, groupKey])
  }

  async function handleClearServerCache() {
    const shouldProceed = window.confirm('Limpar cache do servidor agora? Isso pode afetar usuarios conectados por alguns segundos.')
    if (!shouldProceed) {
      return
    }

    setIsClearingServerCache(true)
    setCacheStatusMessage(null)
    try {
      await clearServerCache()
      setCacheStatusMessage('Cache do servidor limpo com sucesso.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao limpar cache do servidor.'
      setCacheStatusMessage(message)
    } finally {
      setIsClearingServerCache(false)
    }
  }

  async function handleClearBrowserCache() {
    const shouldProceed = window.confirm('Limpar cache deste navegador e recarregar o painel?')
    if (!shouldProceed) {
      return
    }

    setIsClearingBrowserCache(true)
    setCacheStatusMessage(null)
    try {
      await clearBrowserCache()
      window.location.reload()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao limpar cache do navegador.'
      setCacheStatusMessage(message)
      setIsClearingBrowserCache(false)
    }
  }

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
            <div className="hidden items-center gap-2 xl:flex">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleClearServerCache()}
                disabled={isClearingServerCache || isClearingBrowserCache}
                className="rounded-xl border-[#D8E6EB] bg-white font-bold text-[#5f7077] hover:border-[#1398B7]/40 hover:text-[#163138]"
                title="Limpar cache do servidor"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {isClearingServerCache ? 'Limpando servidor...' : 'Cache servidor'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleClearBrowserCache()}
                disabled={isClearingServerCache || isClearingBrowserCache}
                className="rounded-xl border-[#D8E6EB] bg-white font-bold text-[#5f7077] hover:border-[#1398B7]/40 hover:text-[#163138]"
                title="Limpar cache do navegador"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isClearingBrowserCache ? 'Limpando navegador...' : 'Cache navegador'}
              </Button>
            </div>
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
        {cacheStatusMessage ? (
          <div className="px-4 pb-3 sm:px-6 lg:px-8">
            <p className="rounded-xl border border-[#D8E6EB] bg-white px-3 py-2 text-xs font-semibold text-[#5F7077]">
              {cacheStatusMessage}
            </p>
          </div>
        ) : null}
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
                const isExpanded = expandedGroups.includes(group.key)
                const hasActiveLink = group.links.some((link) => isLinkActive(location.pathname, link.to))

                return (
                  <section
                    key={group.key}
                    className={`overflow-hidden rounded-[24px] border transition-colors ${
                      hasActiveLink ? 'border-[#BEE3EA] bg-[#F8FBFC]' : 'border-[#D8E6EB] bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                    >
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1398B7]">{group.label}</p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-[#5F7077]">{group.description}</p>
                      </div>
                      <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D8E6EB] bg-white text-[#5F7077]">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="grid gap-2 border-t border-[#D8E6EB] px-3 py-3">
                        {group.links.map((link) => {
                          const isActive = isLinkActive(location.pathname, link.to)

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
                      </div>
                    ) : null}
                  </section>
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
