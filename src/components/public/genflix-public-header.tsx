import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { getDashboardPathForRoles } from '@/features/auth/dashboard-path'
import type { GenflixNavLink, GenflixPageKey } from '@/features/public/genflix-site-content'
import { EditableList, EditableText, isEditableItemVisible, useEditableValue } from '@/features/site-editor/visual-editor'
import { cn } from '@/lib/utils'

function HeaderNavLink({
  item,
  isActive,
  className,
}: {
  item: GenflixNavLink
  isActive: boolean
  className?: string
}) {
  const classes = cn(
    'relative text-[13px] font-semibold tracking-[-0.01em] transition-colors',
    isActive ? 'text-white' : 'text-white/78 hover:text-white',
    className,
  )

  if (item.isInternal) {
    return (
      <Link to={item.href} className={classes}>
        {item.label}
      </Link>
    )
  }

  return (
    <a href={item.href} className={classes}>
      {item.label}
    </a>
  )
}

export function GenflixPublicHeader({
  currentPage,
  navLinks,
}: {
  currentPage?: GenflixPageKey
  navLinks: GenflixNavLink[]
}) {
  const { pathname } = useLocation()
  const { user, roles } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const ctaPath = user ? getDashboardPathForRoles(roles) : '/login'
  const ctaLabel = useEditableValue(
    user ? 'global.header.cta.authenticated.label' : 'global.header.cta.anonymous.label',
    user ? 'Acessar painel' : 'Entrar',
    { pageKey: 'global' },
  )
  const editableNavLinks = useEditableValue(
    'global.header.navLinks',
    navLinks.map((item) => ({
      id: item.pageKey ?? item.href,
      label: item.label,
      href: item.href,
      metadata: {
        isInternal: item.isInternal ?? false,
        pageKey: item.pageKey ?? null,
        requiresAuth: item.requiresAuth ?? false,
      },
    })),
    { pageKey: 'global' },
  )
  const visibleNavLinks = editableNavLinks.filter((item) => isEditableItemVisible(item) && (item.metadata?.requiresAuth !== true || user))

  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  return (
    <header className="relative">
      <div className="flex min-h-[72px] items-center justify-between gap-4 py-4">
        <Link to="/" aria-label="Ir para a home da GenFlix" className="shrink-0">
          <GenflixLogo theme="light" className="scale-[0.94] origin-left sm:scale-100" />
        </Link>

        <nav className="hidden items-center gap-6 xl:flex">
          <EditableList entryKey="global.header.navLinks" fallback={visibleNavLinks} label="Menu principal" pageKey="global">
            {(items) => items.filter(isEditableItemVisible).map((item) => {
              const navItem = {
                label: item.label ?? '',
                href: item.href ?? '#',
                isInternal: item.metadata?.isInternal === true,
                pageKey: typeof item.metadata?.pageKey === 'string' ? item.metadata.pageKey as GenflixPageKey : undefined,
                requiresAuth: item.metadata?.requiresAuth === true,
              }

              if (navItem.requiresAuth && !user) {
                return null
              }

              return (
                <HeaderNavLink
                  key={`${navItem.label}-${navItem.href}`}
                  item={navItem}
                  isActive={navItem.pageKey === currentPage}
                />
              )
            })}
          </EditableList>
        </nav>

        <div className="flex items-center gap-3">
          <GenflixCtaButton asChild className="hidden min-h-[44px] px-4 text-[13px] sm:inline-flex">
            <Link to={ctaPath}>
              <EditableText
                entryKey={user ? 'global.header.cta.authenticated.label' : 'global.header.cta.anonymous.label'}
                fallback={ctaLabel}
                label="Botão do cabeçalho"
                pageKey="global"
              />
            </Link>
          </GenflixCtaButton>

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/16 xl:hidden"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-[20px] border border-white/12 bg-[#0D4651]/96 p-4 shadow-[0_28px_56px_rgba(6,27,33,0.26)] backdrop-blur-xl xl:hidden">
          <nav className="flex flex-col gap-1">
            <EditableList entryKey="global.header.navLinks" fallback={visibleNavLinks} label="Menu principal mobile" pageKey="global">
              {(items) => items.filter(isEditableItemVisible).map((item) => {
                const navItem = {
                  label: item.label ?? '',
                  href: item.href ?? '#',
                  isInternal: item.metadata?.isInternal === true,
                  pageKey: typeof item.metadata?.pageKey === 'string' ? item.metadata.pageKey as GenflixPageKey : undefined,
                  requiresAuth: item.metadata?.requiresAuth === true,
                }

                if (navItem.requiresAuth && !user) {
                  return null
                }

                return (
                  <HeaderNavLink
                    key={`mobile-${navItem.label}-${navItem.href}`}
                    item={navItem}
                    isActive={navItem.pageKey === currentPage}
                    className="rounded-[14px] px-3 py-3 text-sm"
                  />
                )
              })}
            </EditableList>
          </nav>

          <div className="mt-4 border-t border-white/10 pt-4 sm:hidden">
            <GenflixCtaButton asChild className="min-h-[46px] w-full justify-between">
              <Link to={ctaPath}>
                <EditableText
                  entryKey={user ? 'global.header.cta.authenticated.label' : 'global.header.cta.anonymous.label'}
                  fallback={ctaLabel}
                  label="Botão do cabeçalho mobile"
                  pageKey="global"
                />
              </Link>
            </GenflixCtaButton>
          </div>
        </div>
      ) : null}
    </header>
  )
}
