import { ArrowRight, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/app/providers/auth-provider'
import { GenflixNewsletterSection } from '@/components/public/genflix-newsletter-section'
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer'
import { GenflixPublicHeader } from '@/components/public/genflix-public-header'
import {
  genflixNavLinks,
  genflixResourceItems,
  type GenflixResourceItem,
} from '@/features/public/genflix-site-content'

interface ResourcePopupContent {
  title: string
  lead?: string
  paragraphs: string[]
  bullets?: string[]
}

const exercisePopupContent: ResourcePopupContent = {
  title: 'Exercícios? Temos de todos os tipos',
  paragraphs: [
    'Nas outras plataformas, os exercícios são estáticos e com pouca variedade — geralmente apenas múltipla escolha. Na GenFlix é diferente. Aqui você encontra uma variedade quase infinita de tipos de exercícios, cada um desenhado para testar seu conhecimento de formas diferentes e manter o aprendizado dinâmico e desafiador.',
  ],
  bullets: [
    'Questões discursivas',
    'Múltipla escolha',
    'Estudos de casos resolvidos',
    'Gamificação',
    'Arrastar e soltar',
    'Colorir',
    'Preencher lacunas',
    'Questões de concursos',
  ],
}

const resourcePopupContents: Record<string, ResourcePopupContent> = {
  'Textos diretos ao ponto': {
    title: 'Cursos diretos ao ponto',
    paragraphs: [
      'Aulas longas e cheias de redundâncias não funcionam mais. Nossos cursos trazem conteúdos objetivos, diretos ao ponto, sem blá-blá-blá.',
      'Cada parágrafo tem propósito, cada vídeo ou recurso didático agrega valor. Você aprende mais em menos tempo, sem distrações ou informações desnecessárias, focado apenas no essencial.',
    ],
  },
  'Texto para fala': {
    title: 'Texto para fala',
    paragraphs: [
      'Na plataforma GenFlix você pode ler ou ouvir a aula. Além de possibilitar o estudo durante deslocamentos, alternar entre texto e áudio favorece diferentes estilos de aprendizagem, ajudando na compreensão e na memorização do conteúdo.',
      'Com isso, o estudo torna-se mais dinâmico, personalizado e inclusivo, contribuindo para um melhor aproveitamento dos seus cursos.',
    ],
  },
  'Vídeos': {
    title: 'Vídeos? Claro, mas não apenas',
    paragraphs: [
      'Vídeos são fundamentais, mas funcionam melhor quando intercalados com outros recursos didáticos. Textos, áudios, mapas mentais, flashcards e outras ferramentas quebram a monotonia, mantêm sua atenção e facilitam o aprendizado.',
      'Na plataforma GenFlix, essa combinação de recursos garante um estudo dinâmico e eficaz, com máxima retenção do conteúdo.',
    ],
  },
  'Lives com autores': {
    title: 'Aulas ao vivo',
    paragraphs: [
      'A plataforma GenFlix oferece um meio próprio para transmissão de aulas ao vivo. Alguns cursos dispõem desse recurso, outros não, e a disponibilidade de aulas ao vivo está indicada na lista de ferramentas didáticas de cada curso.',
    ],
  },
  'Bloco de notas pessoais': {
    title: 'Bloco de notas virtual',
    lead: 'Papel? Para que papel?',
    paragraphs: [
      'Na plataforma GenFlix você pode fazer suas anotações diretamente no bloco de notas existente em cada aula. Isso torna o estudo mais organizado e centralizado.',
      'Organizado, sempre disponível.',
    ],
  },
  'Fóruns de discussão': {
    title: 'Comunidades ou fóruns de discussão',
    paragraphs: [
      'Os cursos da plataforma GenFlix têm comunidades ou fóruns de discussão segmentados por assunto. Já pensou que maravilha poder sanar dúvidas ou trocar experiências com outros estudantes que estão fazendo o mesmo curso que você?',
    ],
  },
  'Descontos em livros do GEN': {
    title: 'Descontos em livros do GEN',
    paragraphs: [
      'Ao inscrever-se em um curso no GenFlix você automaticamente ganha desconto para compras de livros do GEN diretamente relacionados com a área do curso adquirido.',
      'Para quem não sabe: o GEN | Grupo Editorial Nacional é o maior conglomerado brasileiro de grandes editoras acadêmicas, como Guanabara Koogan, LTC, Método, Forense e Saraiva, entre outras.',
      'Esse desconto, para ficar claro, não é cumulativo com os que já estejam sendo praticados no site do GEN.',
    ],
  },
  Flashcards: {
    title: 'Flashcards',
    paragraphs: [
      'Junto com mapas mentais e resumões, os flashcards são uma das ferramentas de estudo mais eficazes para revisões rápidas e preparação para provas. Eles ajudam você a testar sua memória, identificar pontos fracos do conhecimento e transformar o estudo em um processo ativo, dinâmico e eficaz.',
      'E, claro, todo curso da plataforma GenFlix vem com uma grande quantidade de flashcards prontos para você usar.',
    ],
  },
  'Mapas mentais': {
    title: 'Mapas mentais',
    paragraphs: [
      'Se você gosta de mapas mentais ou conceituais, chegou ao lugar certo. Na plataforma GenFlix você encontra uma grande quantidade deles para baixar e usar nos seus estudos.',
    ],
  },
  Podcasts: {
    title: 'Podcasts',
    paragraphs: [
      'Nos podcasts da plataforma GenFlix os autores dos cursos trazem exemplos práticos, curiosidades e comentam estudos de casos. É um recurso dinâmico e acessível que enriquece seu aprendizado, permitindo que você estude enquanto se desloca ou realiza outras atividades.',
      'Nem todos os cursos têm podcasts, mas quando disponíveis, você encontra essa informação na página de abertura de cada curso.',
    ],
  },
  Resumos: {
    title: 'Resumões',
    paragraphs: [
      'Ao final de cada módulo ou grupo de aulas há um "resumão" com os pontos-chave do assunto em formato de tópicos.',
      'Esses resumos possibilitam revisões rápidas, ajudam na fixação do aprendizado e são especialmente úteis na preparação para provas.',
    ],
  },
  'Questões discursivas': exercisePopupContent,
  'Estudos de casos': exercisePopupContent,
  'Múltipla escolha': exercisePopupContent,
  'Exercícios de progressão': exercisePopupContent,
  'Preenchimento de lacunas': exercisePopupContent,
}

function buildFallbackPopupContent(item: GenflixResourceItem): ResourcePopupContent {
  return {
    title: item.label,
    paragraphs: [item.description],
  }
}

function ResourcePopup({
  item,
  onClose,
}: {
  item: GenflixResourceItem
  onClose: () => void
}) {
  const Icon = item.icon
  const content = resourcePopupContents[item.label] ?? buildFallbackPopupContent(item)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#061b21]/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resource-popup-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="relative flex max-h-[92vh] w-full max-w-[1040px] overflow-hidden border border-[#0f5b64]/40 bg-white shadow-[0_30px_80px_rgba(6,27,33,0.26)] md:min-h-[650px]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#D8E6EB] bg-white text-[#1d3d45] shadow-sm transition hover:bg-[#E8F6FA]"
          aria-label="Fechar popup"
        >
          <X className="h-5 w-5" />
        </button>

        <aside className="hidden w-[285px] shrink-0 flex-col justify-between bg-gradient-to-b from-[#075a67] to-[#042f38] px-10 py-14 text-white md:flex">
          <div>
            <div className="flex h-32 w-32 items-center justify-center text-[#46ff2f]">
              <Icon className="h-24 w-24 stroke-[1.4]" />
            </div>
            <div className="mt-20 flex gap-2">
              {Array.from({ length: 14 }).map((_, index) => (
                <span key={index} className="h-1 w-1 rounded-full bg-white/95" />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative h-16 w-20">
              <span className="absolute left-3 top-2 h-11 w-11 rounded-full border-2 border-white/95" />
              <span className="absolute left-8 top-0 h-11 w-11 rounded-full border-2 border-white/95" />
              <span className="absolute left-8 top-5 h-11 w-11 rounded-full border-2 border-white/95" />
            </div>
            <p className="font-readex text-3xl font-medium tracking-[-0.04em] text-white">GenFlix</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto px-7 py-16 sm:px-12 md:px-16 md:py-20">
          <div className="mx-auto max-w-[620px]">
            <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#075a67] text-[#46ff2f] md:hidden">
              <Icon className="h-9 w-9 stroke-[1.5]" />
            </div>

            <h2
              id="resource-popup-title"
              className="text-center font-readex text-3xl font-medium leading-tight tracking-[0.08em] text-[#075a67] sm:text-4xl"
            >
              {content.title}
            </h2>

            <div className="mx-auto mt-14 flex max-w-[420px] justify-center gap-2">
              {Array.from({ length: 24 }).map((_, index) => (
                <span key={index} className="h-1 w-1 rounded-full bg-[#17383f]" />
              ))}
            </div>

            <div className="mt-16 space-y-8 text-[1.65rem] font-light leading-[1.58] tracking-[-0.035em] text-[#292929]">
              {content.lead ? <p>{content.lead}</p> : null}
              {content.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}

              {content.bullets?.length ? (
                <ul className="grid gap-3 pt-1 text-[1.25rem] leading-relaxed sm:grid-cols-2">
                  {content.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#075a67]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export function PublicResourcesPage() {
  const { isLoading, user, roles } = useAuth()
  const [selectedResourceLabel, setSelectedResourceLabel] = useState<string | null>(null)
  const waitingRoleResolution = !!user && roles.length === 0
  const selectedResource = useMemo(
    () => genflixResourceItems.find((item) => item.label === selectedResourceLabel) ?? null,
    [selectedResourceLabel],
  )

  useEffect(() => {
    if (!selectedResource) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedResourceLabel(null)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedResource])

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
          <GenflixPublicHeader currentPage="resources" navLinks={genflixNavLinks} />
        </div>
      </section>

      <section className="bg-white pb-16 pt-6">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10">
          <div className="mx-auto max-w-[680px] text-center">
            <h1 className="text-[2.35rem] font-extrabold leading-[0.96] tracking-[-0.05em] text-[#183139] sm:text-[2.8rem]">
              Muito além do vídeo
            </h1>
            <p className="mx-auto mt-4 max-w-[560px] text-base leading-7 text-[#61737a]">
              Ferramentas pensadas para você aprender, fixar e revisar do seu jeito.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {genflixResourceItems.map((item) => {
              const Icon = item.icon

              return (
                <button
                  type="button"
                  key={item.label}
                  onClick={() => setSelectedResourceLabel(item.label)}
                  className="group rounded-[18px] border border-[#D8E6EB] bg-[#F2F7F9] px-5 py-5 text-left shadow-[0_16px_36px_rgba(21,50,59,0.04)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(19,152,183,0.12)] focus:outline-none focus:ring-4 focus:ring-[#1398B7]/18"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8F6FA] text-[#1398B7]">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-[#1398B7] transition-transform group-hover:translate-x-1">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>

                  <h2 className="mt-5 text-[1rem] font-bold leading-6 text-[#183139]">{item.label}</h2>
                  <p className="mt-3 text-sm leading-7 text-[#667980]">{item.description}</p>
                </button>
              )
            })}
          </div>

          <div className="mt-12 flex justify-center">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full bg-[#1398B7] px-5 py-3 font-readex text-sm font-medium text-white shadow-[0_12px_30px_rgba(19,152,183,0.24)] transition-colors hover:bg-[#0A3640]"
            >
              Entrar para explorar tudo
            </Link>
          </div>
        </div>
      </section>

      <GenflixNewsletterSection />
      <GenflixPublicFooter />
      {selectedResource ? (
        <ResourcePopup item={selectedResource} onClose={() => setSelectedResourceLabel(null)} />
      ) : null}
    </main>
  )
}
