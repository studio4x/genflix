import { supportStatusLabelMap, getSupportStatusBadgeClass } from '@/lib/support-sla'
import type { SupportTicketStatus } from '@/features/support/types'

export function TicketStatusBadge({ status }: { status: SupportTicketStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${getSupportStatusBadgeClass(status)}`}>
      {supportStatusLabelMap[status]}
    </span>
  )
}
