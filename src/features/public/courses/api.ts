import { publicSupabase } from '@/services/supabase/public-client'
import type { Course } from '@/types/content'

export async function fetchPublicCatalogCourses(): Promise<Course[]> {
  const result = await publicSupabase
    .from('courses')
    .select('*')
    .eq('status', 'published')
    .eq('is_public', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data as Course[]) ?? []
}

export async function startCourseCheckout(courseId: string, accessToken: string) {
  const response = await fetch('/api/checkout/asaas/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ courseId }),
  })

  const payload = await response.json().catch(() => null) as { error?: string; checkoutUrl?: string } | null

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Nao foi possivel iniciar o checkout.')
  }

  if (!payload?.checkoutUrl) {
    throw new Error('Checkout gerado sem URL de redirecionamento.')
  }

  return payload.checkoutUrl
}
