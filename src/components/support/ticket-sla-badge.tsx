import { getSupportSlaStatusMeta } from '@/lib/support-sla'
import type { SupportTicketSummary } from '@/features/support/types'

export function TicketSlaBadge({
  ticket,
}: {
  ticket: Pick<SupportTicketSummary, 'first_response_due_at' | 'first_response_at' | 'sla_status'>
}) {
  const meta = getSupportSlaStatusMeta(ticket)

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${meta.className}`}>
      {meta.label}
    </span>
  )
}
