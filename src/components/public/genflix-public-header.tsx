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
  variant,
}: {
  item: GenflixNavLink
  isActive: boolean
  className?: string
  variant: 'home' | 'light'
}) {
  const classes = cn(
    'relative text-[13px] font-semibold tracking-[-0.01em] transition-colors',
    variant === 'home'
      ? (isActive ? 'text-white' : 'text-white/78 hover:text-white')
      : (isActive ? 'text-[#15323B]' : 'text-[#15323B]/78 hover:text-[#15323B]'),
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
  const isHome = currentPage === 'home'
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
    <section
      className={cn(
        'border-b',
        isHome
          ? 'border-white/10 bg-[linear-gradient(90deg,#1C7082_0%,#0F5562_100%)] text-white'
          : 'border-[#D8E6EB] bg-[#F2F8FA] text-[#183139]',
      )}
    >
      <div className="public-site-container">
        <header className="relative">
          <div className="flex min-h-[72px] items-center justify-between gap-4 py-4">
            <Link to="/" aria-label="Ir para a home da GenFlix" className="shrink-0">
              <GenflixLogo theme={isHome ? 'light' : 'dark'} className="scale-[0.94] origin-left sm:scale-100" />
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
                      variant={isHome ? 'home' : 'light'}
                    />
                  )
                })}
              </EditableList>
            </nav>

            <div className="flex items-center gap-3">
              <GenflixCtaButton asChild tone={isHome ? 'solid' : 'surface'} className="hidden min-h-[44px] px-4 text-[13px] sm:inline-flex">
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
                className={cn(
                  'inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors backdrop-blur-sm xl:hidden',
                  isHome
                    ? 'border-white/18 bg-white/10 text-white hover:bg-white/16'
                    : 'border-[#D8E6EB] bg-white text-[#15323B] hover:bg-[#EBF3F5]',
                )}
                aria-expanded={isMenuOpen}
                aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {isMenuOpen ? (
            <div
              className={cn(
                'absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-[20px] p-4 backdrop-blur-xl xl:hidden',
                isHome
                  ? 'border border-white/12 bg-[#0D4651]/96 shadow-[0_28px_56px_rgba(6,27,33,0.26)]'
                  : 'border border-[#D8E6EB] bg-[#F2F8FA]/98 shadow-[0_28px_56px_rgba(21,50,59,0.12)]',
              )}
            >
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
                        variant={isHome ? 'home' : 'light'}
                        className="rounded-[14px] px-3 py-3 text-sm"
                      />
                    )
                  })}
                </EditableList>
              </nav>

              <div className={cn('mt-4 border-t pt-4 sm:hidden', isHome ? 'border-white/10' : 'border-[#D8E6EB]')}>
                <GenflixCtaButton asChild tone={isHome ? 'solid' : 'surface'} className="min-h-[46px] w-full justify-between">
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
      </div>
    </section>
  )
}
