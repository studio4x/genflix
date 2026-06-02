import type { RoleCode } from '@/types/auth';
import type { SitePageKey } from '@/features/site-editor/types';
export const SITE_EDITOR_WORKSPACE_STORAGE_KEY = 'site-editor:workspace';
export type SiteEditorWorkflowStatus = 'draft' | 'review' | 'approved' | 'published';
export type SiteEditorWorkspaceComment = {
    id: string;
    body: string;
    createdAt: string;
    authorRole: RoleCode | 'unknown';
    createdBy?: string | null;
    authorName?: string | null;
    authorEmail?: string | null;
};
export type SiteEditorWorkspaceRecord = {
    id?: string;
    pageKey: SitePageKey;
    entryKey: string;
    status: SiteEditorWorkflowStatus;
    comments: SiteEditorWorkspaceComment[];
    draftRawValue: string | null;
    draftTextStyle: Record<string, string>;
    updatedAt: string | null;
    publishedAt: string | null;
    createdAt?: string | null;
    updatedBy?: string | null;
};
export type SiteEditorWorkspaceMap = Record<string, SiteEditorWorkspaceRecord>;
export type SiteEditorRolePermissions = {
    canEdit: boolean;
    canSaveDraft: boolean;
    canComment: boolean;
    canRequestReview: boolean;
    canApprove: boolean;
    canPublish: boolean;
};
export function createSiteEditorWorkspaceKey(pageKey: SitePageKey, entryKey: string) {
    return `${pageKey}:${entryKey}`;
}
export function getDefaultWorkspaceRecord(pageKey: SitePageKey, entryKey: string): SiteEditorWorkspaceRecord {
    return {
        pageKey,
        entryKey,
        status: 'draft',
        comments: [],
        draftRawValue: null,
        draftTextStyle: {},
        updatedAt: null,
        publishedAt: null,
    };
}
export function sortWorkspaceComments(comments: SiteEditorWorkspaceComment[]) {
    return [...comments].sort((commentA, commentB) => {
        return new Date(commentB.createdAt).getTime() - new Date(commentA.createdAt).getTime();
    });
}
export function getSiteEditorPermissions(roles: RoleCode[]): SiteEditorRolePermissions {
    if (roles.includes('admin')) {
        return {
            canEdit: true,
            canSaveDraft: true,
            canComment: true,
            canRequestReview: true,
            canApprove: true,
            canPublish: true,
        };
    }
    if (roles.includes('criador') || roles.includes('professor')) {
        return {
            canEdit: true,
            canSaveDraft: true,
            canComment: true,
            canRequestReview: true,
            canApprove: false,
            canPublish: false,
        };
    }
    return {
        canEdit: false,
        canSaveDraft: false,
        canComment: false,
        canRequestReview: false,
        canApprove: false,
        canPublish: false,
    };
}
export function formatWorkflowStatus(status: SiteEditorWorkflowStatus) {
    switch (status) {
        case 'draft':
            return 'Rascunho';
        case 'review':
            return 'Em revisão';
        case 'approved':
            return 'Aprovado';
        case 'published':
            return 'Publicado';
        default:
            return status;
    }
}
