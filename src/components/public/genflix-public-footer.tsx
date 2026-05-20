import { MessageCircleMore } from 'lucide-react'
import { Link } from 'react-router-dom'

import { AppVersion } from '@/components/layout/AppVersion'
import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { genflixSocialLinks } from '@/features/public/genflix-public-shell-content'
import { EditableList, EditableText, isEditableItemVisible, useEditableValue } from '@/features/site-editor/visual-editor'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeFooterItem(item: unknown) {
  if (!isRecord(item)) {
    return null
  }

  const metadata = isRecord(item.metadata) ? item.metadata : {}
  const label = typeof item.label === 'string' ? item.label : ''
  const href = typeof item.href === 'string' ? item.href : '#'
  const buttonLabel = typeof item.buttonLabel === 'string'
    ? item.buttonLabel
    : typeof metadata.buttonLabel === 'string'
      ? metadata.buttonLabel
      : undefined

  return {
    label,
    href,
    buttonLabel,
    isInternal: item.isInternal === true || metadata.isInternal === true,
    openInNewTab: item.openInNewTab === true || metadata.openInNewTab === true,
    isHidden: item.isHidden === true || metadata.isHidden === true,
  }
}

type NormalizedFooterItem = NonNullable<ReturnType<typeof normalizeFooterItem>>

function isVisibleFooterItem(item: ReturnType<typeof normalizeFooterItem>): item is NormalizedFooterItem {
  return item !== null && item.isHidden !== true
}

const footerSocialLinksFallback = genflixSocialLinks
  .filter((item) => item.label !== 'TikTok' && item.label !== 'YouTube')
  .map((item) => ({
    id: item.label,
    label: item.label,
    href: item.href,
  }))

const footerSocialIconMap = new Map(
  genflixSocialLinks.map((item) => [item.label.trim().toLowerCase(), item.icon] as const),
)

function getFooterSocialIcon(label: string) {
  return footerSocialIconMap.get(label.trim().toLowerCase()) ?? MessageCircleMore
}

function FooterNavLink({
  href,
  children,
  isInternal = false,
  openInNewTab = false,
  isButton = false,
}: {
  href: string
  children: string
  isInternal?: boolean
  openInNewTab?: boolean
  isButton?: boolean
}) {
  const className = 'text-sm leading-7 text-white/72 transition-colors hover:text-white'

  if (isInternal) {
    if (isButton) {
      return (
        <GenflixCtaButton asChild tone="surface" className="min-h-[42px] text-[13px] text-[#0A3640]">
          <Link to={href}>{children}</Link>
        </GenflixCtaButton>
      )
    }

    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    )
  }

  if (isButton) {
    return (
      <GenflixCtaButton asChild tone="surface" className="min-h-[42px] text-[13px] text-[#0A3640]">
        <a href={href} target={openInNewTab ? '_blank' : undefined} rel={openInNewTab ? 'noreferrer' : undefined}>
          {children}
        </a>
      </GenflixCtaButton>
    )
  }

  return (
    <a
      href={href}
      className={className}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noreferrer' : undefined}
    >
      {children}
    </a>
  )
}

const footerColumnsFallback = [
  {
    id: 'links-rapidos',
    title: 'Links Rápidos',
    metadata: {
      items: [
        { label: 'Sobre a GenFlix', href: '/sobre', isInternal: true },
        { label: 'Perguntas frequentes', href: '/suporte#perguntas-frequentes', isInternal: true },
        { label: 'Suporte', href: '/suporte', isInternal: true },
        { label: 'Política de privacidade', href: '/privacidade', isInternal: true },
        { label: 'Política de reembolso', href: '/politica-de-reembolso', isInternal: true },
      ],
    },
  },
  {
    id: 'cursos',
    title: 'Cursos',
    metadata: {
      items: [
        { label: 'Catálogo completo', href: '/cursos', isInternal: true },
        { label: 'Recursos de estudo', href: '/recursos', isInternal: true },
        { label: 'Blog', href: '/blog', isInternal: true },
      ],
    },
  },
  {
    id: 'contato',
    title: 'Contato',
    metadata: {
      items: [
        { label: 'Fale conosco', href: '/contato', isInternal: true },
        { label: 'Ensine na GenFlix', href: '/ensine-na-genflix', isInternal: true },
        { label: 'Abrir chamado', href: '/suporte', isInternal: true },
        { label: 'Ajuda / Como usar', href: '/ajuda', isInternal: true },
        { label: 'Indique a GenFlix', href: '/indique-a-genflix', isInternal: true },
      ],
    },
  },
]

