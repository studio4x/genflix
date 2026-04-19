import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { getDashboardPathForRoles } from '@/features/auth/dashboard-path'
import type { GenflixNavLink, GenflixPageKey } from '@/features/public/genflix-site-content'
import { EditableList, EditableText, useEditableValue } from '@/features/site-editor/visual-editor'
import { cn } from '@/lib/utils'

function HeaderNavLink({
  item,
  isActive,
}: {
  item: GenflixNavLink
  isActive: boolean
}) {
  const className = cn(
    'font-manrope text-[13px] transition-colors',
    isActive ? 'font-semibold text-[#183139]' : 'text-[#5f7077] hover:text-[#183139]',
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
      },
    })),
    { pageKey: 'global' },
  )
  return (
    <header className="flex min-h-[72px] items-center justify-between gap-6">
      <GenflixLogo />

      <nav className="hidden items-center gap-7 lg:flex">
        <EditableList entryKey="global.header.navLinks" fallback={editableNavLinks} label="Menu principal" pageKey="global">
          {(items) => items.map((item) => {
            const navItem = {
              label: item.label ?? '',
              href: item.href ?? '#',
              isInternal: item.metadata?.isInternal === true,
              pageKey: typeof item.metadata?.pageKey === 'string' ? item.metadata.pageKey as GenflixPageKey : undefined,
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

      <Link
        to={ctaPath}
        className="inline-flex items-center gap-2 rounded-full bg-[#1398B7] px-4 py-2 font-readex text-sm font-medium text-white shadow-[0_10px_24px_rgba(19,152,183,0.28)] transition-transform hover:-translate-y-0.5 hover:bg-[#1398B7]"
      >
        <EditableText
          entryKey={user ? 'global.header.cta.authenticated.label' : 'global.header.cta.anonymous.label'}
          fallback={ctaLabel}
          label="Botão do cabeçalho"
          pageKey="global"
        />
        <ArrowRight className="h-4 w-4" />
      </Link>
    </header>
  )
}
