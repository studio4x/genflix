import { useEffect, useState } from 'react'

import {
  defaultSiteTrackingSettings,
  fetchSiteTrackingSettings,
  SITE_PURCHASE_EVENT_NAME,
  type SitePurchaseTrackingEventDetail,
  type SiteTrackingSettings,
} from '@/features/site-editor/site-tracking'

function createScriptFromNode(source: HTMLScriptElement) {
  const script = document.createElement('script')
  for (const attribute of Array.from(source.attributes)) {
    script.setAttribute(attribute.name, attribute.value)
  }

  if (source.textContent) {
    script.text = source.textContent
  }

  return script
}

function appendParsedNodes(target: HTMLElement | HTMLHeadElement, html: string, beforeNode?: Node | null) {
  const template = document.createElement('template')
  template.innerHTML = html
  const insertedNodes: Node[] = []

  for (const node of Array.from(template.content.childNodes)) {
    let nextNode: Node

    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === 'script') {
      nextNode = createScriptFromNode(node as HTMLScriptElement)
    } else {
      nextNode = node.cloneNode(true)
    }

    if (beforeNode) {
      target.insertBefore(nextNode, beforeNode)
    } else {
      target.appendChild(nextNode)
    }

    insertedNodes.push(nextNode)
  }

  return () => {
    insertedNodes.forEach((node) => node.parentNode?.removeChild(node))
  }
}

function injectGtm(gtmId: string) {
  const containerId = gtmId.trim()
  if (!containerId) {
    return () => undefined
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`
  script.setAttribute('data-genflix-tracking', 'gtm')
  document.head.appendChild(script)

  const noscript = document.createElement('noscript')
  noscript.setAttribute('data-genflix-tracking', 'gtm-noscript')
  noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(containerId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`
  const bodyRoot = document.body.firstChild
  if (bodyRoot) {
    document.body.insertBefore(noscript, bodyRoot)
  } else {
    document.body.appendChild(noscript)
  }

  return () => {
    script.remove()
    noscript.remove()
  }
}

function injectMetaPixel(pixelId: string) {
  const normalizedPixelId = pixelId.trim()
  if (!normalizedPixelId) {
    return () => undefined
  }

  const inlineScript = document.createElement('script')
  inlineScript.setAttribute('data-genflix-tracking', 'meta-pixel')
  inlineScript.text = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${normalizedPixelId}');
    fbq('track', 'PageView');
  `
  document.head.appendChild(inlineScript)

  const noscript = document.createElement('noscript')
  noscript.setAttribute('data-genflix-tracking', 'meta-pixel-noscript')
  noscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${encodeURIComponent(normalizedPixelId)}&ev=PageView&noscript=1" alt="" />`
  const bodyRoot = document.body.firstChild
  if (bodyRoot) {
    document.body.insertBefore(noscript, bodyRoot)
  } else {
    document.body.appendChild(noscript)
  }

  return () => {
    inlineScript.remove()
    noscript.remove()
  }
}

function trackPurchaseEvent(detail: SitePurchaseTrackingEventDetail) {
  if (typeof window === 'undefined') {
    return
  }

  const purchasePayload = {
    transaction_id: detail.transactionId,
    value: detail.value,
    currency: detail.currency,
    items: [
      {
        item_id: detail.courseId,
        item_name: detail.courseTitle,
        quantity: 1,
        price: detail.value,
      },
    ],
  }

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({
      event: 'purchase',
      ecommerce: purchasePayload,
      genflix: {
        courseId: detail.courseId,
        courseTitle: detail.courseTitle,
      },
    })
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'purchase', purchasePayload)
  }

  if (typeof window.fbq === 'function') {
    window.fbq('track', 'Purchase', {
      content_type: 'product',
      content_ids: [detail.courseId],
      content_name: detail.courseTitle,
      currency: detail.currency,
      value: detail.value,
    })
  }
}

function injectCustomCode(target: HTMLElement | HTMLHeadElement, code: string, location: 'header' | 'body' | 'footer') {
  const normalizedCode = code.trim()
  if (!normalizedCode) {
    return () => undefined
  }

  const bodyAnchor = location === 'body' ? target.firstChild : null
  return appendParsedNodes(target, normalizedCode, bodyAnchor)
}

export function SiteTrackingInjector() {
  const [tracking, setTracking] = useState<SiteTrackingSettings>(defaultSiteTrackingSettings)

  useEffect(() => {
    let isMounted = true

    void fetchSiteTrackingSettings()
      .then((value) => {
        if (isMounted) {
          setTracking(value)
        }
      })
      .catch(() => {
        if (isMounted) {
          setTracking(defaultSiteTrackingSettings)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const cleanups = [
      injectGtm(tracking.gtmId),
      injectMetaPixel(tracking.metaPixelId),
      injectCustomCode(document.head, tracking.customHeaderCode, 'header'),
      injectCustomCode(document.body, tracking.customBodyCode, 'body'),
      injectCustomCode(document.body, tracking.customFooterCode, 'footer'),
    ]

    return () => {
      cleanups.reverse().forEach((cleanup) => cleanup())
    }
  }, [tracking.customBodyCode, tracking.customFooterCode, tracking.customHeaderCode, tracking.gtmId, tracking.metaPixelId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    function handlePurchaseEvent(event: Event) {
      const customEvent = event as CustomEvent<SitePurchaseTrackingEventDetail>
      const detail = customEvent.detail

      if (
        !detail ||
        typeof detail.courseId !== 'string' ||
        typeof detail.courseTitle !== 'string' ||
        typeof detail.currency !== 'string' ||
        typeof detail.transactionId !== 'string' ||
        typeof detail.value !== 'number' ||
        !Number.isFinite(detail.value) ||
        detail.value <= 0
      ) {
        return
      }

      trackPurchaseEvent(detail)
    }

    window.addEventListener(SITE_PURCHASE_EVENT_NAME, handlePurchaseEvent as EventListener)

    return () => {
      window.removeEventListener(SITE_PURCHASE_EVENT_NAME, handlePurchaseEvent as EventListener)
    }
  }, [])

  return null
}
