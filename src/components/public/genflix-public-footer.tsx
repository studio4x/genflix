import { Link } from 'react-router-dom'

import { GenflixCtaButton } from '@/components/public/genflix-cta-button'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { genflixFooterColumns } from '@/features/public/genflix-site-content'
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
  const className = 'text-sm text-white/72 transition-colors hover:text-white'

  if (isInternal) {
    if (isButton) {
      return (
        <GenflixCtaButton asChild tone="surface" className="text-[0.82rem]">
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
      <GenflixCtaButton asChild tone="surface" className="text-[0.82rem]">
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

export function GenflixPublicFooter({
  id = 'footer',
}: {
  id?: string
}) {
  const footerColumns = useEditableValue(
    'global.footer.columns',
    genflixFooterColumns.map((column) => ({
      id: column.title,
      title: column.title,
      metadata: {
        items: column.items,
      },
    })),
    { pageKey: 'global' },
  )

  return (
    <footer id={id} className="bg-[#0f4a54] text-white">
      <div className="public-site-container">
        <div className="rounded-b-[30px] bg-[#0f4a54] px-6 py-10 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-8 border-b border-white/16 pb-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-[240px]">
                <GenflixLogo theme="light" />
                <p className="mt-5 text-sm leading-7 text-white/72">
                  <EditableText
                    entryKey="global.footer.description"
                    fallback="Conteúdo educacional para quem quer transformar estudo em avanço real de carreira."
                    label="Descrição do rodapé"
                    pageKey="global"
                  />
                </p>
              </div>

              <div className="grid flex-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                <EditableList entryKey="global.footer.columns" fallback={footerColumns} label="Colunas do rodapé" pageKey="global">
                  {(columns) => columns.filter(isEditableItemVisible).map((column) => {
                    const items = Array.isArray(column.metadata?.items)
                      ? column.metadata.items.map(normalizeFooterItem).filter(isVisibleFooterItem)
                      : []

                    return (
                      <div key={column.id}>
                        <h3 className="font-readex text-sm font-medium uppercase tracking-[0.16em] text-white/92">
                          {column.title}
                        </h3>
                        <ul className="mt-4 space-y-3">
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
              </div>
            </div>

            <div className="text-center text-sm text-white/68">
              <p className="mx-auto">
                <EditableText
                  entryKey="global.footer.copyright"
                  fallback="Copyright ©️ 2026 e-Clix | Soluções em Conteúdo Educacional | CNPJ 38.112.632/0001-10"
                  label="Copyright"
                  pageKey="global"
                />
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
