import { supabase } from '@/services/supabase/client';
export interface MessageRecipient {
    id: string;
    email: string;
    full_name: string | null;
    role_codes: string[];
}
export interface ConversationParticipant {
    user_id: string;
    full_name: string | null;
    email: string;
    role: 'participant' | 'admin' | 'observer';
    is_current_user: boolean;
}
export interface ConversationMetadata {
    kind?: 'course_room' | 'creator_channel' | string;
    course_id?: string;
    course_title?: string;
    creator_id?: string;
}
export interface ConversationSummary {
    conversation_id: string;
    conversation_type: 'direct' | 'support' | 'group';
    title: string | null;
    metadata: ConversationMetadata;
    last_message_at: string | null;
    last_message_preview: string | null;
    message_count: number;
    unread_count: number;
    participants: ConversationParticipant[];
}
export interface ConversationMessage {
    id: string;
    conversation_id: string;
    sender_id: string | null;
    sender_name: string | null;
    sender_email: string | null;
    content: string;
    message_type: 'text' | 'file' | 'system' | 'notification';
    attachments: unknown[];
    is_deleted: boolean;
    created_at: string;
    updated_at: string;
}
export type MessageReportReason = 'spam' | 'harassment' | 'inappropriate' | 'abuse' | 'other';
export interface MessageReportSummary {
    report_id: string;
    message_id: string;
    conversation_id: string;
    message_content: string;
    sender_id: string | null;
    sender_name: string | null;
    sender_email: string | null;
    reported_by_id: string | null;
    reporter_name: string | null;
    reporter_email: string | null;
    reason: MessageReportReason;
    description: string | null;
    status: 'pending' | 'resolved';
    created_at: string;
    resolved_at: string | null;
}
export async function searchMessageRecipients(query: string) {
    const { data, error } = await supabase.rpc('search_message_recipients', {
        _query: query,
        _limit: 20,
    });
    if (error) {
        throw error;
    }
    return (data ?? []) as MessageRecipient[];
}
export async function createDirectConversation(recipientId: string) {
    const { data, error } = await supabase.rpc('create_direct_conversation', {
        _recipient_id: recipientId,
    });
    if (error) {
        throw error;
    }
    return data as string;
}
export async function createCourseCreatorConversation(courseId: string) {
    const { data, error } = await supabase.rpc('create_course_creator_conversation', {
        _course_id: courseId,
    });
    if (error) {
        throw error;
    }
    return data as string;
}
export async function fetchConversations() {
    const { data, error } = await supabase.rpc('list_user_conversations', {
        _limit: 80,
    });
    if (error) {
        throw error;
    }
    return ((data ?? []) as ConversationSummary[]).map((conversation) => ({
        ...conversation,
        metadata: conversation.metadata && typeof conversation.metadata === 'object' ? conversation.metadata : {},
        participants: Array.isArray(conversation.participants) ? conversation.participants : [],
    }));
}
export async function fetchConversationMessages(conversationId: string) {
    const { data, error } = await supabase.rpc('list_conversation_messages', {
        _conversation_id: conversationId,
        _limit: 100,
    });
    if (error) {
        throw error;
    }
    return ((data ?? []) as ConversationMessage[]).reverse();
}
export async function sendConversationMessage(conversationId: string, content: string) {
    const { data, error } = await supabase.rpc('send_conversation_message', {
        _conversation_id: conversationId,
        _content: content,
        _attachments: [],
    });
    if (error) {
        throw error;
    }
    return data as ConversationMessage;
}
export async function markConversationRead(conversationId: string) {
    const { error } = await supabase.rpc('mark_conversation_read', {
        _conversation_id: conversationId,
    });
    if (error) {
        throw error;
    }
}
export async function reportConversationMessage(messageId: string, reason: MessageReportReason, description?: string) {
    const { data, error } = await supabase.rpc('report_message', {
        _message_id: messageId,
        _reason: reason,
        _description: description?.trim() || null,
    });
    if (error) {
        throw error;
    }
    return data as string;
}
export async function fetchMessageReports(status: 'pending' | 'resolved' | 'all' = 'pending') {
    const { data, error } = await supabase.rpc('list_message_reports', {
        _status: status,
        _limit: 50,
    });
    if (error) {
        throw error;
    }
    return (data ?? []) as MessageReportSummary[];
}
export async function resolveMessageReport(reportId: string) {
    const { error } = await supabase.rpc('resolve_message_report', {
        _report_id: reportId,
    });
    if (error) {
        throw error;
    }
}
