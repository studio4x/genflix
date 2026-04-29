import { supabase } from '@/services/supabase/client'

import {
  defaultSupportBusinessHoursConfig,
  defaultSupportCrisisProtocolConfig,
  defaultSupportSlaConfig,
} from '@/lib/support-sla'
import type {
  SupportBusinessHoursConfig,
  SupportCrisisProtocolConfig,
  SupportFaqItem,
  SupportMessage,
  SupportMessageInput,
  SupportSlaConfig,
  SupportTicketDetail,
  SupportTicketInput,
  SupportTicketSummary,
  SupportTicketUserSummary,
} from '@/features/support/types'

type SupportTicketRow = {
  id: string
  user_id: string
  subject: string
  description: string | null
  status: SupportTicketSummary['status']
  priority: SupportTicketSummary['priority']
  category: SupportTicketSummary['category']
  attachment_url: string | null
  attachment_name: string | null
  first_response_due_at: string | null
  first_response_at: string | null
  sla_policy_key: string
  sla_status: SupportTicketSummary['sla_status']
  created_at: string
  updated_at: string
  user?: {
    id: string
    email: string
    full_name: string | null
    whatsapp_number?: string | null
  } | null
}

type SupportMessageRow = {
  id: string
  ticket_id: string
  sender_id: string
  message: string
  attachment_url: string | null
  attachment_name: string | null
  created_at: string
  sender?: {
    id: string
    email: string
    full_name: string | null
    whatsapp_number?: string | null
  } | null
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

type SiteConfigRow = {
  support_sla_config: SupportSlaConfig | null
  support_business_hours_config: SupportBusinessHoursConfig | null
  crisis_protocol_config: SupportCrisisProtocolConfig | null
}

function sanitizeFileName(fileName: string) {
  const parts = fileName.split('.')
  const extension = parts.length > 1 ? parts.pop() : undefined
  const base = parts.join('.')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return extension ? `${base || 'arquivo'}.${extension}` : (base || 'arquivo')
}

function normalizeSupportUserSummary(user: SupportTicketRow['user'] | SupportMessageRow['sender']): SupportTicketUserSummary | null {
  const relation = unwrapRelation(user)
  if (!relation) {
    return null
  }

  return {
    id: relation.id,
    email: relation.email,
    full_name: relation.full_name,
    whatsapp_number: relation.whatsapp_number ?? null,
  }
}

function normalizeSupportTicket(row: SupportTicketRow): SupportTicketSummary {
  return {
    id: row.id,
    user_id: row.user_id,
    subject: row.subject,
    description: row.description ?? '',
    status: row.status,
    priority: row.priority,
    category: row.category,
    attachment_url: row.attachment_url,
    attachment_name: row.attachment_name,
    first_response_due_at: row.first_response_due_at,
    first_response_at: row.first_response_at,
    sla_policy_key: row.sla_policy_key,
    sla_status: row.sla_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: normalizeSupportUserSummary(row.user),
  }
}

function normalizeSupportMessage(row: SupportMessageRow): SupportMessage {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    sender_id: row.sender_id,
    message: row.message,
    attachment_url: row.attachment_url,
    attachment_name: row.attachment_name,
    created_at: row.created_at,
    sender: normalizeSupportUserSummary(row.sender),
  }
}

async function uploadSupportAttachment(file: File, userId: string) {
  const sanitized = sanitizeFileName(file.name)
  const extension = sanitized.includes('.') ? sanitized.split('.').pop() : undefined
  const path = `support/${userId}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`
  const result = await supabase.storage.from('uploads').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (result.error) {
    throw result.error
  }

  const publicUrl = supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl

  return {
    url: publicUrl,
    name: sanitized,
  }
}

async function notifySupportTicketEvent(ticketId: string, eventType: 'new_ticket' | 'new_message' | 'ticket_closed', messageId?: string) {
  const { error } = await supabase.rpc('notify_support_ticket_event', {
    _ticket_id: ticketId,
    _event_type: eventType,
    _message_id: messageId ?? null,
  })

  if (error) {
    throw error
  }
}

