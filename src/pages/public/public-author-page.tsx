import { useEffect, useState } from 'react';
import { ArrowRight, Globe, Instagram, Linkedin, Youtube } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer';
import { GenflixPublicHeader } from '@/components/public/genflix-public-header';
import { BannerPlacementSlot } from '@/features/banners/banner-placement-slot';
import { fetchPublicAuthorProfileFromSupabase, type PublicAuthorProfile } from '@/features/public/genflix-public-content-api';
import { genflixNavLinks } from '@/features/public/genflix-site-content';

function socialLinkClassName() {
  return 'inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-4 py-2 text-sm font-semibold text-[#183139] transition hover:border-[#1398B7]/40 hover:text-[#0F7E99]';
}

export function PublicAuthorPage() {
  const { slug = '' } = useParams();
  const [profile, setProfile] = useState<PublicAuthorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setIsLoading(true);
      try {
        const authorProfile = await fetchPublicAuthorProfileFromSupabase(slug);
        if (isMounted) {
          setProfile(authorProfile);
        }
      } catch {
        if (isMounted) {
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (!isLoading && !profile) {
    return <Navigate to="/cursos" replace />;
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando autor...</p>
      </main>
    );
  }

  const hasSocialLinks = Boolean(profile.publicWebsiteUrl || profile.publicInstagramUrl || profile.publicLinkedinUrl || profile.publicYoutubeUrl);

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <GenflixPublicHeader currentPage="about" navLinks={genflixNavLinks} />
      <BannerPlacementSlot pageKey="about" placementKey="hero" />

      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#0D728E_0%,#0B667F_100%)] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_36%)]" />
        <div className="public-site-container relative py-14 lg:py-18">
          <div className="grid items-center gap-10 lg:grid-cols-[180px_minmax(0,1fr)]">
            <div className="flex justify-center lg:justify-start">
              {profile.publicPhotoUrl ? (
                <img
                  src={profile.publicPhotoUrl}
                  alt={profile.publicTitle}
                  className="h-40 w-40 rounded-[32px] border border-white/18 object-cover shadow-[0_18px_36px_rgba(5,24,32,0.2)] sm:h-44 sm:w-44"
                />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-[32px] bg-white/10 text-[2.1rem] font-black uppercase tracking-[0.12em] text-white shadow-[0_16px_32px_rgba(5,24,32,0.18)] backdrop-blur-sm sm:h-44 sm:w-44">
                  {(profile.publicTitle || profile.fullName || 'A').slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <p className="inline-flex rounded-full border border-white/18 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-white/82">
                Autor GenFlix
              </p>
              <h1 className="mt-4 break-words text-[2.8rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-white sm:text-[3.4rem] lg:text-[3.8rem]">
                {profile.publicTitle}
              </h1>
              {profile.publicShortBio ? (
                <p className="mt-4 max-w-3xl text-base leading-8 text-white/84">{profile.publicShortBio}</p>
              ) : null}
              {profile.publicAreas.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {profile.publicAreas.map((area) => (
                    <span key={area} className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/90">
                      {area}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="public-site-container">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-8">
              <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-[0_16px_40px_rgba(21,50,59,0.05)]">
                <h2 className="text-[1.4rem] font-bold tracking-[-0.03em] text-[#183139]">Sobre o autor</h2>
                <div className="mt-4 space-y-4 text-[15px] leading-8 text-[#5f7178]">
                  {profile.publicLongBio ? (
                    <p>{profile.publicLongBio}</p>
                  ) : profile.publicShortBio ? (
                    <p>{profile.publicShortBio}</p>
                  ) : (
                    <p>Perfil público em construção.</p>
                  )}
                </div>
              </article>

              <div className="grid gap-4 md:grid-cols-2">
                {profile.publicEducation ? (
                  <article className="rounded-[24px] border border-[#D8E6EB] bg-[#F8FCFD] p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Formação</p>
                    <p className="mt-3 text-sm leading-7 text-[#5f7178]">{profile.publicEducation}</p>
                  </article>
                ) : null}
                {profile.publicExperience ? (
                  <article className="rounded-[24px] border border-[#D8E6EB] bg-[#F8FCFD] p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Experiência</p>
                    <p className="mt-3 text-sm leading-7 text-[#5f7178]">{profile.publicExperience}</p>
                  </article>
                ) : null}
              </div>

              {profile.courses.length ? (
                <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-[0_16px_40px_rgba(21,50,59,0.05)]">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2 className="text-[1.4rem] font-bold tracking-[-0.03em] text-[#183139]">Cursos vinculados</h2>
                      <p className="mt-1 text-sm leading-6 text-[#6a7b81]">Cursos em que este autor participa como coautor de conteúdo.</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {profile.courses.map((course) => (
                      <article key={course.id} className="rounded-[22px] border border-[#D8E6EB] bg-[#F8FCFD] p-4">
                        <p className="text-sm font-semibold text-[#183139]">{course.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[#6a7b81]">{course.category ?? 'Curso'}</p>
                        <Link
                          to={`/cursos/${course.slug}`}
                          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1398B7] transition hover:text-[#0F7E99]"
                        >
                          <span>Abrir curso</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </article>
                    ))}
                  </div>
                </article>
              ) : null}
            </div>

            <aside className="space-y-5">
              <article className="rounded-[28px] border border-[#D8E6EB] bg-white p-6 shadow-[0_16px_40px_rgba(21,50,59,0.05)]">
                <h2 className="text-[1.4rem] font-bold tracking-[-0.03em] text-[#183139]">Contato e redes</h2>
                <div className="mt-5 space-y-3">
                  {profile.publicWebsiteUrl ? (
                    <a href={profile.publicWebsiteUrl} target="_blank" rel="noreferrer" className={socialLinkClassName()}>
                      <Globe className="h-4 w-4" />
                      Website
                    </a>
                  ) : null}
                  {profile.publicInstagramUrl ? (
                    <a href={profile.publicInstagramUrl} target="_blank" rel="noreferrer" className={socialLinkClassName()}>
                      <Instagram className="h-4 w-4" />
                      Instagram
                    </a>
                  ) : null}
                  {profile.publicLinkedinUrl ? (
                    <a href={profile.publicLinkedinUrl} target="_blank" rel="noreferrer" className={socialLinkClassName()}>
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </a>
                  ) : null}
                  {profile.publicYoutubeUrl ? (
                    <a href={profile.publicYoutubeUrl} target="_blank" rel="noreferrer" className={socialLinkClassName()}>
                      <Youtube className="h-4 w-4" />
                      YouTube
                    </a>
                  ) : null}
                  {!hasSocialLinks ? (
                    <p className="text-sm leading-7 text-[#6a7b81]">Nenhuma rede social foi informada ainda.</p>
                  ) : null}
                </div>
              </article>
            </aside>
          </div>
        </div>
      </section>

      <GenflixPublicFooter />
    </main>
  );
}
