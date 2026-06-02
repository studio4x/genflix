import type { SupportBusinessHoursConfig, SupportCrisisProtocolConfig, SupportSlaCategoryConfig, SupportSlaConfig, SupportSlaStatus, SupportTicketCategory, SupportTicketPriority, SupportTicketStatus, SupportTicketSummary, } from '@/features/support/types';
export const defaultSupportSlaConfig: SupportSlaConfig = {
    categories: [
        {
            key: 'payment',
            label: 'Pagamentos',
            first_response_hours: 2,
            position: 1,
            description: 'Primeira resposta em ate 2 horas uteis.',
        },
        {
            key: 'technical',
            label: "Problema t?cnico",
            first_response_hours: 24,
            position: 2,
            description: 'Primeira resposta em ate 24 horas uteis.',
        },
        {
            key: 'account',
            label: 'Conta e acesso',
            first_response_hours: 24,
            position: 3,
            description: 'Primeira resposta em ate 24 horas uteis.',
        },
        {
            key: 'general',
            label: 'Duvida geral',
            first_response_hours: 24,
            position: 4,
            description: 'Primeira resposta em ate 24 horas uteis.',
        },
    ],
    public_note: "Os prazos acima se referem ao tempo da primeira resposta humana da equipe. N?o representam prazo de resolucao final.",
};
export const defaultSupportBusinessHoursConfig: SupportBusinessHoursConfig = {
    timezone: 'America/Sao_Paulo',
    days_of_week: [1, 2, 3, 4, 5],
    start_hour: 8,
    end_hour: 18,
};
export const defaultSupportCrisisProtocolConfig: SupportCrisisProtocolConfig = {
    title: 'Casos graves ou sensiveis',
    description: "Para situacoes com fraude, segurana, abuso ou necessidade urgente de orientacao, abra o chamado com o maximo de contexto e prioridade compativel.",
    note: "N?ossa equipe trata a fila de forma humana e responsavel, respeitando a ordem operacional e o SLA da categoria.",
};
export const supportPriorityLabelMap: Record<SupportTicketPriority, string> = {
    low: 'Baixa',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente',
};
export const supportStatusLabelMap: Record<SupportTicketStatus, string> = {
    open: 'Aberto',
    in_progress: 'Em atendimento',
    closed: 'Fechado',
};
export const supportSlaStatusLabelMap: Record<SupportSlaStatus, string> = {
    on_time: "N?o prazo",
    at_risk: 'Em risco',
    overdue: 'Atrasado',
    answered: 'Respondido',
};
export const supportCategoryLabelMap: Record<SupportTicketCategory, string> = {
    payment: 'Pagamentos',
    technical: "Problema t?cnico",
    account: 'Conta e acesso',
    general: 'Duvida geral',
};
export function getOrderedSupportCategories(config: SupportSlaConfig = defaultSupportSlaConfig) {
    return [...config.categories].sort((left, right) => left.position - right.position);
}
export function getSupportCategoryConfig(category: SupportTicketCategory, config: SupportSlaConfig = defaultSupportSlaConfig): SupportSlaCategoryConfig {
    return getOrderedSupportCategories(config).find((item) => item.key === category)
        ?? getOrderedSupportCategories(config).find((item) => item.key === 'general')
        ?? defaultSupportSlaConfig.categories[0];
}
export function getSupportPriorityOptions(isAdmin: boolean) {
    return (isAdmin
        ? ['low', 'medium', 'high', 'urgent']
        : ['low', 'medium', 'high']) satisfies SupportTicketPriority[];
}
export function getSupportTicketRoute(ticketId: string, isAdminView: boolean) {
    return isAdminView ? `/admin/suporte/${ticketId}` : `/aluno/suporte/${ticketId}`;
}
export function getSupportListRoute(isAdminView: boolean) {
    return isAdminView ? '/admin/suporte' : '/aluno/suporte';
}
export function getSupportSlaStatusMeta(ticket: Pick<SupportTicketSummary, 'first_response_due_at' | 'first_response_at' | 'sla_status'>) {
    if (ticket.first_response_at) {
        return {
            key: 'answered' as const,
            label: supportSlaStatusLabelMap.answered,
            className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        };
    }
    if (!ticket.first_response_due_at) {
        return {
            key: ticket.sla_status,
            label: supportSlaStatusLabelMap[ticket.sla_status],
            className: 'border-[#BEE3EA] bg-[#E8F6FA] text-[#0A3640]',
        };
    }
    const dueAt = new Date(ticket.first_response_due_at).getTime();
    const now = Date.now();
    if (now > dueAt) {
        return {
            key: 'overdue' as const,
            label: supportSlaStatusLabelMap.overdue,
            className: 'border-rose-200 bg-rose-50 text-rose-700',
        };
    }
    if (now >= dueAt - 60 * 60 * 1000) {
        return {
            key: 'at_risk' as const,
            label: supportSlaStatusLabelMap.at_risk,
            className: 'border-amber-200 bg-amber-50 text-amber-700',
        };
    }
    return {
        key: 'on_time' as const,
        label: supportSlaStatusLabelMap.on_time,
        className: 'border-sky-200 bg-sky-50 text-sky-700',
    };
}
export function getSupportStatusBadgeClass(status: SupportTicketStatus) {
    switch (status) {
        case 'open':
            return 'border-sky-200 bg-sky-50 text-sky-700';
        case 'in_progress':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        case 'closed':
            return 'border-slate-200 bg-slate-100 text-slate-700';
        default:
            return 'border-[#D8E6EB] bg-[#F2F7F9] text-[#5F7077]';
    }
}
export function getSupportPriorityBadgeClass(priority: SupportTicketPriority) {
    switch (priority) {
        case 'urgent':
            return 'border-rose-200 bg-rose-50 text-rose-700';
        case 'high':
            return 'border-orange-200 bg-orange-50 text-orange-700';
        case 'medium':
            return 'border-amber-200 bg-amber-50 text-amber-700';
        case 'low':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        default:
            return 'border-[#D8E6EB] bg-[#F2F7F9] text-[#5F7077]';
    }
}
export function formatSupportDate(value: string | null, withTime = true) {
    if (!value) {
        return '-';
    }
    return new Intl.DateTimeFormat('pt-BR', withTime ? {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    } : {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(value));
}
export function formatSupportBusinessHours(config: SupportBusinessHoursConfig = defaultSupportBusinessHoursConfig) {
    const formatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
    const labels = config.days_of_week.map((day) => {
        const date = new Date(Date.UTC(2026, 0, day + 4));
        return formatter.format(date);
    });
    return `${labels.join(', ')} · ${String(config.start_hour).padStart(2, '0')}h às ${String(config.end_hour).padStart(2, '0')}h`;
}
export function getSupportUserDisplayName(user?: {
    full_name: string | null;
    email: string | null;
} | null) {
    if (user?.full_name?.trim()) {
        return user.full_name.trim();
    }
    if (user?.email?.trim()) {
        return user.email.split('@')[0];
    }
    return "Usurio GenFlix";
}