export async function fetchSupportSettings() {
  const { data, error } = await supabase
    .from('site_config')
    .select('support_sla_config, support_business_hours_config, crisis_protocol_config')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    throw error
  }

  const row = data as SiteConfigRow | null

  return {
    sla: row?.support_sla_config ?? defaultSupportSlaConfig,
    businessHours: row?.support_business_hours_config ?? defaultSupportBusinessHoursConfig,
    crisisProtocol: row?.crisis_protocol_config ?? defaultSupportCrisisProtocolConfig,
  }
}

export async function fetchSupportFaqs() {
  const { data, error } = await supabase
    .from('support_faqs')
    .select('id, category_key, question, answer, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw error
  }

  return ((data ?? []) as SupportFaqItem[]).map((item) => ({
    ...item,
    category_key: item.category_key,
  }))
}

export async function fetchAdminSupportFaqs() {
  const { data, error } = await supabase
    .from('support_faqs')
    .select('id, category_key, question, answer, sort_order, is_published')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return ((data ?? []) as SupportFaqItem[]).map((item) => ({
    ...item,
    category_key: item.category_key,
  }))
}

type SupportFaqMutationInput = {
  category_key: SupportFaqItem['category_key']
  question: string
  answer: string
  sort_order: number
  is_published: boolean
}

export async function createSupportFaq(input: SupportFaqMutationInput) {
  const { data, error } = await supabase
    .from('support_faqs')
    .insert({
      category_key: input.category_key,
      question: input.question.trim(),
      answer: input.answer.trim(),
      sort_order: input.sort_order,
      is_published: input.is_published,
    })
    .select('id, category_key, question, answer, sort_order, is_published')
    .single()

  if (error) {
    throw error
  }

  return data as SupportFaqItem
}

export async function updateSupportFaq(id: string, input: SupportFaqMutationInput) {
  const { data, error } = await supabase
    .from('support_faqs')
    .update({
      category_key: input.category_key,
      question: input.question.trim(),
      answer: input.answer.trim(),
      sort_order: input.sort_order,
      is_published: input.is_published,
    })
    .eq('id', id)
    .select('id, category_key, question, answer, sort_order, is_published')
    .single()

  if (error) {
    throw error
  }

  return data as SupportFaqItem
}

export async function deleteSupportFaq(id: string) {
  const { error } = await supabase
    .from('support_faqs')
    .delete()
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function fetchMySupportTickets() {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, user_id, subject, description, status, priority, category, attachment_url, attachment_name, first_response_due_at, first_response_at, sla_policy_key, sla_status, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as unknown as SupportTicketRow[]).map(normalizeSupportTicket)
}

export async function fetchAdminSupportTickets() {
  const { data, error } = await supabase
    .from('support_tickets')
    .select(`
      id,
      user_id,
      subject,
      description,
      status,
      priority,
      category,
      attachment_url,
      attachment_name,
      first_response_due_at,
      first_response_at,
      sla_policy_key,
      sla_status,
      created_at,
      updated_at,
      user:profiles!support_tickets_user_id_fkey (
        id,
        email,
        full_name,
        whatsapp_number
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as unknown as SupportTicketRow[]).map(normalizeSupportTicket)
}

export async function fetchSupportTicketDetail(ticketId: string) {
  const [ticketResult, messagesResult] = await Promise.all([
    supabase
      .from('support_tickets')
      .select(`
        id,
        user_id,
        subject,
        description,
        status,
        priority,
        category,
        attachment_url,
        attachment_name,
        first_response_due_at,
        first_response_at,
        sla_policy_key,
        sla_status,
        created_at,
        updated_at,
        user:profiles!support_tickets_user_id_fkey (
          id,
          email,
          full_name,
          whatsapp_number
        )
      `)
      .eq('id', ticketId)
      .single(),
    supabase
      .from('support_messages')
      .select(`
        id,
        ticket_id,
        sender_id,
        message,
        attachment_url,
        attachment_name,
        created_at,
        sender:profiles!support_messages_sender_id_fkey (
          id,
          email,
          full_name,
          whatsapp_number
        )
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true }),
  ])

  if (ticketResult.error) {
    throw ticketResult.error
  }

  if (messagesResult.error) {
    throw messagesResult.error
  }

  return {
    ...normalizeSupportTicket(ticketResult.data as unknown as SupportTicketRow),
    messages: ((messagesResult.data ?? []) as unknown as SupportMessageRow[]).map(normalizeSupportMessage),
  } satisfies SupportTicketDetail
}

