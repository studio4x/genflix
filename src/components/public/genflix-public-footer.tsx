import { Link } from 'react-router-dom'

import { GenflixLogo } from '@/components/public/genflix-logo'
import { genflixFooterColumns } from '@/features/public/genflix-site-content'
import { EditableList, EditableText, useEditableValue } from '@/features/site-editor/visual-editor'

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
  const className = isButton
    ? 'inline-flex items-center justify-center rounded-full bg-white px-5 py-3 font-readex text-sm font-medium text-[#0f4a54] transition-colors hover:bg-[#E8F6FA]'
    : 'text-sm text-white/72 transition-colors hover:text-white'

  if (isInternal) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
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
                  {(columns) => columns.map((column) => {
                    const items = Array.isArray(column.metadata?.items)
                      ? column.metadata.items as Array<{
                        label: string
                        href: string
                        isInternal?: boolean
                        openInNewTab?: boolean
                        buttonLabel?: string
                      }>
                      : []

                    return (
                      <div key={column.id}>
                        <h3 className="font-readex text-sm font-medium uppercase tracking-[0.16em] text-white/92">
                          {column.title}
                        </h3>
                        <ul className="mt-4 space-y-3">
                          {items.map((item) => (
                            <li key={item.label}>
                              <FooterNavLink
                                href={item.href}
                                isInternal={item.isInternal ?? false}
                                openInNewTab={item.openInNewTab ?? false}
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
