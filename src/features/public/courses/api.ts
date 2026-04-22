import { publicSupabase } from '@/services/supabase/public-client'
import {
  isLegacyCourseSalesSchemaError,
  withLegacyCourseSalesDefaults,
} from '@/features/courses/schema-compat'
import type { Course } from '@/types/content'

export async function fetchPublicCatalogCourses(): Promise<Course[]> {
  const result = await publicSupabase
    .from('courses')
    .select('*')
    .eq('status', 'published')
    .eq('is_public', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (result.error && isLegacyCourseSalesSchemaError(result.error)) {
    const legacyResult = await publicSupabase
      .from('courses')
      .select('*')
      .eq('status', 'published')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (legacyResult.error) {
      throw legacyResult.error
    }

    return ((legacyResult.data as Course[]) ?? []).map(withLegacyCourseSalesDefaults)
  }

  if (result.error) {
    throw result.error
  }

  return ((result.data as Course[]) ?? []).map(withLegacyCourseSalesDefaults)
}

export type StartCourseCheckoutBuyer = {
  buyerName?: string
  buyerEmail?: string
}

export async function startCourseCheckout(
  courseId: string,
  accessToken: string,
  buyer?: StartCourseCheckoutBuyer,
) {
  const response = await fetch('/api/checkout/asaas/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      courseId,
      buyerName: buyer?.buyerName,
      buyerEmail: buyer?.buyerEmail,
    }),
  })

  const payload = await response.json().catch(() => null) as { error?: string; checkoutUrl?: string } | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Não foi possível iniciar o checkout.')
  }

  if (!payload?.checkoutUrl) {
    throw new Error('Checkout gerado sem URL de redirecionamento.')
  }

  return payload.checkoutUrl
}
