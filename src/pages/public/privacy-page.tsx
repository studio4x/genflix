import { legalDocuments } from '@/features/public/legal-documents'
import { PublicLegalPageShell } from '@/pages/public/public-legal-page-shell'

export function PrivacyPage() {
  const document = legalDocuments.privacy

  return (
    <PublicLegalPageShell
      eyebrow={document.eyebrow}
      title={document.title}
      summary={document.summary}
      updatedAt={document.updatedAt}
    >
      {document.content}
    </PublicLegalPageShell>
  )
}
