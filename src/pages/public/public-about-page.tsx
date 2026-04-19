import { useAuth } from '@/app/providers/auth-provider'
import { GenflixLogo } from '@/components/public/genflix-logo'
import { GenflixNewsletterSection } from '@/components/public/genflix-newsletter-section'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import { genflixNavLinks } from '@/features/public/genflix-site-content'
import { EditableList, EditableText, useEditableValue } from '@/features/site-editor/visual-editor'

const aboutParagraphs = [
  'Há quem prefira abrir o livro, sublinhar, fazer anotações e avançar página por página. Há também quem se envolva mais com vídeos, aulas curtas e recursos interativos.',
  'A plataforma GenFlix nasce para unir esses dois mundos e ir além.',
  'GenFlix é uma plataforma que reúne cursos, aulas e conteúdos digitais criados por especialistas e professores, com a curadoria e a qualidade editorial do GENI Grupo Editorial Nacional, maior conglomerado editorial de publicações acadêmicas e que reúne editoras como Guanabara Koogan, LTC, Forense e Saraiva, referências na formação de professores e profissionais.',
  'Agora, esse conhecimento ganha uma experiência digital completa.',
  'A GenFlix é fruto de uma parceria entre o GEN e a e-Clix Soluções em Conteúdo Educacional, comandada por uma equipe com mais de 50 anos de atuação no desenvolvimento de conteúdos educacionais e projetos de aprendizagem para organizações no Brasil e no exterior.',
  'O resultado é uma plataforma construída sobre três pilares essenciais: conteúdo confiável e atual, experiência digital moderna e intuitiva e aplicação prática do conhecimento.',
  'Na GenFlix, aprender vai muito além de assistir a vídeos. A plataforma integra uma ampla variedade de recursos didáticos contemporâneos, pensados para facilitar a compreensão, manter o ritmo de estudo, reduzir a evasão e transformar conteúdo em conhecimento útil no dia a dia acadêmico e profissional.',
  'Tudo isso com um propósito central que consideramos ser a nossa missão.',
]

export function PublicAboutPage() {
  const { isLoading, user, roles } = useAuth()
  const waitingRoleResolution = !!user && roles.length === 0
  const editableParagraphs = useEditableValue(
    'about.paragraphs',
    aboutParagraphs.map((paragraph, index) => ({
      id: `paragraph-${index + 1}`,
      description: paragraph,
    })),
  )

  if (isLoading || waitingRoleResolution) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F2F7F9] font-manrope text-[#163138]">
      <section className="bg-[#F2F7F9]">
        <div className="mx-auto max-w-[1440px] px-4 lg:px-6">
          <GenflixPublicHeader currentPage="about" navLinks={genflixNavLinks} />
        </div>
      </section>

      <section className="bg-white pb-10 pt-8">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
          <div className="rounded-[30px] bg-[#F2F7F9] px-8 py-14 text-center shadow-[0_20px_44px_rgba(21,50,59,0.04)] sm:px-12">
            <h1 className="text-[2.65rem] font-extrabold leading-[0.94] tracking-[-0.05em] text-[#183139] sm:text-[3rem]">
              <EditableText entryKey="about.hero.title" fallback="GenFlix" label="Título da página Sobre" />
            </h1>
            <p className="mt-4 text-base font-medium text-[#1398B7]">
              <EditableText
                entryKey="about.hero.subtitle"
                fallback="Porque aprender e ensinar não precisa ser complicado."
                label="Subtítulo da página Sobre"
              />
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white pb-16 pt-4">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
          <div className="rounded-[28px] border border-[#D8E6EB] bg-white px-8 py-10 shadow-[0_18px_42px_rgba(21,50,59,0.03)] sm:px-10 lg:px-12">
            <div className="mx-auto max-w-[960px] space-y-5 border-t border-[#BEE3EA] pt-10 text-[15px] leading-8 text-[#4f666d]">
              <EditableList entryKey="about.paragraphs" fallback={editableParagraphs} label="Parágrafos da página Sobre">
                {(items) => items.map((item) => (
                  <p key={item.id}>{item.description}</p>
                ))}
              </EditableList>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white pb-20">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
          <div className="grid gap-8 overflow-hidden rounded-[30px] bg-[#F2F7F9] px-8 py-8 shadow-[0_22px_46px_rgba(21,50,59,0.05)] lg:grid-cols-[360px_minmax(0,1fr)] lg:items-center lg:px-10 lg:py-10">
            <div className="flex min-h-[240px] items-center justify-center rounded-[24px] bg-white shadow-[0_18px_40px_rgba(21,50,59,0.06)]">
              <div className="scale-[2.3]">
                <GenflixLogo />
              </div>
            </div>

            <div className="max-w-[520px]">
              <h2 className="text-[2rem] font-bold tracking-[-0.04em] text-[#183139] sm:text-[2.2rem]">
                <EditableText entryKey="about.mission.title" fallback="Nossa missão" label="Título da missão" />
              </h2>
              <p className="mt-4 text-[15px] leading-8 text-[#5f7178]">
                <EditableText
                  entryKey="about.mission.description"
                  fallback="Oferecer a estudantes universitários, concurseiros e profissionais conteúdos modernos, objetivos, práticos, de qualidade e a preços adequados, com materiais que proporcionem compreensão rápida e efetiva daquilo que os usuários desejam aprender."
                  label="Descrição da missão"
                />
              </p>
              <p className="mt-5 text-sm font-semibold text-[#1398B7]">
                <EditableText
                  entryKey="about.mission.tagline"
                  fallback="Porque aprender e ensinar não precisa ser complicado."
                  label="Frase final da missão"
                />
              </p>
              <div className="mt-7 h-px w-full max-w-[260px] bg-[#8FCAD8]" />
            </div>
          </div>
        </div>
      </section>

      <GenflixNewsletterSection />
      <GenflixPublicFooter />
    </main>
  )
}
