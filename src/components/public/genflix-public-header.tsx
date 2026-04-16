import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { getDashboardPathForRoles } from '@/features/auth/dashboard-path'
import type { GenflixNavLink, GenflixPageKey } from '@/features/public/genflix-site-content'
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
  const ctaLabel = user ? 'Acessar painel' : 'Entrar'

  return (
    <header className="flex min-h-[72px] items-center justify-between gap-6">
      <GenflixLogo />

      <nav className="hidden items-center gap-7 lg:flex">
        {navLinks.map((item) => (
          <HeaderNavLink
            key={`${item.label}-${item.href}`}
            item={item}
            isActive={item.pageKey === currentPage}
          />
        ))}
      </nav>

      <Link
        to={ctaPath}
        className="inline-flex items-center gap-2 rounded-full bg-[#1398B7] px-4 py-2 font-readex text-sm font-medium text-white shadow-[0_10px_24px_rgba(19,152,183,0.28)] transition-transform hover:-translate-y-0.5 hover:bg-[#1398B7]"
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </header>
  )
}
