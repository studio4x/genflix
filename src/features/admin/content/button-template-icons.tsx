import type { LucideIcon } from 'lucide-react';
import { BookOpen, CirclePlay, Download, ExternalLink, FileArchive, FileImage, FileSpreadsheet, FileText, FolderOpen, GraduationCap, Headphones, Link as LinkIcon, MonitorPlay, } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ButtonTemplate, FooterActionScope, LessonFooterAction } from '@/types/content';
export const BUTTON_ICON_OPTIONS: Array<{
    value: string;
    label: string;
    icon: LucideIcon;
}> = [
    { value: 'download', label: 'Download', icon: Download },
    { value: 'external-link', label: 'Link Externo', icon: ExternalLink },
    { value: 'link', label: 'Link', icon: LinkIcon },
    { value: 'file-text', label: 'Documento', icon: FileText },
    { value: 'sheet', label: 'Planilha', icon: FileSpreadsheet },
    { value: 'play-circle', label: 'Video', icon: CirclePlay },
    { value: 'monitor-play', label: 'Aula em Video', icon: MonitorPlay },
    { value: 'book-open', label: 'Guia', icon: BookOpen },
    { value: 'graduation-cap', label: 'Estudo', icon: GraduationCap },
    { value: 'headphones', label: 'Audio', icon: Headphones },
    { value: 'folder-open', label: 'Pasta', icon: FolderOpen },
    { value: 'file-image', label: 'Imagem', icon: FileImage },
    { value: 'file-archive', label: 'Arquivo Compactado', icon: FileArchive },
];
const ICON_MAP = new Map(BUTTON_ICON_OPTIONS.map((item) => [item.value, item.icon]));
function resolveTemplateThemeClasses(theme: ButtonTemplate['theme'] | undefined) {
    switch (theme) {
        case 'emerald':
            return {
                solid: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700',
                soft: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
            };
        case 'amber':
            return {
                solid: 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600 hover:border-amber-600',
                soft: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
            };
        case 'rose':
            return {
                solid: 'border-rose-500 bg-rose-500 text-white hover:bg-rose-600 hover:border-rose-600',
                soft: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
            };
        case 'slate':
            return {
                solid: 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800 hover:border-slate-800',
                soft: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
            };
        case 'violet':
            return {
                solid: 'border-violet-500 bg-violet-500 text-white hover:bg-violet-600 hover:border-violet-600',
                soft: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
            };
        case 'blue':
        default:
            return {
                solid: 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700',
                soft: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
            };
    }
}
export function getLessonFooterButtonClassName(template?: Pick<ButtonTemplate, 'variant' | 'theme'> | null) {
    const themeClasses = resolveTemplateThemeClasses(template?.theme);
    switch (template?.variant) {
        case 'primary':
            return cn('rounded-xl border font-bold shadow-sm transition-colors', themeClasses.solid);
        case 'secondary':
            return cn('rounded-xl border font-bold transition-colors', themeClasses.soft);
        case 'ghost':
            return cn('rounded-xl border border-transparent bg-transparent font-bold transition-colors', themeClasses.soft);
        case 'link':
            return cn('rounded-xl border border-transparent bg-transparent font-bold underline-offset-4 hover:underline', themeClasses.soft);
        case 'outline':
        default:
            return cn('rounded-xl border bg-white font-bold transition-colors', themeClasses.soft);
    }
}
export function renderButtonTemplateIcon(iconName: string | null | undefined, className?: string) {
    const Icon = ICON_MAP.get(iconName ?? '') ?? LinkIcon;
    return <Icon className={cn('h-4 w-4', className)}/>;
}
export function getLessonFooterActionIconName(action: Pick<LessonFooterAction, 'action_type' | 'mime_type' | 'file_name' | 'template'>) {
    if (action.template?.icon)
        return action.template.icon;
    if (action.action_type === 'url')
        return 'external-link';
    const mimeType = action.mime_type?.toLowerCase() ?? '';
    const fileName = action.file_name?.toLowerCase() ?? '';
    if (mimeType.includes('pdf') || fileName.endsWith('.pdf'))
        return 'download';
    if (mimeType.includes('sheet') ||
        mimeType.includes('excel') ||
        fileName.endsWith('.xls') ||
        fileName.endsWith('.xlsx') ||
        fileName.endsWith('.csv'))
        return 'sheet';
    if (mimeType.startsWith('image/') ||
        fileName.endsWith('.png') ||
        fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg') ||
        fileName.endsWith('.webp'))
        return 'file-image';
    if (mimeType.includes('zip') ||
        mimeType.includes('rar') ||
        mimeType.includes('7z') ||
        fileName.endsWith('.zip') ||
        fileName.endsWith('.rar') ||
        fileName.endsWith('.7z'))
        return 'file-archive';
    if (mimeType.startsWith('audio/'))
        return 'headphones';
    if (mimeType.startsWith('video/'))
        return 'play-circle';
    return 'file-text';
}
export function getLessonFooterActionScopeLabel(scope: FooterActionScope) {
    switch (scope) {
        case 'course':
            return 'Curso';
        case 'module':
            return 'Módulo';
        case 'lesson':
        default:
            return 'Aula';
    }
}
