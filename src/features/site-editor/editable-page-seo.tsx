import { useEffect } from 'react'

import { useEditableValue, useSiteContentScope, useVisualEditorState } from '@/features/site-editor/visual-editor'
import type { SitePageKey } from '@/features/site-editor/types'

type SeoValue = {
  title: string
  description: string
  slug: string
  image: string
}

function ensureMetaTag(attribute: 'name' | 'property', value: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${value}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, value)
    document.head.appendChild(element)
  }

  return element
}

function ensureLinkTag(rel: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.rel = rel
    document.head.appendChild(element)
  }

  return element
}

function normalizeSeoValue(value: Record<string, unknown>, fallback: SeoValue): SeoValue {
  return {
    title: typeof value.title === 'string' && value.title.trim() !== '' ? value.title : fallback.title,
    description: typeof value.description === 'string' && value.description.trim() !== '' ? value.description : fallback.description,
    slug: typeof value.slug === 'string' && value.slug.trim() !== '' ? value.slug : fallback.slug,
    image: typeof value.image === 'string' && value.image.trim() !== '' ? value.image : fallback.image,
  }
}

export function EditablePageSeo({
  pageKey,
  entryKey,
  fallback,
  label = 'SEO da página',
}: {
  pageKey: SitePageKey
  entryKey: string
  fallback: SeoValue
  label?: string
}) {
  const editor = useVisualEditorState()
  const scope = useSiteContentScope()
  const seoValue = useEditableValue(entryKey, fallback, { pageKey }) as Record<string, unknown>
  const seo = normalizeSeoValue(seoValue, fallback)

  useEffect(() => {
    document.title = seo.title

    const description = ensureMetaTag('name', 'description')
    description.content = seo.description

    const ogTitle = ensureMetaTag('property', 'og:title')
    ogTitle.content = seo.title

    const ogDescription = ensureMetaTag('property', 'og:description')
    ogDescription.content = seo.description

    const twitterTitle = ensureMetaTag('name', 'twitter:title')
    twitterTitle.content = seo.title

    const twitterDescription = ensureMetaTag('name', 'twitter:description')
    twitterDescription.content = seo.description

    const resolvedSlug = seo.slug.startsWith('/') ? seo.slug : window.location.pathname
    const canonicalUrl = new URL(resolvedSlug, window.location.origin).toString()

    const canonical = ensureLinkTag('canonical')
    canonical.href = canonicalUrl

    const ogUrl = ensureMetaTag('property', 'og:url')
    ogUrl.content = canonicalUrl

    const twitterCard = ensureMetaTag('name', 'twitter:card')
    twitterCard.content = seo.image ? 'summary_large_image' : 'summary'

    if (seo.image) {
      const ogImage = ensureMetaTag('property', 'og:image')
      ogImage.content = seo.image

      const twitterImage = ensureMetaTag('name', 'twitter:image')
      twitterImage.content = seo.image
    }
  }, [seo.description, seo.image, seo.slug, seo.title])

  if (!editor?.isEditing || !scope) {
    return null
  }

  return (
    <div className="fixed left-5 top-20 z-[110]">
      <button
        type="button"
        onClick={() => editor.openEditor({
          pageKey,
          entryKey,
          entryType: 'json',
          label,
          fallback: seo,
          schema: { kind: 'seo' },
          reload: scope.reload,
        })}
        className="inline-flex items-center gap-2 rounded-full border border-[#D8E6EB] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#163138] shadow-[0_18px_40px_rgba(6,27,33,0.08)] hover:bg-[#F2F7F9]"
      >
        Configurar SEO da página
      </button>
    </div>
  )
}
