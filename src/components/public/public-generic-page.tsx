import { Link } from 'react-router-dom'

import { GenflixCtaButton, normalizeGenflixCtaTone } from '@/components/public/genflix-cta-button'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { genflixNavLinks } from '@/features/public/genflix-public-shell-content'
import { EditableButton, EditableList, EditableText, isEditableItemVisible, sanitizeRichText } from '@/features/site-editor/visual-editor'

type GenericPageSection = {
  title: string
  description?: string
  paragraphs?: string[]
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paragraphsToHtml(paragraphs: string[]) {
  return paragraphs
    .filter((paragraph) => typeof paragraph === 'string' && paragraph.trim() !== '')
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('')
}

export function PublicGenericPage({
  entryPrefix,
  title,
  description,
  eyebrow,
  sections,
  cta,
  backgroundClassName = 'bg-[#F2F7F9]',
}: {
  entryPrefix: string
  title: string
  description: string
  eyebrow: string
  sections: GenericPageSection[]
  cta?: {
    label: string
    href: string
    isInternal?: boolean
  }
  backgroundClassName?: string
}) {
  return (
    <main className={`min-h-screen font-manrope text-[#163138] ${backgroundClassName}`}>
      <GenflixPublicHeader navLinks={genflixNavLinks} />

      <section className="pb-16 pt-6">
        <div className="public-site-container">
          <div className="max-w-[880px] px-2 sm:px-0">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#1398B7]">
              <EditableText entryKey={`${entryPrefix}.eyebrow`} fallback={eyebrow} label="Chamada da pÃ¡gina institucional" pageKey="global" />
            </p>
            <h1 className="mt-4 max-w-[760px] text-[2.5rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
              <EditableText entryKey={`${entryPrefix}.title`} fallback={title} label="TÃ­tulo da pÃ¡gina institucional" pageKey="global" />
            </h1>
            <p className="mt-4 max-w-[720px] text-base leading-7 text-[#183139]">
              <EditableText entryKey={`${entryPrefix}.description`} fallback={description} label="DescriÃ§Ã£o da pÃ¡gina institucional" pageKey="global" />
            </p>
          </div>

          <div className="mt-10 max-w-[880px] px-2 sm:px-0">
            <EditableList
              entryKey={`${entryPrefix}.sections`}
              fallback={sections.map((section, index) => ({
                id: `${entryPrefix}-section-${index + 1}`,
                title: section.title,
                description: section.description ?? paragraphsToHtml(section.paragraphs ?? []),
              }))}
              label="Seções da página institucional"
              pageKey="global"
              schema={{
                kind: 'rich-text-list',
                itemName: 'seção',
                addLabel: 'Adicionar seção',
              }}
            >
              {(items) => items.filter(isEditableItemVisible).map((item) => (
                <section
                  key={item.id}
                  className="space-y-4 border-b border-[#D8E6EB] pb-8 last:border-b-0 last:pb-0"
                >
                  <h2 className="text-[1.45rem] font-bold tracking-[-0.03em] text-[#183139]">
                    {item.title ?? item.label ?? 'Seção'}
                  </h2>
                  {item.description ? (
                    <div
                      className="space-y-4 text-[15px] leading-8 text-[#5f7178]"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeRichText(
                          item.description || paragraphsToHtml(Array.isArray(item.metadata?.paragraphs) ? item.metadata.paragraphs.filter((paragraph): paragraph is string => typeof paragraph === 'string') : []),
                        ),
                      }}
                    />
                  ) : null}
                </section>
              ))}
            </EditableList>
          </div>

          {cta ? (
            <div className="mt-10 flex justify-start">
              <EditableButton
                entryKey={`${entryPrefix}.cta`}
                fallback={{
                  label: cta.label,
                  href: cta.href,
                  isInternal: cta.isInternal ?? false,
                  tone: 'solid',
                  isHidden: false,
                }}
                label="CTA da página institucional"
                pageKey="global"
              >
                {(buttonValue) => buttonValue.isHidden === true ? null : (
                  <GenflixCtaButton asChild tone={normalizeGenflixCtaTone(buttonValue.tone)}>
                    {buttonValue.isInternal === true ? (
                      <Link to={typeof buttonValue.href === 'string' ? buttonValue.href : '#'}>
                        {typeof buttonValue.label === 'string' ? buttonValue.label : cta.label}
                      </Link>
                    ) : (
                      <a
                        href={typeof buttonValue.href === 'string' ? buttonValue.href : '#'}
                        target={buttonValue.openInNewTab === true ? '_blank' : undefined}
                        rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}
                      >
                        {typeof buttonValue.label === 'string' ? buttonValue.label : cta.label}
                      </a>
                    )}
                  </GenflixCtaButton>
                )}
              </EditableButton>
            </div>
          ) : null}
        </div>
      </section>

      <GenflixPublicFooter />
    </main>
  )
}
