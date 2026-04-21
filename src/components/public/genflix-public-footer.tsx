import { Link } from 'react-router-dom'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { genflixSocialLinks } from '@/features/public/genflix-site-content'
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
    title: 'Links Rapidos',
    metadata: {
      items: [
        { label: 'Sobre a GenFlix', href: '/sobre', isInternal: true },
        { label: 'Perguntas frequentes', href: '/perguntas-frequentes', isInternal: true },
        { label: 'Politica de privacidade', href: '/privacidade', isInternal: true },
      ],
    },
  },
  {
    id: 'cursos',
    title: 'Cursos',
    metadata: {
      items: [
        { label: 'Catalogo completo', href: '/cursos', isInternal: true },
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

  return (
    <footer id={id} className="bg-[#0A3640] text-white">
      <div className="public-site-container py-8 sm:py-10">
        <div className="space-y-8 rounded-[32px] border border-white/8 bg-[#0A3640] px-6 py-8 sm:px-8 lg:px-10">
          <div className="space-y-8 border-b border-white/18 pb-8">
            <div className="flex items-center">
              <GenflixLogo theme="light" />
            </div>

            <div className="grid gap-8 lg:grid-cols-[repeat(3,minmax(0,1fr))_220px]">
              <EditableList entryKey="global.footer.columns" fallback={footerColumns} label="Colunas do rodape" pageKey="global">
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

              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/92">
                  Midias sociais
                </h3>
                <p className="mt-4 text-sm text-white/72">Nos siga em:</p>
                <div className="mt-4 flex items-center gap-4">
                  {genflixSocialLinks.filter((item) => item.label !== 'TikTok' && item.label !== 'YouTube').map((item) => {
                    const Icon = item.icon
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={item.label}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/14 bg-white/6 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-white/68">
            <p className="mx-auto max-w-[760px]">
              <EditableText
                entryKey="global.footer.copyright"
                fallback="© 2026 e-Clix | Solucoes em Conteudo Educacional. Todos os direitos reservados."
                label="Copyright"
                pageKey="global"
              />
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
