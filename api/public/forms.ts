import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { getPublicAppUrl } from '../_shared/app-url.js'
import { sendNotificationEmail } from '../_shared/email.js'
import { queueUserNotification } from '../_shared/notifications.js'

type ApiRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

type ApiResponse = {
  status: (statusCode: number) => ApiResponse
  json: (payload: unknown) => void
  setHeader: (name: string, value: string) => void
}

type PublicFormSubmission = {
  id: string
  form_type: string
  name: string | null
  email: string | null
  message: string | null
  payload: Record<string, unknown>
  source_path: string | null
  source_url: string | null
  created_at: string
}

type AdminProfile = {
  id: string
  email: string | null
  full_name: string | null
}

type NotificationTemplate = {
  title: string
  body: string
}

const FORM_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const FORM_RATE_LIMIT_MAX_REQUESTS = 8
const formRateLimitStore = new Map<string, number[]>()

const publicFormSchema = z.object({
  form_type: z.string().trim().min(1).max(64),
  name: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  recipient_name: z.string().trim().max(200).optional().nullable(),
  recipient_email: z.string().trim().email().optional().nullable(),
  email_confirmation: z.string().trim().email().optional().nullable(),
  subject: z.string().trim().max(200).optional().nullable(),
  interest_areas: z.array(z.string().trim().min(1).max(120)).max(20).optional().nullable(),
  message: z.string().trim().max(4000).optional().nullable(),
  source_path: z.string().trim().max(2000).optional().nullable(),
  source_url: z.string().trim().max(2000).optional().nullable(),
})

function jsonResponse(res: ApiResponse, statusCode: number, payload: unknown) {
  res.status(statusCode)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.json(payload)
}

function getHeaderValue(value: string | string[] | undefined) {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0]
  }

  return null
}

function getRequestIp(req: ApiRequest) {
  const forwardedFor = getHeaderValue(req.headers['x-forwarded-for'])
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim()
    if (firstIp) {
      return firstIp
    }
  }

  const cloudflareIp = getHeaderValue(req.headers['cf-connecting-ip'])
  if (cloudflareIp?.trim()) {
    return cloudflareIp.trim()
  }

  const realIp = getHeaderValue(req.headers['x-real-ip'])
  if (realIp?.trim()) {
    return realIp.trim()
  }

  return 'unknown'
}

function isRateLimited(ip: string) {
  const now = Date.now()
  const timestamps = (formRateLimitStore.get(ip) ?? []).filter((timestamp) => now - timestamp < FORM_RATE_LIMIT_WINDOW_MS)
  timestamps.push(now)
  formRateLimitStore.set(ip, timestamps)

  if (formRateLimitStore.size > 10_000) {
    for (const [key, entries] of formRateLimitStore.entries()) {
      const hasRecentEntry = entries.some((timestamp) => now - timestamp < FORM_RATE_LIMIT_WINDOW_MS)
      if (!hasRecentEntry) {
        formRateLimitStore.delete(key)
      }
    }
  }

  return timestamps.length > FORM_RATE_LIMIT_MAX_REQUESTS
}

function parseBody(rawBody: unknown) {
  if (!rawBody) {
    return {}
  }

  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  return typeof rawBody === 'object' ? rawBody as Record<string, unknown> : {}
}

