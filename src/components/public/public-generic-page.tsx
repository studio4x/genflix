import { Link } from 'react-router-dom'

import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { genflixNavLinks } from '@/features/public/genflix-site-content'

type GenericPageSection = {
  title: string
  paragraphs: string[]
}

export function PublicGenericPage({
  title,
  description,
  eyebrow,
  sections,
  cta,
}: {
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
      <section className="bg-[#F2F7F9] pt-4">
        <div className="public-site-container">
          <GenflixPublicHeader navLinks={genflixNavLinks} />
        </div>
      </section>

      <section className="bg-white pb-16 pt-4">
        <div className="public-site-container">
          <div className="rounded-[28px] border border-[#D8E6EB] bg-[linear-gradient(180deg,#F8FBFC_0%,#F2F7F9_100%)] px-6 py-10 shadow-[0_20px_44px_rgba(21,50,59,0.04)] sm:px-10">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#1398B7]">{eyebrow}</p>
            <h1 className="mt-4 max-w-[760px] text-[2.5rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#0A3640] sm:text-[3rem]">
              {title}
            </h1>
            <p className="mt-4 max-w-[720px] text-base leading-7 text-[#5f7178]">{description}</p>
          </div>

          <div className="mt-6 space-y-6">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-[24px] border border-[#D8E6EB] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(21,50,59,0.04)] sm:px-8"
              >
                <h2 className="text-[1.5rem] font-bold tracking-[-0.03em] text-[#183139]">{section.title}</h2>
                <div className="mt-4 space-y-4">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-[15px] leading-8 text-[#5f7178]">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {cta ? (
            <div className="mt-8 flex justify-start">
              {cta.isInternal ? (
                <Link
                  to={cta.href}
                  className="inline-flex items-center justify-center rounded-full bg-[#1398B7] px-5 py-3 font-readex text-sm font-medium text-white shadow-[0_12px_30px_rgba(19,152,183,0.24)] transition-colors hover:bg-[#0A3640]"
                >
                  {cta.label}
                </Link>
              ) : (
                <a
                  href={cta.href}
                  className="inline-flex items-center justify-center rounded-full bg-[#1398B7] px-5 py-3 font-readex text-sm font-medium text-white shadow-[0_12px_30px_rgba(19,152,183,0.24)] transition-colors hover:bg-[#0A3640]"
                >
                  {cta.label}
                </a>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <GenflixPublicFooter />
    </main>
  )
}
