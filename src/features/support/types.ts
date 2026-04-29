export type SupportTicketStatus = 'open' | 'in_progress' | 'closed'
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type SupportTicketCategory = 'payment' | 'technical' | 'account' | 'general'
export type SupportSlaStatus = 'on_time' | 'at_risk' | 'overdue' | 'answered'
export type SupportModalStep = 'choice' | 'form'

export interface SupportSlaCategoryConfig {
  key: SupportTicketCategory
  label: string
  first_response_hours: number
  position: number
  description: string
}

export interface SupportSlaConfig {
  categories: SupportSlaCategoryConfig[]
  public_note: string
}

export interface SupportBusinessHoursConfig {
  timezone: string
  days_of_week: number[]
  start_hour: number
  end_hour: number
}

export interface SupportCrisisProtocolConfig {
  title: string
  description: string
  note: string
}

export interface SupportFaqItem {
  id: string
  category_key: SupportTicketCategory
  question: string
  answer: string
  sort_order: number
  is_published?: boolean
}

export interface SupportTicketUserSummary {
  id: string
  email: string
  full_name: string | null
  whatsapp_number?: string | null
}

export interface SupportTicketSummary {
  id: string
  user_id: string
  subject: string
  description: string
  status: SupportTicketStatus
  priority: SupportTicketPriority
  category: SupportTicketCategory
  attachment_url: string | null
  attachment_name: string | null
  first_response_due_at: string | null
  first_response_at: string | null
  sla_policy_key: string
  sla_status: SupportSlaStatus
  created_at: string
  updated_at: string
  user?: SupportTicketUserSummary | null
}

export interface SupportMessage {
  id: string
  ticket_id: string
  sender_id: string
  message: string
  attachment_url: string | null
  attachment_name: string | null
  created_at: string
  sender?: SupportTicketUserSummary | null
}

export interface SupportTicketDetail extends SupportTicketSummary {
  messages: SupportMessage[]
}

export interface SupportTicketInput {
  category: SupportTicketCategory
  subject: string
  description: string
  priority: SupportTicketPriority
  attachment?: File | null
}

export interface SupportMessageInput {
  ticketId: string
  message: string
  attachment?: File | null
}
