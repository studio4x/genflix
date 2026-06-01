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
    label: 'DM Sans',
    family: 'DM Sans, sans-serif',
    sample: 'Equilibrado e leve',
    description: 'Boa leitura em blocos curtos e UI.',
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
    description: 'Otima para p?ginas com muito conte?do.',
  },
  {
    label: 'Montserrat',
    family: 'Montserrat, sans-serif',
    sample: 'Moderna e firme',
    description: 'Boa para titulos com presenca forte.',
  },
  {
    label: 'Oswald',
    family: 'Oswald, sans-serif',
    sample: 'Alto contraste',
    description: 'Boa para destaque compacto e forte.',
  },
  {
    label: 'Poppins',
    family: 'Poppins, sans-serif',
    sample: 'Curva e amigavel',
    description: 'Ajuda a dar tom leve e humano ao texto.',
  },
  {
    label: 'Lora',
    family: 'Lora, serif',
    sample: 'Serif editorial',
    description: 'Boa para leitura longa e p?ginas legais.',
  },
  {
    label: 'Merriweather',
    family: 'Merriweather, serif',
    sample: 'Clara e robusta',
    description: 'Funciona bem em textos extensos.',
  },
  {
    label: 'Playfair Display',
    family: 'Playfair Display, serif',
    sample: 'Serif elegante',
    description: 'Perfeita para destaques e titulos editoriais.',
  },
] as const
