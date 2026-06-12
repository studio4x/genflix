import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/auth-provider';
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot';
import { GenflixCtaButton, normalizeGenflixCtaTone } from '@/components/public/genflix-cta-button';
import { GenflixCourseCard } from '@/components/public/genflix-course-card';
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer';
import { GenflixPublicHeader } from '@/components/public/genflix-public-header';
import { genflixCategoryTiles, genflixNavLinks, type GenflixCourseItem, } from '@/features/public/genflix-site-content';
import { fetchLatestPublicCoursesFromSupabase } from '@/features/public/genflix-public-content-api';
import { EditableContainer, EditableButton, EditableList, EditableText, isEditableItemVisible, useEditableValue, useSiteContentScope, useVisualEditorState, } from '@/features/site-editor/visual-editor';
import { renderSiteIconVisual } from '@/features/site-editor/site-icons';
import type { EditableListItem, SitePageKey } from '@/features/site-editor/types';
function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
const homeLayoutFallback: EditableListItem[] = [
    {
        id: 'home-categories',
        label: 'Areas de conhecimento',
        description: "Grade de categorias em destaque na home.",
        metadata: {
            templateKey: 'categories',
        },
    },
    {
        id: 'home-featured',
        label: "Novidades",
        description: "Listagem principal de cursos em destaque.",
        metadata: {
            templateKey: 'featured',
        },
    },
    {
        id: 'home-cta',
        label: 'Chamada final',
        description: 'Bloco final com chamada para explorar os cursos.',
        metadata: {
            templateKey: 'cta',
            pageKey: 'home',
        },
    },
];
const homeLayoutSchema = {
    kind: 'section-registry',
    itemName: 'bloco',
    addLabel: 'Adicionar bloco',
    instancePrefix: 'home.sections',
    instancePageKey: 'home',
    templates: [
        {
            id: 'categories',
            label: 'Areas de conhecimento',
            description: 'Grade de áreas com cards editáveis e ordem controlada.',
            item: {
                id: 'categories',
                label: 'Areas de conhecimento',
                description: "Grade de categorias em destaque na home.",
                metadata: {
                    templateKey: 'categories',
                },
            },
        },
        {
            id: 'featured',
            label: "Novidades",
            description: "Se??o de listagem principal com CTA para cursos.",
            item: {
                id: 'featured',
                label: "Novidades",
                description: "Listagem principal de cursos em destaque.",
                metadata: {
                    templateKey: 'featured',
                },
            },
        },
        {
            id: 'cta',
            label: 'Chamada final',
            description: 'Bloco final com imagem e CTA para explorar os cursos.',
            item: {
                id: 'cta',
                label: 'Chamada final',
                description: 'Bloco final com chamada para explorar os cursos.',
                metadata: {
                    templateKey: 'cta',
                    pageKey: 'home',
                },
            },
        },
    ],
};
const homeCategoryIconKeys: Record<string, string> = {
    Saude: 'heart-pulse',
    'Saúde': 'heart-pulse',
    Juridicos: 'scale',
    'Jurídicos': 'scale',
    Exatas: 'sigma',
    Gestao: 'briefcase-business',
    'Gestão': 'briefcase-business',
    Humanas: 'landmark',
    "Psican?lise / Psicologia": 'brain-circuit',
    'Psicanálise / Psicologia': 'brain-circuit',
    'Interesse Geral': 'sparkles',
};
function getHomeSectionMetadata(item: EditableListItem) {
    return isRecord(item.metadata) ? item.metadata : {};
}
function resolveHomeSectionPrefix(item: EditableListItem, templateKey: string) {
    const metadata = getHomeSectionMetadata(item);
    const configuredPrefix = typeof metadata.entryPrefix === 'string' ? metadata.entryPrefix : null;
    if (configuredPrefix) {
        return configuredPrefix;
    }
    if (templateKey === 'categories')
        return 'home.categories';
    if (templateKey === 'featured')
        return 'home.featured';
    return 'home.cta';
}
function resolveHomeSectionPageKey(item: EditableListItem): SitePageKey {
    const metadata = getHomeSectionMetadata(item);
    const configuredPageKey = typeof metadata.pageKey === 'string' ? metadata.pageKey : null;
    if (configuredPageKey === 'global' || configuredPageKey === 'home') {
        return configuredPageKey;
    }
    return 'home';
}

