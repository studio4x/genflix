export type SiteTextFontPreset = {
  label: string
  family: string
  sample: string
  description: string
}

export const SITE_TEXT_FONT_PRESETS: SiteTextFontPreset[] = [
  {
    label: 'Manrope',
    family: 'Manrope, sans-serif',
    sample: 'Limpo e versatil',
    description: 'Boa para texto corrido e interfaces.',
  },
  {
    label: 'Readex Pro',
    family: 'Readex Pro, sans-serif',
    sample: 'Mais editorial',
    description: 'Funciona bem em chamadas e subtitulos.',
  },
  {
    label: 'Inter',
    family: 'Inter, sans-serif',
    sample: 'Neutro e legivel',
    description: 'Otima para paginas com muito conteudo.',
  },
  {
    label: 'Montserrat',
    family: 'Montserrat, sans-serif',
    sample: 'Moderna e firme',
    description: 'Boa para titulos com presenca forte.',
  },
  {
    label: 'Poppins',
    family: 'Poppins, sans-serif',
    sample: 'Curva e amigavel',
    description: 'Ajuda a dar tom leve e humano ao texto.',
  },
  {
    label: 'Playfair Display',
    family: 'Playfair Display, serif',
    sample: 'Serif elegante',
    description: 'Perfeita para destaques e titulos editoriais.',
  },
] as const
