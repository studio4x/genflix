import type { LucideIcon } from 'lucide-react'

export type GenflixPageKey = 'home' | 'courses' | 'about' | 'blog' | 'contact' | 'community' | 'resources'

export interface GenflixNavLink {
  label: string
  href: string
  isInternal?: boolean
  pageKey?: GenflixPageKey
  requiresAuth?: boolean
}

export interface GenflixCategoryItem {
  label: string
  icon: LucideIcon
}

export interface GenflixCourseItem {
  id?: string
  slug: string
  title: string
  category: string
  mentor: string
  role: string
  image: string
  mentorImage?: string
  initials: string
}

export interface GenflixFeatureItem {
  title: string
  description: string
  icon: LucideIcon
}

export interface GenflixFooterColumn {
  title: string
  items: Array<{
    label: string
    href: string
    isInternal?: boolean
    openInNewTab?: boolean
    buttonLabel?: string
  }>
}

export interface GenflixSocialLink {
  label: string
  href: string
  icon: LucideIcon
}

export interface GenflixFooterNavItem {
  label: string
  href: string
  isInternal?: boolean
}

export interface GenflixCourseOutcome {
  title: string
  description: string
}

export interface GenflixCourseModule {
  title: string
  lessonCount: number
  summary: string
  items?: string[]
  lessonLabel?: string
}

export interface GenflixCourseDetail {
  id?: string
  slug: string
  categoryLine: string
  title: string
  coverImage: string
  description: string
  aboutParagraphs: string[]
  outcomes: GenflixCourseOutcome[]
  syllabus: GenflixCourseModule[]
  mentor: {
    name: string
    role: string
    bio: string
    initials: string
  }
  priceLabel: string
  secondaryPriceLabel: string
  includedItems: string[]
}

export interface GenflixBlogPost {
  slug: string
  title: string
  category: string
  excerpt: string
  image: string
  readTime: string
  author: string
  publishedAt: string
  content: string[]
  featured?: boolean
}

export interface GenflixCommunityItem {
  label: string
  icon: LucideIcon
  description: string
}

export interface GenflixResourceItem {
  label: string
  icon: LucideIcon
  description: string
}
