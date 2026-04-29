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
}) {
  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader navLinks={genflixNavLinks} />

      <section className="bg-white pb-16 pt-6">
        <div className="public-site-container">
          <div className="rounded-[4px] border border-[#D8E6EB] bg-[#F2F8FA] px-6 py-12 shadow-[0_20px_44px_rgba(21,50,59,0.05)] sm:px-10">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#1398B7]">
              <EditableText entryKey={`${entryPrefix}.eyebrow`} fallback={eyebrow} label="Chamada da página institucional" pageKey="global" />
            </p>
            <h1 className="mt-4 max-w-[760px] text-[2.5rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
              <EditableText entryKey={`${entryPrefix}.title`} fallback={title} label="Título da página institucional" pageKey="global" />
            </h1>
            <p className="mt-4 max-w-[720px] text-base leading-7 text-[#183139]">
              <EditableText entryKey={`${entryPrefix}.description`} fallback={description} label="Descrição da página institucional" pageKey="global" />
            </p>
          </div>

          <div className="mt-6 space-y-6">
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
                <article
                  key={item.id}
                  className="rounded-[24px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(21,50,59,0.04)] sm:px-8"
                >
                  <h2 className="text-[1.5rem] font-bold tracking-[-0.03em] text-[#183139]">{item.title ?? item.label ?? 'Seção'}</h2>
                  {item.description ? (
                    <div
                      className="mt-4 space-y-4 text-[15px] leading-8 text-[#5f7178]"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeRichText(item.description || paragraphsToHtml(Array.isArray(item.metadata?.paragraphs) ? item.metadata.paragraphs.filter((paragraph): paragraph is string => typeof paragraph === 'string') : [])),
                      }}
                    />
                  ) : null}
                </article>
              ))}
            </EditableList>
          </div>

          {cta ? (
            <div className="mt-8 flex justify-start">
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
