import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchAdminCreatorPayoutDashboard, formatMoneyFromCents, processDueCreatorPayouts, registerPaidCreatorPayout, sendPixCreatorPayout, updateCreatorPayoutSettings, type AdminCreatorCommission, type AdminCreatorPayoutDashboard, type CreatorPayoutMode, } from '@/features/admin/creator-payouts/api';
function formatDateTime(value: string | null | undefined) {
    if (!value) {
        return 'Sem data';
    }
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}
function formatDateInputValue(value: Date) {
    const offsetMs = value.getTimezoneOffset() * 60 * 1000;
    return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}
function formatStatus(status: string) {
    const labels: Record<string, string> = {
        pending: 'Pendente',
        eligible: 'Elegível',
        scheduled: 'Agendada',
        paid: 'Paga',
        canceled: 'Cancelada',
        refunded: 'Estornada',
        failed: 'Falhou',
        draft: 'Rascunho',
        processing: 'Processando',
    };
    return labels[status] ?? status;
}
function statusTone(status: string) {
    if (status === 'paid' || status === 'eligible') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }
    if (status === 'pending' || status === 'scheduled' || status === 'draft' || status === 'processing') {
        return 'border-sky-200 bg-sky-50 text-sky-700';
    }
    if (status === 'canceled' || status === 'refunded' || status === 'failed') {
        return 'border-rose-200 bg-rose-50 text-rose-700';
    }
    return 'border-[#D8E6EB] bg-[#E8F6FA] text-[#0A3640]';
}
function isCommissionEligible(commission: AdminCreatorCommission, paidAt: string) {
    return ((commission.status === 'pending' || commission.status === 'eligible') &&
        new Date(commission.eligible_at) <= new Date(paidAt));
}
function getCreatorLabel(dashboard: AdminCreatorPayoutDashboard | null, creatorId: string) {
    const profile = dashboard?.profiles.find((item) => item.id === creatorId);
    return profile?.full_name || profile?.email || 'Autor';
}
function getCourseTitle(dashboard: AdminCreatorPayoutDashboard | null, courseId: string) {
    return dashboard?.courses.find((course) => course.id === courseId)?.title ?? 'Curso';
}
function getDefaultSettings() {
    return {
        mode: 'automatic' as CreatorPayoutMode,
        intervalDays: 30,
        minimumAmountCents: 0,
        isEnabled: true,
        nextRunAt: formatDateInputValue(new Date()),
    };
}
export function AdminCreatorPayoutsPage() {
    const [dashboard, setDashboard] = useState<AdminCreatorPayoutDashboard | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegisteringExternal, setIsRegisteringExternal] = useState(false);
    const [isSendingPix, setIsSendingPix] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [isProcessingCycle, setIsProcessingCycle] = useState(false);
    const [selectedCreatorId, setSelectedCreatorId] = useState('');
    const [statusFilter, setStatusFilter] = useState('eligible');
    const [selectedCommissionIds, setSelectedCommissionIds] = useState<string[]>([]);
    const [paidAt, setPaidAt] = useState(() => formatDateInputValue(new Date()));
    const [notes, setNotes] = useState('');
    const [settingsForm, setSettingsForm] = useState(getDefaultSettings);
    const [message, setMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    async function loadDashboard() {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const payload = await fetchAdminCreatorPayoutDashboard();
            setDashboard(payload);
            setSelectedCommissionIds([]);
            setSettingsForm({
                mode: payload.payoutSettings.mode,
                intervalDays: payload.payoutSettings.interval_days,
                minimumAmountCents: payload.payoutSettings.minimum_amount_cents,
                isEnabled: payload.payoutSettings.is_enabled,
                nextRunAt: payload.payoutSettings.next_run_at
                    ? formatDateInputValue(new Date(payload.payoutSettings.next_run_at))
                    : formatDateInputValue(new Date()),
            });
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar repasses.');
        }
        finally {
            setIsLoading(false);
        }
    }
    useEffect(() => {
        void loadDashboard();
    }, []);
    const payoutItemCommissionIds = useMemo(() => {
        return new Set((dashboard?.payoutItems ?? []).map((item) => item.commission_id));
    }, [dashboard?.payoutItems]);
    const creators = useMemo(() => {
        const creatorIds = new Set((dashboard?.commissions ?? []).map((commission) => commission.creator_id));
        return Array.from(creatorIds).map((creatorId) => ({
            id: creatorId,
            label: getCreatorLabel(dashboard, creatorId),
            payoutProfile: dashboard?.creatorProfiles.find((profile) => profile.user_id === creatorId) ?? null,
        }));
    }, [dashboard]);
    const filteredCommissions = useMemo(() => {
        const paidAtIso = new Date(paidAt).toISOString();
        return (dashboard?.commissions ?? []).filter((commission) => {
            const matchesCreator = !selectedCreatorId || commission.creator_id === selectedCreatorId;
            const alreadyInPayout = payoutItemCommissionIds.has(commission.id);
            const eligible = isCommissionEligible(commission, paidAtIso) && !alreadyInPayout;
            if (!matchesCreator) {
                return false;
            }
            if (statusFilter === 'eligible') {
                return eligible;
            }
            if (statusFilter === 'blocked') {
                return !eligible && commission.status !== 'paid';
            }
            if (statusFilter === 'paid') {
                return commission.status === 'paid';
            }
            return true;
        });
    }, [dashboard?.commissions, paidAt, payoutItemCommissionIds, selectedCreatorId, statusFilter]);
    const selectedCommissions = useMemo(() => {
        return (dashboard?.commissions ?? []).filter((commission) => selectedCommissionIds.includes(commission.id));
    }, [dashboard?.commissions, selectedCommissionIds]);
    const selectedCreatorIds = useMemo(() => {
        return Array.from(new Set(selectedCommissions.map((commission) => commission.creator_id)));
    }, [selectedCommissions]);
    const selectedCourseIds = useMemo(() => {
        return Array.from(new Set(selectedCommissions.map((commission) => commission.course_id)));
    }, [selectedCommissions]);
    const selectedAmount = useMemo(() => {
        return selectedCommissions.reduce((total, commission) => total + Number(commission.commission_amount_cents ?? 0), 0);
    }, [selectedCommissions]);
    const metrics = useMemo(() => {
        const nowIso = new Date(paidAt).toISOString();
        const commissions = dashboard?.commissions ?? [];
        const eligible = commissions.filter((commission) => !payoutItemCommissionIds.has(commission.id) && isCommissionEligible(commission, nowIso));
        const pending = commissions.filter((commission) => commission.status === 'pending' || commission.status === 'eligible');
        const processing = commissions.filter((commission) => commission.status === 'scheduled');
        const paid = commissions.filter((commission) => commission.status === 'paid');
        const canceled = commissions.filter((commission) => commission.status === 'canceled' || commission.status === 'refunded');
        return {
            eligibleAmount: eligible.reduce((total, commission) => total + Number(commission.commission_amount_cents ?? 0), 0),
            pendingAmount: pending.reduce((total, commission) => total + Number(commission.commission_amount_cents ?? 0), 0),
            processingAmount: processing.reduce((total, commission) => total + Number(commission.commission_amount_cents ?? 0), 0),
            paidAmount: paid.reduce((total, commission) => total + Number(commission.commission_amount_cents ?? 0), 0),
            canceledAmount: canceled.reduce((total, commission) => total + Number(commission.commission_amount_cents ?? 0), 0),
            eligibleCount: eligible.length,
        };
    }, [dashboard?.commissions, paidAt, payoutItemCommissionIds]);
    const selectedCreatorProfile = selectedCreatorIds.length === 1
        ? dashboard?.creatorProfiles.find((profile) => profile.user_id === selectedCreatorIds[0])
        : null;
    const canSendPix = selectedCommissionIds.length > 0 &&
        selectedCreatorIds.length === 1 &&
        selectedCourseIds.length === 1 &&
        selectedAmount > 0 &&
        Boolean(selectedCreatorProfile?.is_payout_enabled && selectedCreatorProfile.pix_key && selectedCreatorProfile.pix_key_type);
    const canRegisterExternal = selectedCommissionIds.length > 0 &&
        selectedCreatorIds.length === 1 &&
        selectedAmount > 0;
    function toggleCommission(commission: AdminCreatorCommission) {
        const paidAtIso = new Date(paidAt).toISOString();
        if (!isCommissionEligible(commission, paidAtIso) || payoutItemCommissionIds.has(commission.id)) {
            return;
        }
        setSelectedCommissionIds((current) => (current.includes(commission.id)
            ? current.filter((id) => id !== commission.id)
            : [...current, commission.id]));
    }
    async function handleSaveSettings() {
        setIsSavingSettings(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await updateCreatorPayoutSettings({
                mode: settingsForm.mode,
                intervalDays: settingsForm.intervalDays,
                minimumAmountCents: settingsForm.minimumAmountCents,
                isEnabled: settingsForm.isEnabled,
                nextRunAt: new Date(settingsForm.nextRunAt).toISOString(),
            });
            setMessage('Configurações de repasse salvas com sucesso.');
            await loadDashboard();
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Não foi possível salvar as configurações.');
        }
        finally {
            setIsSavingSettings(false);
        }
    }
    async function handleProcessCycle() {
        setIsProcessingCycle(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            const result = await processDueCreatorPayouts(true);
            const paidCount = result?.payouts?.length ?? 0;
            const syncedCount = result?.synced?.length ?? 0;
            const failureCount = result?.failures?.length ?? 0;
            setMessage(`Ciclo executado: ${paidCount} repasse(s), ${syncedCount} sincronizado(s), ${failureCount} falha(s).`);
            await loadDashboard();
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Não foi possível executar o ciclo automático.');
        }
        finally {
            setIsProcessingCycle(false);
        }
    }
    async function handleRegisterExternalPayout() {
        if (!canRegisterExternal) {
            setErrorMessage('Selecione comissões elegíveis de um único autor com total maior que zero.');
            return;
        }
        setIsRegisteringExternal(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            await registerPaidCreatorPayout({
                creatorId: selectedCreatorIds[0],
                commissionIds: selectedCommissionIds,
                paidAt: new Date(paidAt).toISOString(),
                notes,
            });
            setMessage('Pagamento externo registrado com sucesso.');
            setNotes('');
            await loadDashboard();
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Não foi possível registrar o pagamento externo.');
        }
        finally {
            setIsRegisteringExternal(false);
        }
    }
    async function handleSendPixPayout() {
        if (!canSendPix) {
            setErrorMessage('Para pagar via Asaas, selecione comissões elegíveis de um único autor e um único curso com PIX habilitado.');
            return;
        }
        const confirmed = window.confirm("Confirmar envio do PIX via Asaas para o autor selecionado");
        if (!confirmed) {
            return;
        }
        setIsSendingPix(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            const result = await sendPixCreatorPayout({
                creatorId: selectedCreatorIds[0],
                commissionIds: selectedCommissionIds,
                notes,
            });
            setMessage(`PIX enviado ao Asaas. Status: ${result?.externalStatus ?? result?.status ?? 'processando'}.`);
            setNotes('');
            await loadDashboard();
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Não foi possível enviar o PIX via Asaas.');
        }
        finally {
            setIsSendingPix(false);
        }
    }
    return (<div className="animate-in space-y-7 fade-in duration-500">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Autores</p>
          <h2 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Comissões e repasses PIX</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#5F7077]">
            Configure o ciclo de repasses, envie PIX pelo Asaas ou registre pagamentos externos quando a operação exigir.
          </p>
        </div>

        <Button type="button" onClick={() => void loadDashboard()} disabled={isLoading} variant="outline" className="border-[#D8E6EB] font-black text-[#15323b]">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/>
          Atualizar
        </Button>
      </header>

      {errorMessage ? (<div className="border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
          {errorMessage}
        </div>) : null}

      {message ? (<div className="border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
        <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Configuração global</p>
          <h3 className="mt-2 font-readex text-xl font-semibold text-[#15323b]">Automação dos repasses</h3>
          <p className="mt-1 text-sm font-medium leading-6 text-[#5F7077]">
            Esta configuração aparece para os autores e controla o ciclo automático de PIX via Asaas.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Modo</span>
              <select value={settingsForm.mode} onChange={(event) => setSettingsForm((current) => ({ ...current, mode: event.target.value as CreatorPayoutMode }))} className="mt-2 h-12 w-full border border-[#D8E6EB] bg-white px-4 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]">
                <option value="automatic">Automático</option>
                <option value="manual">Manual</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Intervalo</span>
              <input type="number" min={1} max={90} value={settingsForm.intervalDays} onChange={(event) => setSettingsForm((current) => ({ ...current, intervalDays: Number(event.target.value || 1) }))} className="mt-2 h-12 w-full border border-[#D8E6EB] bg-white px-4 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]"/>
            </label>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Valor mínimo</span>
              <input type="number" min={0} value={Math.round(settingsForm.minimumAmountCents / 100)} onChange={(event) => setSettingsForm((current) => ({ ...current, minimumAmountCents: Number(event.target.value || 0) * 100 }))} className="mt-2 h-12 w-full border border-[#D8E6EB] bg-white px-4 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]"/>
            </label>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Próxima execução</span>
              <input type="datetime-local" value={settingsForm.nextRunAt} onChange={(event) => setSettingsForm((current) => ({ ...current, nextRunAt: event.target.value }))} className="mt-2 h-12 w-full border border-[#D8E6EB] bg-white px-4 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]"/>
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-2 text-sm font-bold text-[#15323b]">
              <input type="checkbox" checked={settingsForm.isEnabled} onChange={(event) => setSettingsForm((current) => ({ ...current, isEnabled: event.target.checked }))} className="h-4 w-4 accent-[#1398B7]"/>
              Automação habilitada
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void handleProcessCycle()} disabled={isProcessingCycle} variant="outline" className="border-[#1398B7] font-black text-[#0A3640]">
                <Zap className="mr-2 h-4 w-4"/>
                {isProcessingCycle ? 'Executando...' : 'Executar ciclo agora'}
              </Button>
              <Button type="button" onClick={() => void handleSaveSettings()} disabled={isSavingSettings} className="bg-gradient-to-b from-[#1398B7] to-[#0A3640] font-black text-white hover:opacity-95">
                {isSavingSettings ? 'Salvando...' : 'Salvar configuração'}
              </Button>
            </div>
          </div>
        </article>

        <section className="grid gap-3 md:grid-cols-2">
          {[
            ['Elegível agora', metrics.eligibleAmount, `${metrics.eligibleCount} comissão(ões)`],
            ['Em processamento', metrics.processingAmount, 'PIX enviado ou agendado'],
            ['Já repassado', metrics.paidAmount, 'confirmado'],
            ['Cancelado/estornado', metrics.canceledAmount, 'não entra em repasse'],
        ].map(([label, value, detail]) => (<article key={label.toString()} className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">{label}</p>
              <p className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">
                {formatMoneyFromCents(Number(value))}
              </p>
              <p className="mt-2 text-xs font-semibold text-[#6d7f84]">{detail}</p>
            </article>))}
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="space-y-5">
          <article className="border border-[#D8E6EB] bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Autor</span>
                <select value={selectedCreatorId} onChange={(event) => {
            setSelectedCreatorId(event.target.value);
            setSelectedCommissionIds([]);
        }} className="mt-2 h-12 w-full border border-[#D8E6EB] bg-white px-4 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]">
                  <option value="">Todos os autores</option>
                  {creators.map((creator) => (<option key={creator.id} value={creator.id}>{creator.label}</option>))}
                </select>
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Status</span>
                <select value={statusFilter} onChange={(event) => {
            setStatusFilter(event.target.value);
            setSelectedCommissionIds([]);
        }} className="mt-2 h-12 w-full border border-[#D8E6EB] bg-white px-4 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]">
                  <option value="eligible">Elegíveis para repasse</option>
                  <option value="blocked">Pendentes/futuras ou bloqueadas</option>
                  <option value="paid">Pagas</option>
                  <option value="all">Todas</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Data de referência</span>
                <input type="datetime-local" value={paidAt} onChange={(event) => {
            setPaidAt(event.target.value);
            setSelectedCommissionIds([]);
        }} className="mt-2 h-12 w-full border border-[#D8E6EB] bg-white px-4 text-sm font-bold text-[#15323b] outline-none focus:border-[#1398B7]"/>
              </label>
            </div>
          </article>

          <article className="overflow-hidden border border-[#D8E6EB] bg-white shadow-sm">
            <div className="border-b border-[#D8E6EB] px-5 py-4">
              <h3 className="font-readex text-xl font-semibold text-[#15323b]">Comissões</h3>
              <p className="mt-1 text-sm font-medium text-[#5F7077]">
                Para PIX via Asaas, selecione comissões de um único autor e de um único curso.
              </p>
            </div>

            {isLoading ? (<p className="p-5 text-sm font-medium text-[#5F7077]">Carregando comissões...</p>) : filteredCommissions.length === 0 ? (<div className="p-6">
                <p className="font-readex text-lg font-semibold text-[#15323b]">Nenhuma comissão encontrada.</p>
                <p className="mt-2 text-sm leading-6 text-[#5F7077]">
                  Ajuste os filtros ou aguarde novas vendas confirmadas pelo checkout.
                </p>
              </div>) : (<div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
                  <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.18em] text-[#5F7077]">
                    <tr>
                      <th className="px-5 py-3">Selecionar</th>
                      <th className="px-5 py-3">Autor</th>
                      <th className="px-5 py-3">Curso</th>
                      <th className="px-5 py-3">Comissão</th>
                      <th className="px-5 py-3">Elegível em</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8E6EB]">
                    {filteredCommissions.map((commission) => {
                const eligible = isCommissionEligible(commission, new Date(paidAt).toISOString()) && !payoutItemCommissionIds.has(commission.id);
                const checked = selectedCommissionIds.includes(commission.id);
                return (<tr key={commission.id} className="align-top">
                          <td className="px-5 py-4">
                            <input type="checkbox" checked={checked} disabled={!eligible} onChange={() => toggleCommission(commission)} className="h-4 w-4 accent-[#1398B7]" aria-label="Selecionar comissão"/>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-black text-[#15323b]">{getCreatorLabel(dashboard, commission.creator_id)}</p>
                          </td>
                          <td className="px-5 py-4 font-semibold text-[#5F7077]">
                            {getCourseTitle(dashboard, commission.course_id)}
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-black text-[#15323b]">{formatMoneyFromCents(commission.commission_amount_cents)}</p>
                            <p className="mt-1 text-xs font-semibold text-[#5F7077]">
                              {commission.adjustment_for_commission_id ? 'Ajuste de estorno' : `${commission.commission_rate}% de ${formatMoneyFromCents(commission.gross_amount_cents)}`}
                            </p>
                          </td>
                          <td className="px-5 py-4 font-semibold text-[#5F7077]">
                            {formatDateTime(commission.eligible_at)}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(commission.status)}`}>
                              {formatStatus(commission.status)}
                            </span>
                            {payoutItemCommissionIds.has(commission.id) ? (<p className="mt-2 text-xs font-semibold text-[#5F7077]">Já incluída em repasse.</p>) : null}
                          </td>
                        </tr>);
            })}
                  </tbody>
                </table>
              </div>)}
          </article>
        </div>

        <div className="space-y-5">
          <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Lote selecionado</p>
            <h3 className="mt-2 font-readex text-xl font-semibold text-[#15323b]">Enviar ou registrar repasse</h3>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-[#D8E6EB] pb-3">
                <span className="font-semibold text-[#5F7077]">Comissões</span>
                <span className="font-black text-[#15323b]">{selectedCommissionIds.length}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#D8E6EB] pb-3">
                <span className="font-semibold text-[#5F7077]">Total líquido</span>
                <span className="font-black text-[#15323b]">{formatMoneyFromCents(selectedAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#D8E6EB] pb-3">
                <span className="font-semibold text-[#5F7077]">Autor</span>
                <span className="max-w-[180px] truncate font-black text-[#15323b]">
                  {selectedCreatorIds.length === 1 ? getCreatorLabel(dashboard, selectedCreatorIds[0]) : 'Selecione um autor'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[#D8E6EB] pb-3">
                <span className="font-semibold text-[#5F7077]">Curso</span>
                <span className="max-w-[180px] truncate font-black text-[#15323b]">
                  {selectedCourseIds.length === 1 ? getCourseTitle(dashboard, selectedCourseIds[0]) : 'Obrigatório para Asaas'}
                </span>
              </div>
            </div>

            <div className="mt-5 border border-[#D8E6EB] bg-[#F2F7F9] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Dados PIX</p>
              {selectedCreatorProfile ? (<div className="mt-3 space-y-2 text-sm font-semibold text-[#15323b]">
                  <p>Favorecido: {selectedCreatorProfile.payout_name ?? 'Não informado'}</p>
                  <p>Tipo: {selectedCreatorProfile.pix_key_type ?? 'Não informado'}</p>
                  <p className="break-all">Chave: {selectedCreatorProfile.pix_key ?? 'Não informada'}</p>
                  <p>Repasse habilitado: {selectedCreatorProfile.is_payout_enabled ? 'Sim' : 'Não'}</p>
                </div>) : (<p className="mt-3 text-sm font-semibold text-[#5F7077]">
                  Selecione comissões de um único autor para conferir os dados PIX.
                </p>)}
            </div>

            <label className="mt-5 block">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5F7077]">Observação</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 min-h-28 w-full border border-[#D8E6EB] bg-white px-4 py-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]" placeholder="Ex.: Repasse PIX via Asaas ou pagamento externo conferido manualmente."/>
            </label>

            <div className="mt-5 grid gap-3">
              <Button type="button" onClick={() => void handleSendPixPayout()} disabled={isSendingPix || !canSendPix} className="h-12 w-full bg-gradient-to-b from-[#1398B7] to-[#0A3640] font-black text-white hover:opacity-95">
                {isSendingPix ? 'Enviando PIX...' : 'Pagar via Asaas'}
              </Button>
              <Button type="button" onClick={() => void handleRegisterExternalPayout()} disabled={isRegisteringExternal || !canRegisterExternal} variant="outline" className="h-12 w-full border-[#D8E6EB] font-black text-[#15323b]">
                {isRegisteringExternal ? 'Registrando...' : 'Registrar pagamento externo'}
              </Button>
            </div>
          </article>

          <article className="border border-[#D8E6EB] bg-white p-6 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">Histórico</p>
            <h3 className="mt-2 font-readex text-xl font-semibold text-[#15323b]">Últimos repasses</h3>
            <div className="mt-5 space-y-3">
              {(dashboard?.payouts ?? []).length === 0 ? (<p className="text-sm font-medium text-[#5F7077]">Nenhum repasse registrado ainda.</p>) : ((dashboard?.payouts ?? []).slice(0, 8).map((payout) => (<div key={payout.id} className="border border-[#D8E6EB] bg-[#F2F7F9] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-[#15323b]">{getCreatorLabel(dashboard, payout.creator_id)}</p>
                        <p className="mt-1 text-xs font-semibold text-[#5F7077]">
                          {getCourseTitle(dashboard, payout.course_id ?? '')} · {payout.payout_method === 'asaas' ? 'Asaas' : 'Externo'}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#5F7077]">{formatDateTime(payout.paid_at ?? payout.created_at)}</p>
                      </div>
                      <span className={`border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone(payout.status)}`}>
                        {formatStatus(payout.status)}
                      </span>
                    </div>
                    <p className="mt-3 font-readex text-xl font-semibold text-[#15323b]">
                      {formatMoneyFromCents(payout.amount_cents)}
                    </p>
                    {payout.external_transfer_id ? (<p className="mt-2 break-all text-xs font-semibold text-[#5F7077]">
                        Transferência: {payout.external_transfer_id} · {payout.external_status ?? 'sem status'}
                      </p>) : null}
                    {payout.failure_reason ? (<p className="mt-2 text-xs font-semibold text-rose-700">{payout.failure_reason}</p>) : null}
                  </div>)))}
            </div>
          </article>
        </div>
      </section>
    </div>);
}