export async function fetchSupportMessageById(messageId: string) {
  const { data, error } = await supabase
    .from('support_messages')
    .select(`
      id,
      ticket_id,
      sender_id,
      message,
      attachment_url,
      attachment_name,
      created_at,
      sender:profiles!support_messages_sender_id_fkey (
        id,
        email,
        full_name,
        whatsapp_number
      )
    `)
    .eq('id', messageId)
    .single()

  if (error) {
    throw error
  }

  return normalizeSupportMessage(data as unknown as SupportMessageRow)
}

export async function createSupportTicket(input: SupportTicketInput) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    throw sessionError
  }

  const userId = sessionData.session?.user.id
  if (!userId) {
    throw new Error('Sessão expirada. Entre novamente para abrir o chamado.')
  }

  let attachment: { url: string; name: string } | null = null
  if (input.attachment) {
    attachment = await uploadSupportAttachment(input.attachment, userId)
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: userId,
      subject: input.subject.trim(),
      description: input.description.trim(),
      category: input.category,
      priority: input.priority,
      attachment_url: attachment?.url ?? null,
      attachment_name: attachment?.name ?? null,
    })
    .select('id, user_id, subject, description, status, priority, category, attachment_url, attachment_name, first_response_due_at, first_response_at, sla_policy_key, sla_status, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  const ticket = normalizeSupportTicket(data as unknown as SupportTicketRow)
  await notifySupportTicketEvent(ticket.id, 'new_ticket')
  return ticket
}

export async function sendSupportMessage(input: SupportMessageInput) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    throw sessionError
  }

  const userId = sessionData.session?.user.id
  if (!userId) {
    throw new Error('Sessão expirada. Entre novamente para responder o chamado.')
  }

  let attachment: { url: string; name: string } | null = null
  if (input.attachment) {
    attachment = await uploadSupportAttachment(input.attachment, userId)
  }

  const normalizedMessage = input.message.trim() || (attachment ? 'Anexo enviado.' : '')
  if (!normalizedMessage && !attachment) {
    throw new Error('Escreva uma mensagem ou anexe um arquivo para continuar.')
  }

  const { data, error } = await supabase
    .from('support_messages')
    .insert({
      ticket_id: input.ticketId,
      sender_id: userId,
      message: normalizedMessage,
      attachment_url: attachment?.url ?? null,
      attachment_name: attachment?.name ?? null,
    })
    .select(`
      id,
      ticket_id,
      sender_id,
      message,
      attachment_url,
      attachment_name,
      created_at,
      sender:profiles!support_messages_sender_id_fkey (
        id,
        email,
        full_name,
        whatsapp_number
      )
    `)
    .single()

  if (error) {
    throw error
  }

  await notifySupportTicketEvent(input.ticketId, 'new_message', (data as unknown as SupportMessageRow).id)
  return normalizeSupportMessage(data as unknown as SupportMessageRow)
}

export async function updateSupportTicketStatus(ticketId: string, status: SupportTicketSummary['status']) {
  const { data, error } = await supabase
    .from('support_tickets')
    .update({ status })
    .eq('id', ticketId)
    .select('id, user_id, subject, description, status, priority, category, attachment_url, attachment_name, first_response_due_at, first_response_at, sla_policy_key, sla_status, created_at, updated_at')
    .single()

  if (error) {
    throw error
  }

  const ticket = normalizeSupportTicket(data as unknown as SupportTicketRow)

  if (status === 'closed') {
    await notifySupportTicketEvent(ticketId, 'ticket_closed')
  }

  return ticket
}

export async function deleteSupportTicket(ticketId: string) {
  const { error } = await supabase
    .from('support_tickets')
    .delete()
    .eq('id', ticketId)

  if (error) {
    throw error
  }
}
