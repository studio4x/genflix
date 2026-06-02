import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GenflixLogo } from '@/components/public/genflix-logo';
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer';
import { GenflixPublicHeader } from '@/components/public/genflix-public-header';
import { genflixNavLinks } from '@/features/public/genflix-public-shell-content';
import { EditableImage, EditableText, getEditableImagePresentation } from '@/features/site-editor/visual-editor';
interface GenflixAuthLayoutProps {
    entryPrefix: string;
    title: string;
    subtitle: string;
    imageUrl: string;
    children: ReactNode;
}
export function GenflixAuthLayout({ entryPrefix, title, subtitle, imageUrl, children, }: GenflixAuthLayoutProps) {
    return (<main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader navLinks={genflixNavLinks}/>

      <section className="bg-[#F2F7F9] pb-0 pt-4">
        <div className="public-site-container">
          <div className="overflow-hidden rounded-t-[30px] border border-[#D8E6EB] bg-white shadow-[0_24px_56px_rgba(21,50,59,0.05)]">
            <div className="grid min-h-[720px] lg:grid-cols-[0.95fr_1.05fr]">
              <EditableImage entryKey={`${entryPrefix}.image`} fallback={{ src: imageUrl, alt: title }} label="Imagem da lateral da página de autenticação" pageKey="global">
                {(image) => (<aside className="relative min-h-[360px] overflow-hidden" style={{
                backgroundImage: `linear-gradient(180deg, rgba(16,31,37,0.4) 0%, rgba(16,31,37,0.52) 100%), url(${typeof image.src === 'string' ? image.src : imageUrl})`,
                backgroundPosition: getEditableImagePresentation(image).backgroundPosition,
                backgroundSize: getEditableImagePresentation(image).fit === 'contain' ? 'contain' : 'cover',
            }}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_22%,rgba(255,255,255,0.22),transparent_28%),linear-gradient(180deg,rgba(8,18,22,0.1)_0%,rgba(8,18,22,0.28)_100%)]"/>

                    <div className="relative z-10 flex h-full flex-col justify-between px-6 py-8 sm:px-9 sm:py-10 lg:px-10 lg:py-11">
                      <GenflixLogo theme="light"/>

                      <div className="max-w-[300px] pb-1 text-white">
                        <h1 className="text-[2.45rem] font-extrabold leading-[0.92] tracking-[-0.06em] sm:text-[3rem]">
                          <EditableText entryKey={`${entryPrefix}.title`} fallback={title} label="Título principal da página de autenticação" pageKey="global"/>
                        </h1>
                        <p className="mt-4 text-base leading-7 text-white/78">
                          <EditableText entryKey={`${entryPrefix}.subtitle`} fallback={subtitle} label="Subtítulo da página de autenticação" pageKey="global"/>
                        </p>
                      </div>
                    </div>
                  </aside>)}
              </EditableImage>

              <section className="flex items-center px-6 py-10 sm:px-10 lg:px-12">
                <div className="w-full max-w-[470px]">
                  <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#1398B7] transition-colors hover:text-[#1398B7]">
                    <ArrowLeft className="h-4 w-4"/>
                    <EditableText entryKey={`${entryPrefix}.backLinkLabel`} fallback="Voltar ao início" label="Texto do link de retorno da autenticação" pageKey="global"/>
                  </Link>

                  <div className="mt-8">{children}</div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <GenflixPublicFooter />
    </main>);
}
