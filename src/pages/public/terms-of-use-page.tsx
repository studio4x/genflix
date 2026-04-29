import { legalDocuments } from '@/features/public/legal-documents'
import { PublicLegalPageShell } from '@/pages/public/public-legal-page-shell'

export function TermsOfUsePage() {
  const document = legalDocuments.terms

  return (
    <PublicLegalPageShell
      eyebrow={document.eyebrow}
      title={document.title}
      summary={document.summary}
      updatedAt={document.updatedAt}
      currentPage="terms"
    >
      {document.content}
    </PublicLegalPageShell>
  )
}