function resolveHomeCategoryHref(item: EditableListItem) {
    return typeof item.href === 'string' ? item.href.trim() : '';
}

function isExternalHref(href: string) {
    return /^https?:\/\//i.test(href) || href.startsWith('//');
}
function HomeStructureControl({ sections }: {
    sections: EditableListItem[];
}) {
    const editor = useVisualEditorState();
    const scope = useSiteContentScope();
    if (!editor?.isEditing || !scope) {
        return null;
    }
    return (<div className="public-site-container py-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => editor.openEditor({
            pageKey: 'home',
            entryKey: 'home.layout.sections',
            entryType: 'list',
            label: 'Estrutura da home',
            fallback: sections,
            schema: homeLayoutSchema,
            reload: scope.reload,
        })} className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#0A3640] shadow-[0_18px_40px_rgba(6,27,33,0.08)] hover:bg-[#F2F7F9]">
          Gerenciar blocos da home
        </button>
      </div>
    </div>);
}
function HomeCategoriesSection({ entryPrefix, pageKey = 'home', }: {
    entryPrefix: string;
    pageKey?: SitePageKey;
}) {
    const scope = useSiteContentScope();
    const categoryItems = useEditableValue(`${entryPrefix}.items`, genflixCategoryTiles.map((category) => ({
        id: category.label,
        label: category.label,
        metadata: {
            iconKey: homeCategoryIconKeys[category.label] ?? 'sparkles',
        },
    })), { pageKey });
    return (<section className="border-b border-[#D8E6EB] bg-[#f2f8fa] py-14 sm:py-16">
      <div className="public-site-container">
        <EditableContainer entryKey={`${entryPrefix}.heading.card`} label="Container interno de categorias" pageKey={pageKey}>
          <div className="mx-auto max-w-[640px] text-center">
            <h2 className="text-[2rem] font-bold tracking-[-0.04em] text-[#15323B] sm:text-[2.25rem]">
              <EditableText entryKey={`${entryPrefix}.title`} fallback="Cursos por área de conhecimento" label="Título de categorias" pageKey={pageKey}/>
            </h2>
          </div>
        </EditableContainer>

        <EditableContainer entryKey={`${entryPrefix}.items.wrap`} label="Container interno da grade de categorias" pageKey={pageKey}>
          <div className="mx-auto mt-10 flex max-w-[1160px] flex-wrap justify-center gap-3">
            {!scope?.isReady ? (<div className="w-full py-8 text-center text-sm font-semibold text-[#5F7077]">Carregando categorias...</div>) : null}
            <EditableList entryKey={`${entryPrefix}.items`} fallback={categoryItems} label="Categorias da home" pageKey={pageKey}>
              {(items) => (scope?.isReady ? items : []).filter(isEditableItemVisible).map((item) => {
            const category = genflixCategoryTiles.find((tile) => tile.label === item.label) ?? genflixCategoryTiles[0];
            const iconKey = typeof item.metadata?.iconKey === 'string'
                ? item.metadata.iconKey
                : homeCategoryIconKeys[category.label] ?? 'sparkles';
            const iconImageUrl = typeof item.metadata?.iconImageUrl === 'string' ? item.metadata.iconImageUrl : null;
            const iconImageAlt = typeof item.metadata?.iconImageAlt === 'string' ? item.metadata.iconImageAlt : null;
            const iconImageMimeType = typeof item.metadata?.iconImageMimeType === 'string' ? item.metadata.iconImageMimeType : null;
            const iconColor = typeof item.metadata?.iconColor === 'string' ? item.metadata.iconColor : null;
            const iconSize = typeof item.metadata?.iconSize === 'number'
                ? Math.min(36, Math.max(12, Math.round(item.metadata.iconSize)))
                : typeof item.metadata?.iconSize === 'string'
                    ? Math.min(36, Math.max(12, Math.round(Number(item.metadata.iconSize) || 20)))
                    : 20;
            const href = resolveHomeCategoryHref(item);
            const cardContent = (<article className="min-h-[124px] w-[145px] rounded-[4px] bg-[linear-gradient(180deg,#1BA8C5_0%,#0A3640_100%)] px-4 py-4 text-white shadow-[0_18px_30px_rgba(10,54,64,0.14)] transition-transform duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_22px_36px_rgba(10,54,64,0.22)] sm:w-[150px]">
                    <div className="flex h-11 w-11 items-center justify-center text-white/95">
                      {renderSiteIconVisual({
                    iconKey,
                    iconImageUrl,
                    iconAlt: iconImageAlt || item.label,
                    iconColor,
                    iconImageMimeType,
                    iconSize,
                    className: 'h-5 w-5',
                })}
                    </div>
                    <p className="mt-3 text-[15px] font-semibold leading-6 tracking-[-0.02em]">{item.label}</p>
                  </article>);
            if (!href) {
                return <div key={item.id}>{cardContent}</div>;
            }
            if (isExternalHref(href)) {
                return (<a key={item.id} href={href} target="_blank" rel="noreferrer" aria-label={`Abrir ${item.label}`} className="group block cursor-pointer transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1398B7] focus-visible:ring-offset-2">
                    {cardContent}
                  </a>);
            }
            return (<Link key={item.id} to={href} aria-label={`Abrir ${item.label}`} className="group block cursor-pointer transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1398B7] focus-visible:ring-offset-2">
                {cardContent}
              </Link>);
        })}
            </EditableList>
          </div>
        </EditableContainer>
      </div>
    </section>);
}
function HomeFeaturedSection({ entryPrefix, sectionId, pageKey = 'home', }: {
    entryPrefix: string;
    sectionId?: string;
    pageKey?: SitePageKey;
}) {
    const legacyFeaturedCtaLabel = useEditableValue(`${entryPrefix}.cta`, 'Conheca todos os cursos', { pageKey });
    const [featuredCourses, setFeaturedCourses] = useState<GenflixCourseItem[]>([]);
    const [isLoadingCourses, setIsLoadingCourses] = useState(true);
    const [coursesError, setCoursesError] = useState(false);
    useEffect(() => {
        let isMounted = true;
        async function loadCourses() {
            setIsLoadingCourses(true);
            setCoursesError(false);
            try {
                const courses = await fetchLatestPublicCoursesFromSupabase(6);
                if (isMounted) {
                    setFeaturedCourses(courses);
                }
            }
            catch {
                if (isMounted) {
                    setFeaturedCourses([]);
                    setCoursesError(true);
                }
            }
            finally {
                if (isMounted) {
                    setIsLoadingCourses(false);
                }
            }
        }
        void loadCourses();
        return () => {
            isMounted = false;
        };
    }, []);
    return (<section id={sectionId} className="bg-white py-16 sm:py-20">
      <div className="public-site-container">
        <EditableContainer entryKey={`${entryPrefix}.header.wrap`} label="Container interno do cabealho de novidades" pageKey={pageKey}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-[2rem] font-bold tracking-[-0.04em] text-[#15323B] sm:text-[2.25rem]">
                <EditableText entryKey={`${entryPrefix}.title`} fallback="Novidades" label="Título de cursos em destaque" pageKey={pageKey}/>
              </h2>
            </div>

            <EditableButton entryKey={`${entryPrefix}.cta`} fallback={{ label: legacyFeaturedCtaLabel, href: '/cursos', isInternal: true, tone: 'solid' }} label="CTA de cursos em destaque" pageKey={pageKey}>
              {(buttonValue) => buttonValue.isHidden === true ? null : (<GenflixCtaButton asChild className="h-11 self-start px-5" tone={normalizeGenflixCtaTone(buttonValue.tone)}>
                  {buttonValue.isInternal === true ? (<Link to={typeof buttonValue.href === 'string' ? buttonValue.href : '/cursos'}>
                      {typeof buttonValue.label === 'string' ? buttonValue.label : 'Conheca todos os cursos'}
                    </Link>) : (<a href={typeof buttonValue.href === 'string' ? buttonValue.href : '#'} target={buttonValue.openInNewTab === true ? '_blank' : undefined} rel={buttonValue.openInNewTab === true ? 'noreferrer' : undefined}>
                      {typeof buttonValue.label === 'string' ? buttonValue.label : 'Conheca todos os cursos'}
                    </a>)}
                </GenflixCtaButton>)}
            </EditableButton>
          </div>
        </EditableContainer>

        <EditableContainer entryKey={`${entryPrefix}.grid.wrap`} label="Container interno da grade de novidades" pageKey={pageKey}>
          {isLoadingCourses ? (<div className="mt-10 rounded-[4px] border border-dashed border-[#D8E6EB] bg-[#F2F8FA] px-6 py-12 text-center text-sm font-semibold text-[#5F7077]">
              Carregando cursos publicados...
            </div>) : featuredCourses.length > 0 ? (<div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featuredCourses.map((course) => (<GenflixCourseCard key={course.slug} course={course}/>))}
            </div>) : (<div className="mt-10 rounded-[4px] border border-dashed border-[#D8E6EB] bg-[#F2F8FA] px-6 py-12 text-center">
              <p className="text-lg font-bold text-[#15323B]">Nenhum curso publicado ainda.</p>
              <p className="mt-3 text-sm text-[#5F7077]">
                {coursesError
                    ? 'Não foi possível carregar os cursos agora.'
                    : 'Assim que houver publicações, elas aparecerão aqui em ordem da mais recente para a mais antiga.'}
              </p>
            </div>)}
        </EditableContainer>
      </div>
    </section>);
}
export function PublicHomePage() {
    const { isLoading, user, roles } = useAuth();
    const waitingRoleResolution = !!user && roles.length === 0;
    const rawHomeSections = useEditableValue('home.layout.sections', homeLayoutFallback, { pageKey: 'home' });
    const homeSections = rawHomeSections.filter((section) => getHomeSectionMetadata(section).templateKey !== 'hero');
    if (isLoading || waitingRoleResolution) {
        return (<main className="flex min-h-screen items-center justify-center bg-[#10242B] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>);
    }
    const visibleSections = homeSections.filter(isEditableItemVisible);
    const templateOccurrences = new Map<string, number>();
    return (<main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader currentPage="home" navLinks={genflixNavLinks}/>
      <BannerPlacementSlot pageKey="home" placementKey="hero"/>

      <HomeStructureControl sections={homeSections}/>

      {visibleSections.map((section) => {
            const metadata = getHomeSectionMetadata(section);
            const templateKey = typeof metadata.templateKey === 'string' ? metadata.templateKey : 'categories';
            const occurrence = templateOccurrences.get(templateKey) ?? 0;
            templateOccurrences.set(templateKey, occurrence + 1);
            const entryPrefix = resolveHomeSectionPrefix(section, templateKey);
            const pageKey = resolveHomeSectionPageKey(section);
            if (templateKey === 'categories') {
                return <HomeCategoriesSection key={section.id} entryPrefix={entryPrefix} pageKey={pageKey}/>;
            }
            if (templateKey === 'featured') {
                return <HomeFeaturedSection key={section.id} entryPrefix={entryPrefix} sectionId={occurrence === 0 ? "destaques" : `destaques-${occurrence + 1}`} pageKey={pageKey}/>;
            }
            if (templateKey === 'cta' || templateKey === 'newsletter') {
                return null;
            }
            return null;
        })}

      <BannerPlacementSlot pageKey="home" placementKey="footer"/>
      <GenflixPublicFooter />
    </main>);
}
