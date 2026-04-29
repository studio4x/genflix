import {
  Facebook,
  Instagram,
  Linkedin,
  MessageCircleMore,
  MonitorPlay,
} from 'lucide-react'

import type {
  GenflixFooterColumn,
  GenflixFooterNavItem,
  GenflixNavLink,
  GenflixSocialLink,
} from '@/features/public/genflix-public-types'

export const genflixNavLinks: GenflixNavLink[] = [
  { label: 'InÃ­cio', href: '/', isInternal: true, pageKey: 'home' },
  { label: 'Cursos', href: '/cursos', isInternal: true, pageKey: 'courses' },
  { label: 'Blog', href: '/blog', isInternal: true, pageKey: 'blog' },
  { label: 'Contato', href: '/contato', isInternal: true, pageKey: 'contact' },
  { label: 'Sobre', href: '/sobre', isInternal: true, pageKey: 'about' },
  { label: 'Recursos', href: '/recursos', isInternal: true, pageKey: 'resources' },
  { label: 'Comunidade', href: '/comunidade', isInternal: true, pageKey: 'community', requiresAuth: true },
]

export const genflixFooterNavLinks: GenflixFooterNavItem[] = [
  { label: 'InÃ­cio', href: '/', isInternal: true },
  { label: 'Sobre', href: '/sobre', isInternal: true },
  { label: 'Recursos', href: '/recursos', isInternal: true },
  { label: 'Cursos', href: '/cursos', isInternal: true },
  { label: 'Blog', href: '/blog', isInternal: true },
  { label: 'Contato', href: '/contato', isInternal: true },
  { label: 'Comunidade', href: '/comunidade', isInternal: true },
]

export const genflixFooterColumns: GenflixFooterColumn[] = [
  {
    title: 'Links RÃ¡pidos',
    items: [
      { label: 'PolÃ­tica de privacidade', href: '/privacidade', isInternal: true },
      { label: 'PolÃ­tica de reembolso', href: '/politica-de-reembolso', isInternal: true },
      { label: 'Perguntas frequentes', href: '/suporte#perguntas-frequentes', isInternal: true },
      { label: 'Ajuda / Como usar', href: '/ajuda', isInternal: true },
    ],
  },
  {
    title: 'Fale com a GenFlix',
    items: [
      { label: 'Contato', href: '/contato', isInternal: true },
      { label: 'Cadastro', href: '/criar-conta', isInternal: true },
    ],
  },
  {
    title: 'Conecte-se',
    items: [
      { label: 'Instagram', href: 'https://instagram.com', openInNewTab: true },
      { label: 'Facebook', href: 'https://facebook.com', openInNewTab: true },
      { label: 'TikTok', href: 'https://tiktok.com', openInNewTab: true },
      { label: 'Linkedin', href: 'https://linkedin.com', openInNewTab: true },
      { label: 'Youtube', href: 'https://youtube.com', openInNewTab: true },
      { label: 'Indique a GenFlix', href: '/indique-a-genflix', isInternal: true },
    ],
  },
  {
    title: 'Parcerias',
    items: [
      {
        label: 'Ensine na GenFlix',
        href: '/ensine-na-genflix',
        isInternal: true,
        buttonLabel: 'Ensine na GenFlix',
      },
    ],
  },
]

export const genflixSocialLinks: GenflixSocialLink[] = [
  { label: 'Instagram', href: 'https://instagram.com', icon: Instagram },
  { label: 'Facebook', href: 'https://facebook.com', icon: Facebook },
  { label: 'TikTok', href: 'https://tiktok.com', icon: MessageCircleMore },
  { label: 'LinkedIn', href: 'https://linkedin.com', icon: Linkedin },
  { label: 'YouTube', href: 'https://youtube.com', icon: MonitorPlay },
]
