import { Link } from 'react-router-dom'

import { GenflixLogo } from '@/components/public/genflix-logo'
import {
  genflixFooterColumns,
  genflixFooterNavLinks,
  genflixSocialLinks,
} from '@/features/public/genflix-site-content'
import { EditableList, EditableText, useEditableValue } from '@/features/site-editor/visual-editor'

function FooterNavLink({
  href,
  children,
  isInternal = false,
}: {
  href: string
  children: string
  isInternal?: boolean
}) {
  const classes = 'text-sm text-white/72 transition-colors hover:text-white'

  if (isInternal) {
    return (
      <Link to={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <a href={href} className={classes}>
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
  const footerNavLinks = useEditableValue(
    'global.footer.navLinks',
    genflixFooterNavLinks.map((item) => ({
      id: item.label,
      label: item.label,
      href: item.href,
      metadata: { isInternal: item.isInternal ?? false },
    })),
    { pageKey: 'global' },
  )
  const socialLinks = useEditableValue(
    'global.footer.socialLinks',
    genflixSocialLinks.map((item) => ({
      id: item.label,
      label: item.label,
      href: item.href,
    })),
    { pageKey: 'global' },
  )

  return (
    <footer id={id} className="bg-[#0f4a54] text-white">
      <div className="mx-auto max-w-[1440px] px-4 lg:px-6">
        <div className="rounded-b-[30px] bg-[#0f4a54] px-6 py-10 sm:px-10 lg:px-14">
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-8 border-b border-white/16 pb-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-[300px]">
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

              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                <EditableList entryKey="global.footer.columns" fallback={footerColumns} label="Colunas do rodapé" pageKey="global">
                  {(columns) => columns.map((column) => {
                    const items = Array.isArray(column.metadata?.items)
                      ? column.metadata.items as Array<{ label: string; href: string; isInternal?: boolean }>
                      : []

                    return (
                      <div key={column.id}>
                        <h3 className="font-readex text-sm font-medium uppercase tracking-[0.16em] text-white/92">
                          {column.title}
                        </h3>
                        <ul className="mt-4 space-y-3">
                          {items.map((item) => (
                            <li key={item.label}>
                              <FooterNavLink href={item.href} isInternal={item.isInternal ?? false}>
                                {item.label}
                              </FooterNavLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </EditableList>

                <div>
                  <h3 className="font-readex text-sm font-medium uppercase tracking-[0.16em] text-white/92">
                    Mídias sociais
                  </h3>
                  <p className="mt-4 text-sm text-white/72">Nos siga</p>
                  <div className="mt-4 flex items-center gap-3">
                    <EditableList entryKey="global.footer.socialLinks" fallback={socialLinks} label="Links sociais" pageKey="global">
                      {(items) => items.map((item) => {
                      const fallback = genflixSocialLinks.find((social) => social.label === item.label) ?? genflixSocialLinks[0]
                      const Icon = fallback.icon
                      return (
                        <a
                          key={item.label}
                          href={item.href ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={item.label}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/16 bg-white/6 text-white/76 transition-colors hover:bg-white/12 hover:text-white"
                        >
                          <Icon className="h-4 w-4" />
                        </a>
                      )
                    })}
                    </EditableList>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 text-sm text-white/68 lg:flex-row lg:items-center lg:justify-between">
              <p>
                <EditableText
                  entryKey="global.footer.copyright"
                  fallback="© 2026 | GenFlix | Soluções em Conteúdo Educacional. Todos os direitos reservados."
                  label="Copyright"
                  pageKey="global"
                />
              </p>
              <nav className="flex flex-wrap items-center gap-4">
                <EditableList entryKey="global.footer.navLinks" fallback={footerNavLinks} label="Links inferiores do rodapé" pageKey="global">
                  {(items) => items.map((item) => (
                    <FooterNavLink
                      key={`${item.label}-${item.href}`}
                      href={item.href ?? '#'}
                      isInternal={item.metadata?.isInternal === true}
                    >
                      {item.label ?? ''}
                    </FooterNavLink>
                  ))}
                </EditableList>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
