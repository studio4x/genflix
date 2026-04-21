import { useEffect } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { legalDocuments, type LegalDocumentKey } from '@/features/public/legal-documents'

export function LegalDocumentModal({
  documentKey,
  onClose,
}: {
  documentKey: LegalDocumentKey
  onClose: () => void
}) {
  const document = legalDocuments[documentKey]

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#061b21]/58 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[30px] border border-[#D8E6EB] bg-white shadow-[0_30px_90px_rgba(6,27,33,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#D8E6EB] bg-[#F2F8FA] px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">{document.eyebrow}</p>
            <h2 className="mt-2 font-readex text-2xl font-semibold tracking-tight text-[#15323b]">{document.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5F7077]">{document.summary}</p>
            <p className="mt-3 text-[11px] font-black uppercase tracking-[0.22em] text-[#8BA0A7]">
              Atualizado em {document.updatedAt}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8E6EB] text-[#5F7077] transition-colors hover:bg-white"
            aria-label="Fechar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6 sm:px-8">
          <div className="space-y-8">{document.content}</div>
        </div>

        <div className="border-t border-[#D8E6EB] bg-white px-6 py-4 sm:px-8">
          <Button
            type="button"
            onClick={onClose}
            className="bg-gradient-to-b from-[#1398B7] to-[#0A3640] font-black text-white hover:opacity-95"
          >
            Fechar e voltar ao cadastro
          </Button>
        </div>
      </div>
    </div>
  )
}
