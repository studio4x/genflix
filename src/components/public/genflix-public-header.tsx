import { Link } from 'react-router-dom'

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
}: {
  item: GenflixNavLink
  isActive: boolean
}) {
  const className = cn(
    'font-manrope text-[14px] font-medium transition-colors',
    isActive
      ? 'font-bold text-[#1398B7]'
      : 'text-[#5f7077] hover:font-bold hover:text-[#1398B7]',
  )

  if (item.isInternal) {
    return (
      <Link to={item.href} className={className}>
        {item.label}
      </Link>
    )
  }

  return (
    <a href={item.href} className={className}>
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
  const { user, roles } = useAuth()
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

  return (
    <header className="flex min-h-[72px] items-center justify-between gap-6">
      <GenflixLogo />

      <nav className="hidden items-center gap-7 lg:flex">
        <EditableList entryKey="global.header.navLinks" fallback={visibleNavLinks} label="Menu principal" pageKey="global">
          {(items) => items.filter(isEditableItemVisible).map((item) => {
            const navItem = {
              label: item.label ?? '',
              href: item.href ?? '#',
              isInternal: item.metadata?.isInternal === true,
              pageKey: typeof item.metadata?.pageKey === 'string' ? item.metadata.pageKey as GenflixPageKey : undefined,
              requiresAuth: item.metadata?.requiresAuth === true,
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

      <GenflixCtaButton asChild>
        <Link to={ctaPath}>
          <EditableText
            entryKey={user ? 'global.header.cta.authenticated.label' : 'global.header.cta.anonymous.label'}
            fallback={ctaLabel}
            label="Botão do cabeçalho"
            pageKey="global"
          />
        </Link>
      </GenflixCtaButton>
    </header>
  )
}
