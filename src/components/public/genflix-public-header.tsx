import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, Settings2, X } from 'lucide-react'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixCookieConsentBanner } from '@/components/public/genflix-cookie-consent-banner'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { getDashboardPathForRoles } from '@/features/auth/dashboard-path'
import type { GenflixNavLink, GenflixPageKey } from '@/features/public/genflix-public-types'
import {
  createDefaultSiteAppearance,
  normalizeSiteAppearance,
  resolveSiteAppearancePageKey,
  resolveSiteAppearanceVariant,
  type SiteAppearanceFields,
  type SiteAppearanceScopeKey,
  type SiteAppearanceTheme,
  type SiteAppearanceViewport,
} from '@/features/site-editor/site-appearance'
import { buildSiteTypographyCss, normalizeSiteTypography } from '@/features/site-editor/site-typography'
import { SiteTrackingInjector } from '@/features/site-editor/site-tracking-injector'
import { useSiteContentScope, useVisualEditorState, EditableButton, EditableList, isEditableItemVisible, useEditableValue } from '@/features/site-editor/visual-editor'
import { cn } from '@/lib/utils'

function HeaderNavLink({
  item,
  isActive,
  className,
  variant,
  appearance,
}: {
  item: GenflixNavLink
  isActive: boolean
  className?: string
  variant: 'home' | 'light'
  appearance: SiteAppearanceFields
}) {
  const defaultColor = variant === 'home' ? '#FFFFFF' : '#15323B'
  const resolvedColor = appearance.menuColor ?? defaultColor
  const resolvedActiveColor = appearance.menuActiveColor ?? resolvedColor
  const resolvedHoverColor = appearance.menuHoverColor ?? resolvedColor
  const classes = cn(
    'relative text-[15px] leading-none tracking-[-0.02em] transition-colors hover:text-[color:var(--genflix-menu-hover-color)]',
    isActive ? 'font-extrabold' : 'font-semibold',
    className,
  )
  const style = {
    color: isActive ? resolvedActiveColor : resolvedColor,
    fontFamily: appearance.menuFontFamily ?? undefined,
    fontSize: appearance.menuFontSize ?? undefined,
    fontWeight: appearance.menuFontWeight ?? undefined,
    letterSpacing: appearance.menuLetterSpacing ?? undefined,
    ['--genflix-menu-hover-color' as never]: resolvedHoverColor,
  } as CSSProperties

  if (item.isInternal) {
    return (
      <Link to={item.href} className={classes} style={style}>
        {item.label}
      </Link>
    )
  }

  return (
    <a href={item.href} className={classes} style={style}>
      {item.label}
    </a>
  )
}

