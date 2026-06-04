import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { GenflixCtaButton, normalizeGenflixCtaTone } from '@/components/public/genflix-cta-button';
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer';
import { GenflixPublicHeader } from '@/components/public/genflix-public-header';
import { genflixNavLinks } from '@/features/public/genflix-public-shell-content';
import { EditableButton, EditableRichText, EditableText, useEditableValue } from '@/features/site-editor/visual-editor';
import type { EditableListItem } from '@/features/site-editor/types';
type GenericPageSection = {
    title: string;
    description?: string;
    paragraphs?: string[];
};
function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function paragraphsToHtml(paragraphs: string[]) {
    return paragraphs
        .filter((paragraph) => typeof paragraph === 'string' && paragraph.trim() !== '')
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join('');
}
function sectionsToRichText(sections: GenericPageSection[]) {
    return sections
        .map((section) => {
        const titleHtml = typeof section.title === 'string' && section.title.trim() !== ''
            ? `<h2>${escapeHtml(section.title)}</h2>`
            : '';
        const descriptionHtml = typeof section.description === 'string' && section.description.trim() !== ''
            ? section.description
            : paragraphsToHtml(section.paragraphs ?? []);
        return `${titleHtml}${descriptionHtml}`;
    })
        .filter((chunk) => chunk.trim() !== '')
        .join('');
}
function legacySectionsToRichText(sections: EditableListItem[]) {
    return sections
        .map((section) => {
        const titleHtml = typeof section.title === 'string' && section.title.trim() !== ''
            ? `<h2>${escapeHtml(section.title)}</h2>`
            : typeof section.label === 'string' && section.label.trim() !== ''
                ? `<h2>${escapeHtml(section.label)}</h2>`
                : '';
        const descriptionHtml = typeof section.description === 'string' ? section.description.trim() : '';
        return `${titleHtml}${descriptionHtml}`;
    })
        .filter((chunk) => chunk.trim() !== '')
        .join('');
}
export function PublicGenericPage({ entryPrefix, title, description, eyebrow, sections, cta, backgroundClassName = 'bg-[#F2F7F9]', }: {
    entryPrefix: string;
    title: string;
    description: string;
    eyebrow: string;
    sections: GenericPageSection[];
    cta?: {
        label: string;
        href: string;
        isInternal?: boolean;
    };
    backgroundClassName?: string;
}) {
    const pageStyle: CSSProperties | undefined = backgroundClassName === 'bg-white'
        ? ({ '--genflix-page-background': '#ffffff' } as CSSProperties)
        : undefined;
    const legacySectionsFallback = sections.map((section, index) => ({
        id: `${entryPrefix}-section-${index + 1}`,
        title: section.title,
        description: section.description ?? paragraphsToHtml(section.paragraphs ?? []),
    }));
    const legacySectionsValue = useEditableValue(`${entryPrefix}.sections`, legacySectionsFallback, { pageKey: 'global' });
    const contentFallback = Array.isArray(legacySectionsValue)
        ? legacySectionsToRichText(legacySectionsValue)
        : sectionsToRichText(sections);
    return (<main className={`min-h-screen font-manrope text-[#163138] ${backgroundClassName}`} style={pageStyle}>
      <GenflixPublicHeader navLinks={genflixNavLinks}/>

      <section className="pb-16 pt-6">
        <div className="public-site-container">
          <div className="max-w-[880px] px-2 sm:px-0">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#1398B7]">
              <EditableText entryKey={`${entryPrefix}.eyebrow`} fallback={eyebrow} label="Chamada da pgina institucional" pageKey="global"/>
            </p>
            <h1 className="mt-4 max-w-[760px] text-[2.5rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
              <EditableText entryKey={`${entryPrefix}.title`} fallback={title} label="Título da página institucional" pageKey="global"/>
            </h1>
            <p className="mt-4 max-w-[720px] text-base leading-7 text-[#183139]">
              <EditableText entryKey={`${entryPrefix}.description`} fallback={description} label="Descrição da página institucional" pageKey="global"/>
            </p>
          </div>

          <div className="mt-10 max-w-[880px] px-2 sm:px-0">
            <EditableRichText entryKey={`${entryPrefix}.content`} fallback={contentFallback} label="Conteúdo da página institucional" pageKey="global" className="rich-text-content space-y-4 text-[15px] leading-8 text-[#5f7178] [&_h2]:mt-8 [&_h2]:text-[1.45rem] [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:tracking-[-0.03em] [&_h2]:text-[#183139] [&_h2:first-child]:mt-0"/>
          </div>

          {cta ? (<div className="mt-10 flex justify-start">
              <EditableButton entryKey={`${entryPrefix}.cta`} fallback={{
                label: cta.label,
                href: cta.href,
                isInternal: cta.isInternal ?? false,
                tone: 'solid',
                isHidden: false,
            }} label="CTA da pgina institucional" pageKey="global">
                {(buttonValue) => buttonValue.isHidden === true ? null : (<GenflixCtaButton asChild tone={normalizeGenflixCtaTone(buttonValue.tone)}>
                    {buttonValue.isInternal === true ? (<Link to={typeof buttonValue.href === 'string' ? buttonValue.href : '#'}>
                        {typeof buttonValue.label === 'string' ? buttonValue.label : cta.label}
                      </Link>) : (<a href={typeof buttonValue.href === 'string' ? buttonValue.href : '#'} target={buttonValue.openInNewTab === true ? '_blank' : undefined} rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}>
                        {typeof buttonValue.label === 'string' ? buttonValue.label : cta.label}
                      </a>)}
                  </GenflixCtaButton>)}
              </EditableButton>
            </div>) : null}
        </div>
      </section>

      <GenflixPublicFooter />
    </main>);
}
