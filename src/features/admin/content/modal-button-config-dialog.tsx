import { Button } from '@/components/ui/button';
import type { ReactNode } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { LessonContentBlock } from '@/features/admin/content/content-blocks';

export interface ModalButtonConfigValue {
    title: string;
    subtitle: string;
    blocks: LessonContentBlock[];
}

interface ModalButtonConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    value: ModalButtonConfigValue;
    onChange: (value: ModalButtonConfigValue) => void;
    renderBlockEditor: (props: {
        blocks: LessonContentBlock[];
        onChange: (blocks: LessonContentBlock[]) => void;
    }) => ReactNode;
    title?: string;
    description?: string;
}

export function ModalButtonConfigDialog({
    open,
    onOpenChange,
    value,
    onChange,
    renderBlockEditor,
    title = 'Personalizar modal',
    description = 'Configure o título, o subtítulo e o conteúdo exibido quando o aluno clicar no botão.',
}: ModalButtonConfigDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="z-[160] flex max-h-[92vh] max-w-4xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl">
                <DialogHeader className="border-b border-slate-100 bg-slate-50/60 p-6 pb-4">
                    <DialogTitle className="text-xl font-black text-slate-900">{title}</DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">{description}</DialogDescription>
                </DialogHeader>

                <div className="flex-1 space-y-5 overflow-y-auto p-6">
                    <label className="block space-y-2">
                        <span className="text-sm font-bold text-slate-800">Título do modal</span>
                        <input
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
                            placeholder="Ex: Material Complementar"
                            value={value.title}
                            onChange={(event) => onChange({ ...value, title: event.target.value })}
                        />
                    </label>

                    <label className="block space-y-2">
                        <span className="text-sm font-bold text-slate-800">Subtítulo do modal</span>
                        <input
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                            placeholder="Ex: Conteúdo complementar da aula."
                            value={value.subtitle}
                            onChange={(event) => onChange({ ...value, subtitle: event.target.value })}
                        />
                        <p className="text-xs text-slate-500">Opcional. Deixe em branco para ocultar o subtítulo.</p>
                    </label>

                    <div className="space-y-2">
                        <span className="text-sm font-bold text-slate-800">Conteúdo do modal</span>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
                            {renderBlockEditor({
                                blocks: value.blocks,
                                onChange: (blocks) => onChange({ ...value, blocks }),
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 p-4">
                    <Button
                        type="button"
                        className="rounded-xl bg-blue-600 px-6 font-bold text-white hover:bg-blue-700"
                        onClick={() => onOpenChange(false)}
                    >
                        Concluir configuração
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