function HeaderAppearanceControl({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#163138] shadow-[0_18px_40px_rgba(6,27,33,0.08)] hover:bg-[#F2F7F9]"
    >
      <Settings2 className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function resolveHexColorLuminance(color: string) {
  const normalized = color.trim().replace('#', '')
  const hex = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null
  }

  const red = parseInt(hex.slice(0, 2), 16)
  const green = parseInt(hex.slice(2, 4), 16)
  const blue = parseInt(hex.slice(4, 6), 16)

  return (0.299 * red + 0.587 * green + 0.114 * blue) / 255
}

function resolveLogoTheme(backgroundColor?: string, useHomeTheme = false): 'light' | 'dark' {
  if (useHomeTheme) {
    return 'light'
  }

  if (typeof backgroundColor === 'string') {
    const luminance = resolveHexColorLuminance(backgroundColor)
    if (typeof luminance === 'number') {
      return luminance < 0.55 ? 'light' : 'dark'
    }
  }

  return 'dark'
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
  const editor = useVisualEditorState()
  const scope = useSiteContentScope()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [viewport, setViewport] = useState<SiteAppearanceViewport>('desktop')
  const isHome = currentPage === 'home'
  const headerTheme: SiteAppearanceTheme = isHome ? 'home' : 'light'
  const appearanceScopePageKey = resolveSiteAppearancePageKey(currentPage)
  const pageAppearanceEntry = scope?.entries.get(`${appearanceScopePageKey}:site.appearance`)?.value
  const globalAppearanceEntry = scope?.entries.get('global:site.appearance')?.value
  const globalTypographyEntry = scope?.entries.get('global:site.typography')?.value
  const typographyCss = buildSiteTypographyCss(normalizeSiteTypography(globalTypographyEntry))
  const pageAppearanceRecord = normalizeSiteAppearance(
    pageAppearanceEntry ?? globalAppearanceEntry ?? createDefaultSiteAppearance(headerTheme),
    createDefaultSiteAppearance(headerTheme),
    pageAppearanceEntry ? 'page' : 'global',
  )
  const globalAppearanceRecord = normalizeSiteAppearance(
    globalAppearanceEntry ?? createDefaultSiteAppearance('light'),
    createDefaultSiteAppearance('light'),
    'global',
  )
  const currentScopeAppearance = resolveSiteAppearanceVariant(
    pageAppearanceRecord.scope === 'global' ? globalAppearanceRecord : pageAppearanceRecord,
    viewport,
  )
  const useHomeTheme = isHome && pageAppearanceRecord.scope !== 'global'
  const logoTheme = resolveLogoTheme(currentScopeAppearance.pageBackgroundColor, useHomeTheme)
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

  useEffect(() => {
    function updateViewport() {
      if (window.innerWidth < 768) {
        setViewport('mobile')
        return
      }

      if (window.innerWidth < 1280) {
        setViewport('tablet')
        return
      }

      setViewport('desktop')
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)

    return () => {
      window.removeEventListener('resize', updateViewport)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.body.dataset.genflixPublicShell = 'true'
    document.body.style.setProperty('--genflix-page-background', currentScopeAppearance.pageBackgroundColor ?? '#F2F7F9')

    return () => {
      if (document.body.dataset.genflixPublicShell === 'true') {
        delete document.body.dataset.genflixPublicShell
      }
      document.body.style.removeProperty('--genflix-page-background')
    }
  }, [currentScopeAppearance.pageBackgroundColor])

  const openAppearanceEditor = (scopePageKey: SiteAppearanceScopeKey) => {
    if (!editor?.isEditing || !scope) {
      return
    }

    const fallbackAppearance = scopePageKey === 'global'
      ? globalAppearanceRecord
      : pageAppearanceRecord.scope === 'global'
        ? globalAppearanceRecord
        : pageAppearanceRecord

    editor.openEditor({
      pageKey: scopePageKey,
      entryKey: 'site.appearance',
      entryType: 'json',
      label: scopePageKey === 'global' ? 'Header global' : 'Header da pagina',
      fallback: fallbackAppearance,
      schema: { kind: 'site-appearance' },
      reload: scope.reload,
    })
  }

  const headerChromeStyle = {
    height: currentScopeAppearance.headerHeight ?? '72px',
  }

  const logoStyle = {
    transform: `scale(${currentScopeAppearance.logoScale ?? 1})`,
    transformOrigin: 'left center',
  }

  const headerSectionStyle = {
    backgroundColor: currentScopeAppearance.pageBackgroundColor ?? (useHomeTheme ? undefined : '#F2F8FA'),
  }

  return (
    <>
      {typographyCss ? <style>{typographyCss}</style> : null}
      <section
        className={cn(
          'border-b',
          useHomeTheme
            ? 'border-white/10 bg-[linear-gradient(90deg,#1C7082_0%,#0F5562_100%)] text-white'
            : 'border-[#D8E6EB] text-[#183139]',
        )}
        style={headerSectionStyle}
      >
        <div className="public-site-container">
          <header className="relative">
            <div className="flex items-center justify-between gap-4" style={headerChromeStyle}>
              <Link to="/" aria-label="Ir para a home da GenFlix" className="shrink-0">
                <GenflixLogo theme={logoTheme} className="origin-left" style={logoStyle} />
              </Link>

              <nav className="hidden items-center gap-8 xl:flex">
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
                        variant={useHomeTheme ? 'home' : 'light'}
                        appearance={currentScopeAppearance}
                      />
                    )
                  })}
                </EditableList>
              </nav>

              <div className="flex items-center gap-3">
                <EditableButton
                  entryKey={user ? 'global.header.cta.authenticated.label' : 'global.header.cta.anonymous.label'}
                  fallback={{
                    label: ctaLabel,
                    href: ctaPath,
                    isInternal: ctaPath.startsWith('/'),
                    tone: 'warm',
                  }}
                  label="Botao do cabecalho"
                  pageKey="global"
                >
                  {(buttonValue) => buttonValue.isHidden === true ? null : (
                    <GenflixCtaButton asChild tone="warm" className="hidden h-11 px-5 sm:inline-flex">
                      {buttonValue.isInternal === true ? (
                        <Link to={typeof buttonValue.href === 'string' ? buttonValue.href : ctaPath}>
                          {typeof buttonValue.label === 'string' ? buttonValue.label : ctaLabel}
                        </Link>
                      ) : (
                        <a
                          href={typeof buttonValue.href === 'string' ? buttonValue.href : ctaPath}
                          target={buttonValue.openInNewTab === true ? '_blank' : undefined}
                          rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}
                        >
                          {typeof buttonValue.label === 'string' ? buttonValue.label : ctaLabel}
                        </a>
                      )}
                    </GenflixCtaButton>
                  )}
                </EditableButton>

                {editor?.isEditing && scope ? (
                  <div className="hidden items-center gap-2 xl:flex">
                    <HeaderAppearanceControl
                      label={appearanceScopePageKey === 'global' ? 'Header global' : 'Header desta pagina'}
                      onClick={() => openAppearanceEditor(appearanceScopePageKey)}
                    />
                    {appearanceScopePageKey !== 'global' ? (
                      <button
                        type="button"
                        onClick={() => openAppearanceEditor('global')}
                        className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-[#F8FCFD] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#163138] hover:bg-white"
                      >
                        Global
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => setIsMenuOpen((open) => !open)}
                  className={cn(
                    'inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors backdrop-blur-sm xl:hidden',
                    useHomeTheme
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
                  useHomeTheme
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
                          variant={useHomeTheme ? 'home' : 'light'}
                          appearance={currentScopeAppearance}
                          className="rounded-[14px] px-3 py-3 text-[15px]"
                        />
                      )
                    })}
                  </EditableList>
                </nav>

                <div className={cn('mt-4 border-t pt-4 sm:hidden', useHomeTheme ? 'border-white/10' : 'border-[#D8E6EB]')}>
                  <EditableButton
                    entryKey={user ? 'global.header.cta.authenticated.label' : 'global.header.cta.anonymous.label'}
                    fallback={{
                      label: ctaLabel,
                      href: ctaPath,
                      isInternal: ctaPath.startsWith('/'),
                      tone: 'warm',
                    }}
                    label="Botao do cabecalho mobile"
                    pageKey="global"
                  >
                    {(buttonValue) => buttonValue.isHidden === true ? null : (
                      <GenflixCtaButton asChild tone="warm" className="h-11 w-full px-5">
                        {buttonValue.isInternal === true ? (
                          <Link to={typeof buttonValue.href === 'string' ? buttonValue.href : ctaPath}>
                            {typeof buttonValue.label === 'string' ? buttonValue.label : ctaLabel}
                          </Link>
                        ) : (
                          <a
                            href={typeof buttonValue.href === 'string' ? buttonValue.href : ctaPath}
                            target={buttonValue.openInNewTab === true ? '_blank' : undefined}
                            rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}
                          >
                            {typeof buttonValue.label === 'string' ? buttonValue.label : ctaLabel}
                          </a>
                        )}
                      </GenflixCtaButton>
                    )}
                  </EditableButton>
                </div>
              </div>
            ) : null}

            {editor?.isEditing && scope ? (
              <div className="mt-3 flex flex-wrap gap-2 xl:hidden">
                <HeaderAppearanceControl
                  label={appearanceScopePageKey === 'global' ? 'Header global' : 'Header desta pagina'}
                  onClick={() => openAppearanceEditor(appearanceScopePageKey)}
                />
                {appearanceScopePageKey !== 'global' ? (
                  <button
                    type="button"
                    onClick={() => openAppearanceEditor('global')}
                    className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-[#F8FCFD] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#163138] hover:bg-white"
                  >
                    Global
                  </button>
                ) : null}
              </div>
            ) : null}
          </header>
        </div>
      </section>

      <GenflixCookieConsentBanner />
      <SiteTrackingInjector />
    </>
  )
}
