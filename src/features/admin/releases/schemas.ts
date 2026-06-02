import { z } from 'zod';
export const accessGroupFormSchema = z.object({
    name: z.string().trim().min(2, "N?ome do grupo deve ter ao menos 2 caracteres"),
    description: z.string().trim().max(1000).optional(),
    is_active: z.boolean(),
});
export const addGroupMemberSchema = z.object({
    user_id: z.string().uuid("Usurio inv?lido"),
});
export const userReleaseSchema = z.object({
    user_id: z.string().uuid("Usurio inv?lido"),
});
export const groupReleaseSchema = z.object({
    group_id: z.string().uuid("Grupo inv?lido"),
});
export type AccessGroupFormInput = z.infer<typeof accessGroupFormSchema>;
export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;
export type UserReleaseInput = z.infer<typeof userReleaseSchema>;
export type GroupReleaseInput = z.infer<typeof groupReleaseSchema>;
