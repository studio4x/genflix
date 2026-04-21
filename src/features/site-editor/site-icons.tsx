import type { LucideIcon } from 'lucide-react'
import {
  BrainCircuit,
  BriefcaseBusiness,
  Download,
  ExternalLink,
  FileArchive,
  FileImage,
  FileText,
  FolderOpen,
  GraduationCap,
  Headphones,
  HeartPulse,
  Landmark,
  Link as LinkIcon,
  MonitorPlay,
  Scale,
  Sigma,
  Sparkles,
} from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SiteIconOption {
  value: string
  label: string
  icon: LucideIcon
}

export const SITE_ICON_OPTIONS: SiteIconOption[] = [
  { value: 'heart-pulse', label: 'Saúde', icon: HeartPulse },
  { value: 'scale', label: 'Jurídicos', icon: Scale },
  { value: 'sigma', label: 'Exatas', icon: Sigma },
  { value: 'briefcase-business', label: 'Gestão', icon: BriefcaseBusiness },
  { value: 'landmark', label: 'Humanas', icon: Landmark },
  { value: 'brain-circuit', label: 'Psicanálise / Psicologia', icon: BrainCircuit },
  { value: 'sparkles', label: 'Interesse geral', icon: Sparkles },
  { value: 'download', label: 'Download', icon: Download },
  { value: 'external-link', label: 'Link externo', icon: ExternalLink },
  { value: 'link', label: 'Link', icon: LinkIcon },
  { value: 'file-text', label: 'Documento', icon: FileText },
  { value: 'file-image', label: 'Imagem', icon: FileImage },
  { value: 'file-archive', label: 'Arquivo compactado', icon: FileArchive },
  { value: 'folder-open', label: 'Pasta', icon: FolderOpen },
  { value: 'graduation-cap', label: 'Estudo', icon: GraduationCap },
  { value: 'headphones', label: 'Áudio', icon: Headphones },
  { value: 'monitor-play', label: 'Vídeo', icon: MonitorPlay },
]

const SITE_ICON_MAP = new Map(SITE_ICON_OPTIONS.map((item) => [item.value, item.icon]))

export function renderSiteIcon(iconKey: string | null | undefined, className?: string) {
  const Icon = SITE_ICON_MAP.get(iconKey ?? '') ?? LinkIcon
  return <Icon className={cn('h-4 w-4', className)} />
}

export function getSiteIconOption(iconKey: string | null | undefined) {
  return SITE_ICON_OPTIONS.find((item) => item.value === iconKey) ?? null
}