function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configuraçao ausente: Supabase URL e service role sao obrigatorios.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function normalizeField(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function formatFormTypeLabel(formType: string) {
  const labels: Record<string, string> = {
    contact: 'contato',
    teach: 'proposta de curso',
    newsletter: 'newsletter',
    lead: 'lead',
    support: 'suporte',
    refer: 'indicacao',
  }

  return labels[formType] ?? formType
}

function buildNotificationTemplate(input: z.infer<typeof publicFormSchema>): NotificationTemplate {
  const formLabel = formatFormTypeLabel(input.form_type)
  const name = normalizeField(input.name)
  const email = normalizeField(input.email)
  const subject = normalizeField(input.subject)
  const message = normalizeField(input.message)
  const recipientName = normalizeField(input.recipient_name)
  const recipientEmail = normalizeField(input.recipient_email)
  const interestAreas = Array.isArray(input.interest_areas)
    ? input.interest_areas.map((area) => area.trim()).filter((area) => area.length > 0)
    : []

  const titleMap: Record<string, string> = {
    contact: 'Novo formulário de contato recebido',
    teach: 'Nova proposta de curso recebida',
    newsletter: 'Novo cadastro na newsletter',
    lead: 'Novo lead recebido',
    support: 'Novo formulário de suporte recebido',
    refer: 'Nova indicacao recebida',
  }

  const title = titleMap[input.form_type] ?? 'Novo formulário recebido'

  const parts = [
    `Tipo: ${formLabel}`,
    name ? `Nome: ${name}` : null,
    email ? `E-mail: ${email}` : null,
    recipientName ? `Nome indicado: ${recipientName}` : null,
    recipientEmail ? `E-mail indicado: ${recipientEmail}` : null,
    interestAreas.length > 0 ? `Areas de interesse: ${interestAreas.join(', ')}` : null,
    subject ? `Assunto do curso: ${subject}` : null,
    message ? `Mensagem: ${message.slice(0, 280)}` : null,
    input.source_path ? `Origem: ${input.source_path}` : null,
  ].filter((part): part is string => Boolean(part))

  return {
    title,
    body: parts.length > 0 ? parts.join(' | ') : 'Novo formulário recebido pela plataforma.',
  }
}

async function notifyReferredContact(input: z.infer<typeof publicFormSchema>) {
  if (input.form_type !== 'refer') {
    return
  }

  const recipientEmail = normalizeField(input.recipient_email)
  if (!recipientEmail) {
    return
  }

  const recipientName = normalizeField(input.recipient_name)
  const referrerName = normalizeField(input.name)
  const referrerEmail = normalizeField(input.email)
  const customMessage = normalizeField(input.message)
  const publicAppUrl = getPublicAppUrl().replace(/\/$/, '')

  const title = `${referrerName ?? 'Um contato'} indicou a GenFlix para voce`
  const bodyLines = [
    `${referrerName ?? 'Alguem'} inseriu seu contato na plataforma GenFlix para voce conhecer os cursos e recursos disponiveis.`,
    referrerEmail ? `Contato de quem indicou: ${referrerEmail}` : null,
    customMessage ? `Mensagem enviada: ${customMessage}` : null,
  ].filter((line): line is string => Boolean(line))

  await sendNotificationEmail({
    to: recipientEmail,
    fullName: recipientName ?? undefined,
    title,
    body: bodyLines.join('\n\n'),
    actionUrl: `${publicAppUrl}/`,
    actionLabel: 'Conhecer a GenFlix',
  }).catch(() => null)
}

async function loadAdminProfiles(adminClient: SupabaseClient, fallbackEmail: string | null) {
  const roleRowsResult = await adminClient
    .from('user_roles')
    .select('user_id, roles(code)')

  if (roleRowsResult.error) {
    throw roleRowsResult.error
  }

  const adminUserIds = (roleRowsResult.data ?? [])
    .flatMap((row) => {
      const roleValue = (row as { roles?: { code?: string } | Array<{ code?: string }> | null }).roles
      if (!roleValue) {
        return []
      }

      const roles = Array.isArray(roleValue) ? roleValue : [roleValue]
      return roles.some((role) => role.code === 'admin') ? [(row as { user_id: string }).user_id] : []
    })

  const profileRowsResult = adminUserIds.length > 0
    ? await adminClient
      .from('profiles')
      .select('id, email, full_name')
      .in('id', adminUserIds)
    : { data: [], error: null as Error | null }

  if (profileRowsResult.error) {
    throw profileRowsResult.error
  }

  const adminProfiles = (profileRowsResult.data ?? []) as AdminProfile[]

  if (adminProfiles.length > 0) {
    return adminProfiles
  }

  if (!fallbackEmail) {
    return []
  }

  const fallbackProfileResult = await adminClient
    .from('profiles')
    .select('id, email, full_name')
    .ilike('email', fallbackEmail)
    .limit(1)

  if (fallbackProfileResult.error) {
    throw fallbackProfileResult.error
  }

  return (fallbackProfileResult.data ?? []) as AdminProfile[]
}

async function notifyAdmins(adminClient: SupabaseClient, submission: PublicFormSubmission, template: NotificationTemplate, adminEmail: string | null) {
  const adminProfiles = await loadAdminProfiles(adminClient, adminEmail)

  const notificationPromises = adminProfiles.map((profile) =>
    queueUserNotification(adminClient, {
      userId: profile.id,
      title: template.title,
      body: template.body,
      category: 'forms',
      priority: 'high',
      actionUrl: '/admin/formularios',
      channels: ['in-app'],
      metadata: {
        form_submission_id: submission.id,
        form_type: submission.form_type,
        source_path: submission.source_path,
        source_url: submission.source_url,
        submitted_by_email: submission.email,
      },
    }),
  )

  const results = await Promise.allSettled(notificationPromises)
  const notificationFailures = results.filter((result) => result.status === 'rejected')

  if (adminEmail) {
    await sendNotificationEmail({
      to: adminEmail,
      title: template.title,
      body: template.body,
      actionUrl: `${getPublicAppUrl().replace(/\/$/, '')}/admin/formularios`,
      actionLabel: 'Abrir formulários',
      fullName: 'Admin GenFlix',
    }).catch(() => null)
  }

  return {
    notifiedCount: results.length - notificationFailures.length,
    notificationFailures,
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Método não permitido.' })
    return
  }

  const requesterIp = getRequestIp(req)
  if (isRateLimited(requesterIp)) {
    jsonResponse(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' })
    return
  }

  let adminClient: SupabaseClient
  try {
    adminClient = createAdminClient()
  } catch (error) {
    jsonResponse(res, 500, { error: error instanceof Error ? error.message : 'Configuração do Supabase ausente.' })
    return
  }

  const body = parseBody(req.body)
  const parsed = publicFormSchema.safeParse(body)
  if (!parsed.success) {
    jsonResponse(res, 400, { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const honeypotWebsite = normalizeField(parsed.data.website)
  if (honeypotWebsite) {
    jsonResponse(res, 201, {
      id: null,
      notified_count: 0,
      admin_email_notified: false,
    })
    return
  }

  const submissionPayload = {
    form_type: parsed.data.form_type,
    name: normalizeField(parsed.data.name),
    email: normalizeField(parsed.data.email),
    recipient_name: normalizeField(parsed.data.recipient_name),
    recipient_email: normalizeField(parsed.data.recipient_email),
    email_confirmation: normalizeField(parsed.data.email_confirmation),
    subject: normalizeField(parsed.data.subject),
    interest_areas: Array.isArray(parsed.data.interest_areas) ? parsed.data.interest_areas.map((area) => area.trim()).filter((area) => area.length > 0) : [],
    message: normalizeField(parsed.data.message),
    source_path: normalizeField(parsed.data.source_path),
    source_url: normalizeField(parsed.data.source_url),
  }

  try {
    const { data: submission, error: insertError } = await adminClient
      .from('public_form_submissions')
      .insert({
        form_type: submissionPayload.form_type,
        name: submissionPayload.name,
        email: submissionPayload.email,
        message: submissionPayload.message,
        payload: submissionPayload,
        source_path: submissionPayload.source_path,
        source_url: submissionPayload.source_url,
      })
      .select('id, form_type, name, email, message, payload, source_path, source_url, created_at')
      .single()

    if (insertError) {
      throw insertError
    }

    const submissionRecord = submission as PublicFormSubmission
    const template = buildNotificationTemplate(parsed.data)
    const adminSettingsResult = await adminClient
      .from('notification_admin_settings')
      .select('admin_notification_email')
      .eq('id', 1)
      .maybeSingle()

    if (adminSettingsResult.error) {
      throw adminSettingsResult.error
    }

    const adminNotificationEmail = normalizeField(adminSettingsResult.data?.admin_notification_email ?? null)

    const notificationResult = await notifyAdmins(adminClient, submissionRecord, template, adminNotificationEmail)
    await notifyReferredContact(parsed.data)

    jsonResponse(res, 201, {
      id: submissionRecord.id,
      notified_count: notificationResult.notifiedCount,
      admin_email_notified: Boolean(adminNotificationEmail),
    })
  } catch (error) {
    jsonResponse(res, 500, {
      error: error instanceof Error ? error.message : 'Não foi possível registrar o formulário.',
    })
  }
}

