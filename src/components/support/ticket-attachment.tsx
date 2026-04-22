import { Download, Paperclip } from 'lucide-react'

export function TicketAttachment({
  url,
  name,
  compact = false,
}: {
  url: string
  name: string | null
  compact?: boolean
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-2 rounded-2xl border border-[#D8E6EB] bg-white text-[#15323b] transition-colors hover:bg-[#F2F7F9] ${compact ? 'px-3 py-2 text-xs font-bold' : 'px-4 py-3 text-sm font-semibold'}`}
    >
      <Paperclip className={compact ? 'h-3.5 w-3.5 text-[#1398B7]' : 'h-4 w-4 text-[#1398B7]'} />
      <span className="max-w-[240px] truncate">{name || 'Abrir anexo'}</span>
      <Download className={compact ? 'h-3.5 w-3.5 text-[#5F7077]' : 'h-4 w-4 text-[#5F7077]'} />
    </a>
  )
}
