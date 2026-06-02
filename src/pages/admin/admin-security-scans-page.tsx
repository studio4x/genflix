import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fetchSecurityDashboard, fixSecurityFinding, runSecurityScan, updateSecuritySettings, type SecurityScanDashboard, } from '@/features/admin/security-scans/api';
function formatDateTime(value: string | null) {
    if (!value)
        return '-';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
function severityClassName(severity: string) {
    if (severity === 'critical')
        return 'border-rose-200 bg-rose-50 text-rose-700';
    if (severity === 'high')
        return 'border-red-200 bg-red-50 text-red-700';
    if (severity === 'medium')
        return 'border-amber-200 bg-amber-50 text-amber-700';
    if (severity === 'low')
        return 'border-blue-200 bg-blue-50 text-blue-700';
    return 'border-[#D8E6EB] bg-[#F2F7F9] text-[#5F7077]';
}
export function AdminSecurityScansPage() {
    const [dashboard, setDashboard] = useState<SecurityScanDashboard | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [fixingFindingId, setFixingFindingId] = useState<string | null>(null);
    const [cronExpression, setCronExpression] = useState('0 */6 * * *');
    const [autoFixEnabled, setAutoFixEnabled] = useState(false);
    const [scheduleEnabled, setScheduleEnabled] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const latestRun = dashboard?.runs[0] ?? null;
    const counters = useMemo(() => {
        const findings = dashboard?.findings ?? [];
        return {
            total: findings.length,
            open: findings.filter((item) => item.status === 'open').length,
            fixed: findings.filter((item) => item.status === 'fixed').length,
            autoFixCapable: findings.filter((item) => item.auto_fix_supported).length,
        };
    }, [dashboard?.findings]);
    async function loadDashboard() {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const data = await fetchSecurityDashboard();
            setDashboard(data);
            setCronExpression(data.settings.cron_expression);
            setAutoFixEnabled(data.settings.auto_fix_enabled);
            setScheduleEnabled(data.settings.enabled);
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Falha ao carregar central de seguran?a.");
        }
        finally {
            setIsLoading(false);
        }
    }
    useEffect(() => {
        void loadDashboard();
    }, []);
    async function handleRunScan() {
        setIsRunning(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const data = await runSecurityScan();
            setDashboard(data);
            setSuccessMessage('Varredura concluida. A lista de achados foi atualizada.');
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Falha ao executar varredura.');
        }
        finally {
            setIsRunning(false);
        }
    }
    async function handleSaveSettings() {
        setIsSaving(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const data = await updateSecuritySettings({
                cronExpression,
                autoFixEnabled,
                enabled: scheduleEnabled,
            });
            setDashboard(data);
            setSuccessMessage("Configurao de cron e auto-correcao salva com sucesso.");
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Falha ao salvar configura??o.");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleFixFinding(findingId: string) {
        setFixingFindingId(findingId);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
            const data = await fixSecurityFinding(findingId);
            setDashboard(data);
            setSuccessMessage("Correcao aplicada e registrada no hist?rico.");
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Falha ao aplicar correcao.');
        }
        finally {
            setFixingFindingId(null);
        }
    }
    return (<div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Plataforma</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Central de Seguranca</h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
            Execute varreduras de vulnerabilidades, arquivos suspeitos, malware e hardening. Configure o cron da rotina,
            aplique correcoes por item e acompanhe as auto-correcoes realizadas.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => void loadDashboard()} disabled={isLoading} className="h-11 rounded-none border-[#D8E6EB] bg-white font-black text-[#0A3640] hover:border-[#1398B7]">
            <RefreshCw className={cn('mr-2 h-4 w-4', isLoading ? 'animate-spin' : '')}/>
            Atualizar
          </Button>
          <Button type="button" onClick={() => void handleRunScan()} disabled={isRunning || isLoading} className="h-11 rounded-none bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-5 font-black text-white hover:opacity-95">
            <ShieldCheck className="mr-2 h-4 w-4"/>
            {isRunning ? 'Executando varredura...' : 'Executar varredura agora'}
          </Button>
        </div>
      </header>

      {errorMessage ? <div className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{errorMessage}</div> : null}
      {successMessage ? <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{successMessage}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
            { label: 'Achados', value: counters.total, helper: 'Itens detectados nas ultimas varreduras' },
            { label: 'Abertos', value: counters.open, helper: 'Aguardando correcao' },
            { label: 'Corrigidos', value: counters.fixed, helper: 'Com registro [OK] no painel' },
            { label: "Auto-fix disponvel", value: counters.autoFixCapable, helper: 'Itens com correcao automatizada' },
        ].map((card) => (<article key={card.label} className="border border-[#D8E6EB] bg-white p-5 shadow-[0_14px_34px_rgba(10,54,64,0.05)]">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5F7077]">{card.label}</p>
            <p className="mt-3 font-readex text-4xl font-semibold text-[#0A3640]">{card.value}</p>
            <p className="mt-2 text-sm font-semibold text-[#6d7f84]">{card.helper}</p>
          </article>))}
      </section>

      <section className="border border-[#D8E6EB] bg-white p-6 shadow-[0_18px_42px_rgba(10,54,64,0.05)]">
        <div className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Agendamento</p>
            <h2 className="mt-2 font-readex text-2xl font-semibold text-[#15323b]">Cron da varredura de seguran?a</h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[#6d7f84]">
              Configure a expressao cron executada pelo Supabase e habilite auto-correcao para que os itens suportados
              sejam corrigidos assim que detectados.
            </p>
          </div>
          <div className="border border-[#D8E6EB] bg-[#F2F7F9] px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Ultima execucao</p>
            <p className="mt-1 text-sm font-semibold text-[#15323b]">{formatDateTime(latestRun?.started_at ?? null)}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Expressao cron</span>
            <input value={cronExpression} onChange={(event) => setCronExpression(event.target.value)} className="h-12 w-full border border-[#D8E6EB] px-4 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]" placeholder="0 */6 * * *"/>
            <p className="text-xs font-semibold text-[#6d7f84]">Exemplo: `0 */6 * * *` executa a cada 6 horas.</p>
          </label>

          <Button type="button" onClick={() => void handleSaveSettings()} disabled={isSaving} className="h-12 rounded-none bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-6 font-black text-white hover:opacity-95">
            {isSaving ? 'Salvando...' : "Salvar configura??o"}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-6">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#15323b]">
            <input type="checkbox" checked={scheduleEnabled} onChange={(event) => setScheduleEnabled(event.target.checked)}/>
            Agendamento habilitado
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#15323b]">
            <input type="checkbox" checked={autoFixEnabled} onChange={(event) => setAutoFixEnabled(event.target.checked)}/>Correcao automtica ao detectar problema
          </label>
        </div>
      </section>

      <section className="border border-[#D8E6EB] bg-white p-6 shadow-[0_18px_42px_rgba(10,54,64,0.05)]">
        <div className="flex items-center justify-between gap-3 border-b border-[#D8E6EB] pb-4">
          <h2 className="font-readex text-2xl font-semibold text-[#15323b]">Problemas encontrados</h2>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-[#5F7077]">{dashboard?.findings.length ?? 0} itens</span>
        </div>

        <div className="mt-5 space-y-3">
          {(dashboard?.findings ?? []).length === 0 ? (<div className="border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
              Nenhum problema encontrado ate o momento.
            </div>) : (dashboard?.findings.map((finding) => (<article key={finding.id} className="border border-[#D8E6EB] bg-[#FDFEFE] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]', severityClassName(finding.severity))}>
                        {finding.severity}
                      </span>
                      <span className={cn('inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]', finding.status === 'fixed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
                        {finding.status === 'fixed' ? '[OK]' : '[ ]'}
                      </span>
                    </div>
                    <h3 className="mt-2 font-readex text-xl font-semibold text-[#15323b]">{finding.title}</h3>
                    <p className="mt-2 text-sm font-medium text-[#5F7077]">{finding.description}</p>
                    {finding.evidence ? <p className="mt-2 text-xs font-semibold text-[#6d7f84]">Evidencia: {finding.evidence}</p> : null}
                    {finding.recommendation ? <p className="mt-1 text-xs font-semibold text-[#6d7f84]">Acao recomendada: {finding.recommendation}</p> : null}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    {finding.fix_available && finding.status === 'open' ? (<Button type="button" onClick={() => void handleFixFinding(finding.id)} disabled={fixingFindingId === finding.id} className="h-10 rounded-none bg-gradient-to-b from-[#1398B7] to-[#0A3640] px-4 text-xs font-black uppercase tracking-[0.16em] text-white">
                        <Wrench className="mr-2 h-3.5 w-3.5"/>
                        {fixingFindingId === finding.id ? 'Corrigindo...' : 'Corrigir'}
                      </Button>) : null}

                    {finding.status === 'fixed' ? (<span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                        <CheckCircle2 className="h-4 w-4"/> [OK]
                      </span>) : (<span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.16em] text-amber-700">
                        <ShieldAlert className="h-4 w-4"/> [ ]
                      </span>)}
                  </div>
                </div>
              </article>)))}
        </div>
      </section>

      <section className="border border-[#D8E6EB] bg-white p-6 shadow-[0_18px_42px_rgba(10,54,64,0.05)]">
        <h2 className="border-b border-[#D8E6EB] pb-4 font-readex text-2xl font-semibold text-[#15323b]">Correcoes automticas e manuais aplicadas</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
            <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8E6EB]">
              {(dashboard?.fixes ?? []).length === 0 ? (<tr>
                  <td colSpan={4} className="px-4 py-4 text-sm font-semibold text-[#6d7f84]">Nenhuma correcao registrada ainda.</td>
                </tr>) : ((dashboard?.fixes ?? []).map((fix) => (<tr key={fix.id} className="align-top">
                    <td className="px-4 py-3 text-xs font-semibold text-[#5F7077]">{formatDateTime(fix.created_at)}</td>
                    <td className="px-4 py-3 text-xs font-black uppercase text-[#15323b]">{fix.action_type}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]', fix.status === 'applied' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700')}>
                        {fix.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-[#5F7077]">{fix.details ?? '-'}</td>
                  </tr>)))}
            </tbody>
          </table>
        </div>
      </section>
    </div>);
}