export function GenflixPublicFooter({
  id = 'footer',
}: {
  id?: string
}) {
  const footerColumns = useEditableValue('global.footer.columns', footerColumnsFallback, { pageKey: 'global' })
  const footerSocialLinks = useEditableValue('global.footer.socialLinks', footerSocialLinksFallback, { pageKey: 'global' })

  return (
    <footer id={id} className="bg-[#0A3640] text-white shadow-none">
      <div className="public-site-container py-8 sm:py-10">
        <div className="space-y-8 px-6 py-8 sm:px-8 lg:px-10">
          <div className="space-y-8 border-b border-white/18 pb-8">
            <div className="flex items-center">
              <Link to="/" aria-label="Ir para a home da GenFlix">
                <GenflixLogo theme="light" />
              </Link>
            </div>

            <div className="grid gap-8 lg:grid-cols-4">
              <EditableList entryKey="global.footer.columns" fallback={footerColumns} label="Colunas do rodapé" pageKey="global">
                {(columns) => columns.filter(isEditableItemVisible).map((column) => {
                  const items = Array.isArray(column.metadata?.items)
                    ? column.metadata.items.map(normalizeFooterItem).filter(isVisibleFooterItem)
                    : []

                  return (
                    <div key={column.id}>
                      <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/92">
                        {column.title}
                      </h3>
                      <ul className="mt-4 space-y-2">
                        {items.map((item, index) => (
                          <li key={`${String(item.buttonLabel ?? item.label ?? index)}`}>
                            <FooterNavLink
                              href={item.href}
                              isInternal={item.isInternal}
                              openInNewTab={item.openInNewTab}
                              isButton={Boolean(item.buttonLabel)}
                            >
                              {item.buttonLabel ?? item.label}
                            </FooterNavLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </EditableList>

              <EditableList
                entryKey="global.footer.socialLinks"
                fallback={footerSocialLinks}
                label="Mídias sociais"
                pageKey="global"
              >
                {(items) => (
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/92">
                      Mídias sociais
                    </h3>
                    <div className="mt-4 flex flex-col gap-2">
                      {items.filter(isEditableItemVisible).map((item) => {
                        const Icon = getFooterSocialIcon(item.label ?? item.title ?? '')
                        const label = item.label ?? item.title ?? 'Rede social'

                        return (
                          <a
                            key={item.id}
                            href={item.href ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={label}
                            className="inline-flex w-fit items-center gap-2 text-white/80 transition-colors hover:text-white"
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-semibold leading-none">{label}</span>
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}
              </EditableList>
              <div className="flex h-full items-center">
                <GenflixCtaButton
                  asChild
                  tone="solid"
                  className="min-h-[42px] w-full text-[13px]"
                >
                  <Link to="/ensine-na-genflix">
                    Ensine na Genflix
                  </Link>
                </GenflixCtaButton>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-white/68">
            <p className="mx-auto max-w-[760px]">
              <EditableText
                entryKey="global.footer.copyright"
                fallback="Copyright ©️ 2026 e-Clix | Soluções em Conteúdo Educacional | CNPJ 38.112.632/0001-10"
                label="Copyright"
                pageKey="global"
              />
            </p>
            <AppVersion className="mt-1.5 block text-[9px] font-medium tracking-[0.16em] text-white/20" />
          </div>
        </div>
      </div>
    </footer>
  )
}
