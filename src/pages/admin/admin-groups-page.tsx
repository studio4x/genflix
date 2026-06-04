import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@/app/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { addGroupMember, createAccessGroup, deleteAccessGroup, fetchAccessGroups, fetchGroupMembers, fetchProfiles, removeGroupMember, toErrorMessage, updateAccessGroup, type GroupMemberView, } from '@/features/admin/releases/api';
import { accessGroupFormSchema, addGroupMemberSchema, type AccessGroupFormInput, } from '@/features/admin/releases/schemas';
import type { Profile } from '@/types/auth';
import type { AccessGroup } from '@/types/content';
const initialForm: AccessGroupFormInput = {
    name: '',
    description: '',
    is_active: true,
};
export function AdminGroupsPage() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<AccessGroup[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [members, setMembers] = useState<GroupMemberView[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [groupForm, setGroupForm] = useState<AccessGroupFormInput>(initialForm);
    const [memberUserId, setMemberUserId] = useState('');
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
    const [isSubmittingMember, setIsSubmittingMember] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const selectedGroup = useMemo(() => groups.find((group) => group.id === selectedGroupId) ?? null, [groups, selectedGroupId]);
    const addableProfiles = useMemo(() => {
        const memberIds = new Set(members.map((member) => member.user_id));
        return profiles.filter((profile) => !memberIds.has(profile.id));
    }, [members, profiles]);
    const loadBaseData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [groupsResult, profilesResult] = await Promise.all([
                fetchAccessGroups(),
                fetchProfiles(),
            ]);
            setGroups(groupsResult);
            setProfiles(profilesResult);
            if (!selectedGroupId && groupsResult.length > 0) {
                setSelectedGroupId(groupsResult[0].id);
            }
        }
        catch (loadError) {
            setError(toErrorMessage(loadError));
        }
        finally {
            setIsLoading(false);
        }
    }, [selectedGroupId]);
    const loadMembers = useCallback(async (groupId: string) => {
        try {
            const membersResult = await fetchGroupMembers(groupId);
            setMembers(membersResult);
        }
        catch (loadError) {
            setError(toErrorMessage(loadError));
        }
    }, []);
    useEffect(() => {
        void loadBaseData();
    }, [loadBaseData]);
    useEffect(() => {
        if (!selectedGroupId) {
            setMembers([]);
            return;
        }
        void loadMembers(selectedGroupId);
    }, [loadMembers, selectedGroupId]);
    function resetForm() {
        setGroupForm(initialForm);
        setEditingGroupId(null);
    }
    async function handleGroupSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!user) {
            setError("Usurio no autenticado.");
            return;
        }
        const parsed = accessGroupFormSchema.safeParse(groupForm);
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Dados inv?lidos.");
            return;
        }
        setIsSubmittingGroup(true);
        setError(null);
        try {
            if (editingGroupId) {
                await updateAccessGroup(editingGroupId, parsed.data);
            }
            else {
                await createAccessGroup(parsed.data, user.id);
            }
            await loadBaseData();
            resetForm();
        }
        catch (submitError) {
            setError(toErrorMessage(submitError));
        }
        finally {
            setIsSubmittingGroup(false);
        }
    }
    function handleEditGroup(group: AccessGroup) {
        setEditingGroupId(group.id);
        setGroupForm({
            name: group.name,
            description: group.description ?? '',
            is_active: group.is_active,
        });
    }
    async function handleDeleteGroup(group: AccessGroup) {
        const confirmed = window.confirm(`Excluir o grupo "${group.name}" Liberacoes por grupo relacionadas ser?o removidas.`);
        if (!confirmed) {
            return;
        }
        try {
            await deleteAccessGroup(group.id);
            await loadBaseData();
            if (selectedGroupId === group.id) {
                setSelectedGroupId(null);
            }
            if (editingGroupId === group.id) {
                resetForm();
            }
        }
        catch (deleteError) {
            setError(toErrorMessage(deleteError));
        }
    }
    async function handleAddMember(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedGroupId) {
            setError('Selecione um grupo.');
            return;
        }
        const parsed = addGroupMemberSchema.safeParse({ user_id: memberUserId });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Usurio inv?lido.");
            return;
        }
        setIsSubmittingMember(true);
        setError(null);
        try {
            await addGroupMember(selectedGroupId, parsed.data.user_id);
            await loadMembers(selectedGroupId);
            setMemberUserId('');
        }
        catch (memberError) {
            setError(toErrorMessage(memberError));
        }
        finally {
            setIsSubmittingMember(false);
        }
    }
    async function handleRemoveMember(member: GroupMemberView) {
        const confirmed = window.confirm(`Remover ${member.profile?.email ?? "usurio"} do grupo`);
        if (!confirmed) {
            return;
        }
        try {
            await removeGroupMember(member.id);
            if (selectedGroupId) {
                await loadMembers(selectedGroupId);
            }
        }
        catch (removeError) {
            setError(toErrorMessage(removeError));
        }
    }
    return (<div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Grupos de acesso</h2>
        <p className="text-sm text-slate-600">Crie grupos e associe usurios para liberar cursos por grupo.
        </p>
      </div>

      <form className="grid gap-4 rounded-lg border bg-slate-50 p-4" onSubmit={handleGroupSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-slate-700">Nome do grupo</span>
            <input className="w-full rounded-md border px-3 py-2 text-sm" value={groupForm.name} onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))} required/>
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-700">Status</span>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={groupForm.is_active ? 'active' : 'inactive'} onChange={(event) => setGroupForm((prev) => ({
            ...prev,
            is_active: event.target.value === 'active',
        }))}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-sm text-slate-700">Descri??o</span>
          <textarea className="min-h-24 w-full rounded-md border px-3 py-2 text-sm" value={groupForm.description} onChange={(event) => setGroupForm((prev) => ({ ...prev, description: event.target.value }))}/>
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmittingGroup}>
            {isSubmittingGroup
            ? 'Salvando...'
            : editingGroupId
                ? 'Atualizar grupo'
                : 'Criar grupo'}
          </Button>
          {editingGroupId ? (<Button type="button" variant="outline" onClick={resetForm}>
              Cancelar edicao
            </Button>) : null}
        </div>
      </form>

      {isLoading ? <p className="text-sm text-slate-600">Carregando...</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Grupos cadastrados
          </h3>
          <div className="grid gap-3">
            {groups.map((group) => (<article key={group.id} className={`rounded-lg border p-4 shadow-sm ${selectedGroupId === group.id ? 'bg-slate-50' : 'bg-white'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-slate-900">{group.name}</h4>
                    <p className="text-sm text-slate-600">
                      Status: {group.is_active ? 'Ativo' : 'Inativo'}
                    </p>
                    {group.description ? (<p className="text-sm text-slate-600">{group.description}</p>) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => setSelectedGroupId(group.id)}>
                      Membros
                    </Button>
                    <Button type="button" variant="outline" onClick={() => handleEditGroup(group)}>
                      Editar
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => void handleDeleteGroup(group)}>
                      Excluir
                    </Button>
                  </div>
                </div>
              </article>))}

            {!isLoading && groups.length === 0 ? (<p className="text-sm text-slate-600">Nenhum grupo cadastrado.</p>) : null}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            Membros {selectedGroup ? `de "${selectedGroup.name}"` : ''}
          </h3>

          {!selectedGroup ? (<p className="text-sm text-slate-600">
              Selecione um grupo para gerenciar membros.
            </p>) : (<>
              <form className="flex flex-wrap items-end gap-2 rounded-lg border bg-slate-50 p-3" onSubmit={handleAddMember}>
                <label className="flex-1 space-y-1">
                  <span className="text-sm text-slate-700">Adicionar usurio</span>
                  <select className="w-full rounded-md border px-3 py-2 text-sm" value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)} required>
                    <option value="">Selecione...</option>
                    {addableProfiles.map((profile) => (<option key={profile.id} value={profile.id}>
                        {profile.email}
                      </option>))}
                  </select>
                </label>
                <Button type="submit" disabled={isSubmittingMember}>
                  {isSubmittingMember ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </form>

              <div className="grid gap-2">
                {members.map((member) => (<article key={member.id} className="flex items-center justify-between rounded-md border bg-white px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {member.profile?.full_name ?? member.profile?.email ?? member.user_id}
                      </p>
                      <p className="text-xs text-slate-500">
                        {member.profile?.email ?? member.user_id}
                      </p>
                    </div>
                    <Button type="button" variant="destructive" onClick={() => void handleRemoveMember(member)}>
                      Remover
                    </Button>
                  </article>))}
                {members.length === 0 ? (<p className="text-sm text-slate-600">Grupo sem membros.</p>) : null}
              </div>
            </>)}
        </section>
      </div>
    </div>);
}
