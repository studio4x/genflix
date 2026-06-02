import { supabase } from '@/services/supabase/client';
export type BlogCommentStatus = 'pending' | 'approved' | 'rejected';
export interface BlogComment {
    id: string;
    post_slug: string;
    post_title: string | null;
    author_user_id: string | null;
    first_name: string;
    last_name: string;
    email: string;
    content: string;
    moderation_status: BlogCommentStatus;
    moderation_reason: string | null;
    admin_response: string | null;
    approved_at: string | null;
    approved_by: string | null;
    created_at: string;
    updated_at: string;
}
export async function fetchApprovedBlogComments(postSlug: string) {
    const { data, error } = await supabase
        .from('blog_post_comments')
        .select('id, post_slug, post_title, author_user_id, first_name, last_name, email, content, moderation_status, moderation_reason, admin_response, approved_at, approved_by, created_at, updated_at')
        .eq('post_slug', postSlug)
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false });
    if (error) {
        throw error;
    }
    return (data ?? []) as BlogComment[];
}
export async function submitBlogComment(input: {
    postSlug: string;
    postTitle: string;
    firstName: string;
    lastName: string;
    email: string;
    content: string;
}) {
    const { data, error } = await supabase.rpc('submit_blog_comment', {
        _post_slug: input.postSlug,
        _post_title: input.postTitle,
        _first_name: input.firstName,
        _last_name: input.lastName,
        _email: input.email,
        _content: input.content,
    });
    if (error) {
        throw error;
    }
    return data as BlogComment;
}
export async function listAdminBlogComments(input: {
    status?: BlogCommentStatus | 'all';
    query?: string;
} = {}) {
    const { data, error } = await supabase.rpc('list_admin_blog_comments', {
        _status: input.status ?? 'pending',
        _post_slug: null,
        _query: input.query?.trim() || '',
        _limit: 250,
    });
    if (error) {
        throw error;
    }
    return (data ?? []) as BlogComment[];
}
export async function moderateBlogComment(commentId: string, action: 'approve' | 'reject', reason?: string, adminResponse?: string) {
    const { data, error } = await supabase.rpc('moderate_blog_comment', {
        _comment_id: commentId,
        _action: action,
        _reason: reason?.trim() || null,
        _admin_response: adminResponse?.trim() || null,
    });
    if (error) {
        throw error;
    }
    return data as BlogComment;
}
export async function replyBlogComment(commentId: string, response: string) {
    const { data, error } = await supabase.rpc('reply_blog_comment', {
        _comment_id: commentId,
        _response: response,
    });
    if (error) {
        throw error;
    }
    return data as BlogComment;
}
export async function deleteBlogComment(commentId: string) {
    const { error } = await supabase.from('blog_post_comments').delete().eq('id', commentId);
    if (error) {
        throw error;
    }
}
