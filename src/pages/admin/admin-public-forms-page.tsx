import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { genflixCategoryTiles } from '@/features/public/genflix-site-content';
import { fetchSiteContent, saveSiteContentEntry } from '@/features/site-editor/api';
import type { SitePageKey } from '@/features/site-editor/types';
import { supabase } from '@/services/supabase/client';
interface PublicFormSubmission {
    id: string;
    form_type: string;
    name: string | null;
    email: string | null;
    message: string | null;
    payload: Record<string, unknown>;
    source_path: string | null;
    source_url: string | null;
    created_at: string;
}
type FormsTabKey = 'submissions' | 'forms';
type FormEditableField = {
    key: string;
    label: string;
    entryKey: string;
    pageKey: SitePageKey;
    fallback: string;
};
type SiteFormDefinition = {
    id: string;
    label: string;
    description: string;
    route: string;
    pageKey: SitePageKey;
    editableFields: FormEditableField[];
};
type CustomFormField = {
    id: string;
    label: string;
    type: 'text' | 'email' | 'textarea' | 'select' | 'checkbox';
    placeholder?: string;
    required?: boolean;
};
const hiddenNewsletterAreas = new Set(["Psican?lise / Psicologia", 'Interesse Geral']);
const newsletterSelectableAreas = genflixCategoryTiles
    .map((category) => category.label)
    .filter((area) => !hiddenNewsletterAreas.has(area));
const newsletterAreaFields: FormEditableField[] = newsletterSelectableAreas.map((area) => ({
    key: `areaOption_${area.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    label: `Opcao de area: ${area}`,
    entryKey: `global.newsletter.form.interest.option.${area.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    pageKey: 'global',
    fallback: area,
}));
const formDefinitions: SiteFormDefinition[] = [
    {
        id: 'contact',
        label: 'Contato',
        description: "Formulario pblico de contato.",
        route: '/contato',
        pageKey: 'contact',
        editableFields: [
            { key: 'title', label: "T?tulo", entryKey: 'contact.title', pageKey: 'contact', fallback: 'Fale com a gente.' },
            { key: 'description', label: "Descri??o", entryKey: 'contact.description', pageKey: 'contact', fallback: "Duvidas, sugestoes ou suporte - est?mos aqui." },
            { key: 'submit', label: 'Texto do botao', entryKey: 'contact.form.submit', pageKey: 'contact', fallback: 'Enviar' },
            { key: 'nameLabel', label: 'Rotulo nome', entryKey: 'contact.form.name.label', pageKey: 'contact', fallback: "N?ome completo:" },
            { key: 'emailLabel', label: 'Rotulo e-mail', entryKey: 'contact.form.email.label', pageKey: 'contact', fallback: 'E-mail:' },
            { key: 'messageLabel', label: 'Rotulo mensagem', entryKey: 'contact.form.message.label', pageKey: 'contact', fallback: 'Assunto:' },
        ],
    },
    {
        id: 'teach',
        label: 'Ensine na GenFlix',
        description: 'Formulario para professores e criadores.',
        route: '/ensine-na-genflix',
        pageKey: 'global',
        editableFields: [
            { key: 'title', label: "T?tulo", entryKey: 'global.teach.title', pageKey: 'global', fallback: 'Ensine na GenFlix' },
            { key: 'description', label: "Descri??o", entryKey: 'global.teach.description', pageKey: 'global', fallback: "Duvidas, sugestoes ou suporte - est?mos aqui." },
            { key: 'submit', label: 'Texto do botao', entryKey: 'global.teach.form.submit', pageKey: 'global', fallback: 'Enviar' },
            { key: 'nameLabel', label: 'Rotulo nome', entryKey: 'global.teach.form.name.label', pageKey: 'global', fallback: "N?ome completo:" },
            { key: 'emailLabel', label: 'Rotulo e-mail', entryKey: 'global.teach.form.email.label', pageKey: 'global', fallback: 'E-mail:' },
            { key: 'messageLabel', label: 'Rotulo mensagem', entryKey: 'global.teach.form.message.label', pageKey: 'global', fallback: 'Assunto:' },
        ],
    },
    {
        id: 'newsletter',
        label: 'Newsletter',
        description: 'Formulario de inscricao em newsletter.',
        route: '/#newsletter',
        pageKey: 'global',
        editableFields: [
            { key: 'title', label: "T?tulo", entryKey: 'global.newsletter.title', pageKey: 'global', fallback: 'Assine nossa newsletter' },
            { key: 'description', label: "Descri??o", entryKey: 'global.newsletter.description', pageKey: 'global', fallback: "Cadastre-se para receber atualizacoes sobre nossos cursos e contedo." },
            { key: 'placeholder', label: 'Placeholder do e-mail', entryKey: 'global.newsletter.placeholder', pageKey: 'global', fallback: 'Seu@e-mail.com' },
            { key: 'button', label: 'Texto do botao', entryKey: 'global.newsletter.button.label', pageKey: 'global', fallback: 'Quero me inscrever' },
            { key: 'areasTitle', label: "T?tulo areas", entryKey: 'global.newsletter.form.interest.title', pageKey: 'global', fallback: 'Areas de interesse' },
            { key: 'areasDescription', label: "Descri??o areas", entryKey: 'global.newsletter.form.interest.description', pageKey: 'global', fallback: 'Selecione as areas que mais combinam com o seu foco de estudos.' },
            { key: 'allAreasLabel', label: 'Opcao todas as areas', entryKey: 'global.newsletter.form.interest.all_label', pageKey: 'global', fallback: 'Todas as areas' },
            ...newsletterAreaFields,
        ],
    },
    {
        id: 'auth-login',
        label: 'Login',
        description: "Formulario de acesso do usurio.",
        route: '/login',
        pageKey: 'global',
        editableFields: [
            { key: 'title', label: "T?tulo", entryKey: 'global.auth.login.title', pageKey: 'global', fallback: 'Acesse sua conta' },
            { key: 'subtitle', label: "Descri??o", entryKey: 'global.auth.login.subtitle', pageKey: 'global', fallback: 'Entre para acompanhar seus cursos e progresso.' },
            { key: 'backLinkLabel', label: 'Texto voltar', entryKey: 'global.auth.login.backLinkLabel', pageKey: 'global', fallback: "Voltar ao incio" },
        ],
    },
    {
        id: 'auth-signup',
        label: 'Criar conta',
        description: 'Formulario de cadastro.',
        route: '/criar-conta',
        pageKey: 'global',
        editableFields: [
            { key: 'title', label: "T?tulo", entryKey: 'global.auth.signup.title', pageKey: 'global', fallback: 'Crie sua conta' },
            { key: 'subtitle', label: "Descri??o", entryKey: 'global.auth.signup.subtitle', pageKey: 'global', fallback: 'Comece agora sua jornada de estudos.' },
            { key: 'backLinkLabel', label: 'Texto voltar', entryKey: 'global.auth.signup.backLinkLabel', pageKey: 'global', fallback: "Voltar ao incio" },
        ],
    },
    {
        id: 'auth-forgot',
        label: 'Recuperar senha',
        description: 'Formulario para solicitar redefinicao.',
        route: '/recuperar-senha',
        pageKey: 'global',
        editableFields: [
            { key: 'title', label: "T?tulo", entryKey: 'global.auth.forgotPassword.title', pageKey: 'global', fallback: 'Recuperar senha' },
            { key: 'subtitle', label: "Descri??o", entryKey: 'global.auth.forgotPassword.subtitle', pageKey: 'global', fallback: 'Informe seu e-mail para receber as instrucoes.' },
            { key: 'backLinkLabel', label: 'Texto voltar', entryKey: 'global.auth.forgotPassword.backLinkLabel', pageKey: 'global', fallback: "Voltar ao incio" },
        ],
    },
    {
        id: 'auth-reset',
        label: 'Redefinir senha',
        description: 'Formulario para redefinir senha.',
        route: '/redefinir-senha',
        pageKey: 'global',
        editableFields: [
            { key: 'title', label: "T?tulo", entryKey: 'global.auth.resetPassword.title', pageKey: 'global', fallback: 'Defina uma nova senha' },
            { key: 'subtitle', label: "Descri??o", entryKey: 'global.auth.resetPassword.subtitle', pageKey: 'global', fallback: 'Escolha uma senha forte para acessar sua conta.' },
            { key: 'backLinkLabel', label: 'Texto voltar', entryKey: 'global.auth.resetPassword.backLinkLabel', pageKey: 'global', fallback: "Voltar ao incio" },
        ],
    },
];
function formatDateTime(value: string) {
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value));
}
function escapeCsvValue(value: unknown) {
    const stringValue = value == null ? '' : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
}
function readInterestAreas(item: PublicFormSubmission) {
    const interestAreas = item.payload.interest_areas;
    if (!Array.isArray(interestAreas)) {
        return [];
    }
    return interestAreas
        .map((area) => (typeof area === 'string' ? area.trim() : ''))
        .filter((area) => area.length > 0);
}
export function AdminPublicFormsPage() {
    const [items, setItems] = useState<PublicFormSubmission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<FormsTabKey>('submissions');
    const [formFilter, setFormFilter] = useState('all');
    const [interestAreaFilter, setInterestAreaFilter] = useState('all');
    const [selectedFormId, setSelectedFormId] = useState(formDefinitions[0]?.id ?? 'contact');
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [customFieldsByForm, setCustomFieldsByForm] = useState<Record<string, CustomFormField[]>>({});
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [configFeedback, setConfigFeedback] = useState<string | null>(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(false);
    async function loadSubmissions() {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const result = await supabase
                .from('public_form_submissions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(250);
            if (result.error) {
                throw result.error;
            }
            setItems((result.data ?? []) as PublicFormSubmission[]);
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "N?o foi possvel carregar formularios.");
        }
        finally {
            setIsLoading(false);
        }
    }
    useEffect(() => {
        void loadSubmissions();
    }, []);
    useEffect(() => {
        if (formFilter !== 'newsletter') {
            setInterestAreaFilter('all');
        }
    }, [formFilter]);
    const filteredItems = useMemo(() => {
        let currentItems = formFilter === 'all'
            ? items
            : items.filter((item) => item.form_type === formFilter);
        if (formFilter === 'newsletter' && interestAreaFilter !== 'all') {
            currentItems = currentItems.filter((item) => readInterestAreas(item).includes(interestAreaFilter));
        }
        return currentItems;
    }, [formFilter, interestAreaFilter, items]);
    const newsletterInterestAreas = useMemo(() => {
        const areaSet = new Set<string>();
        items
            .filter((item) => item.form_type === 'newsletter')
            .forEach((item) => {
            readInterestAreas(item).forEach((area) => areaSet.add(area));
        });
        return Array.from(areaSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [items]);
    const selectedForm = useMemo(() => formDefinitions.find((form) => form.id === selectedFormId) ?? formDefinitions[0], [selectedFormId]);
    useEffect(() => {
        if (!selectedForm)
            return;
        setIsLoadingConfig(true);
        setConfigFeedback(null);
        async function loadFormConfig() {
            try {
                const rows = await fetchSiteContent(selectedForm.pageKey);
                const nextValues: Record<string, string> = {};
                selectedForm.editableFields.forEach((field) => {
                    const existing = rows.find((row) => row.page_key === field.pageKey && row.entry_key === field.entryKey);
                    nextValues[field.key] = typeof existing?.value === 'string' && existing.value.trim() !== '' ? existing.value : field.fallback;
                });
                const customEntryKey = `global.forms.${selectedForm.id}.customFields`;
                const customEntry = rows.find((row) => row.page_key === 'global' && row.entry_key === customEntryKey);
                const customFields = Array.isArray(customEntry?.value)
                    ? (customEntry.value as CustomFormField[])
                    : [];
                setFieldValues(nextValues);
                setCustomFieldsByForm((current) => ({ ...current, [selectedForm.id]: customFields }));
            }
            catch (error) {
                setConfigFeedback(error instanceof Error ? error.message : "N?o foi possvel carregar as configura??es do formulario.");
            }
            finally {
                setIsLoadingConfig(false);
            }
        }
        void loadFormConfig();
    }, [selectedForm]);
    const selectedCustomFields = selectedForm ? (customFieldsByForm[selectedForm.id] ?? []) : [];
    function updateCustomField(fieldId: string, updater: (field: CustomFormField) => CustomFormField) {
        if (!selectedForm)
            return;
        setCustomFieldsByForm((current) => {
            const currentList = current[selectedForm.id] ?? [];
            return {
                ...current,
                [selectedForm.id]: currentList.map((field) => (field.id === fieldId ? updater(field) : field)),
            };
        });
    }
    function addCustomField() {
        if (!selectedForm)
            return;
        const nextField: CustomFormField = {
            id: `field-${crypto.randomUUID()}`,
            label: "N?ovo campo",
            type: 'text',
            placeholder: '',
            required: false,
        };
        setCustomFieldsByForm((current) => ({
            ...current,
            [selectedForm.id]: [...(current[selectedForm.id] ?? []), nextField],
        }));
    }
    function removeCustomField(fieldId: string) {
        if (!selectedForm)
            return;
        setCustomFieldsByForm((current) => ({
            ...current,
            [selectedForm.id]: (current[selectedForm.id] ?? []).filter((field) => field.id !== fieldId),
        }));
    }
    async function saveSelectedFormConfig() {
        if (!selectedForm)
            return;
        setIsSavingConfig(true);
        setConfigFeedback(null);
        try {
            await Promise.all(selectedForm.editableFields.map((field) => saveSiteContentEntry({
                pageKey: field.pageKey,
                entryKey: field.entryKey,
                entryType: 'text',
                value: fieldValues[field.key] ?? field.fallback,
                schema: {},
            })));
            await saveSiteContentEntry({
                pageKey: 'global',
                entryKey: `global.forms.${selectedForm.id}.customFields`,
                entryType: 'list',
                value: selectedCustomFields,
                schema: {
                    kind: 'form-custom-fields',
                    formId: selectedForm.id,
                },
            });
            setConfigFeedback("Configura??es do formulario salvas com sucesso.");
        }
        catch (error) {
            setConfigFeedback(error instanceof Error ? error.message : "N?o foi possvel salvar as configura??es do formulario.");
        }
        finally {
            setIsSavingConfig(false);
        }
    }
    function exportCsv() {
        const header = ['id', 'tipo', 'nome', 'email', 'areas_interesse', 'mensagem', 'origem', 'criado_em'];
        const rows = filteredItems.map((item) => [
            item.id,
            item.form_type,
            item.name ?? '',
            item.email ?? '',
            readInterestAreas(item).join(' | '),
            item.message ?? '',
            item.source_url ?? item.source_path ?? '',
            item.created_at,
        ]);
        const csv = [header, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `formularios_genflix_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }
    return (<div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[#D8E6EB] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#1398B7]">Admin / Formularios</p>
          <h1 className="mt-2 font-readex text-3xl font-semibold tracking-tight text-[#15323b]">Formularios pblicos</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#6d7f84]">Leads de contato, newsletter e outros formularios enviados pelas p?ginas publicas.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="inline-flex rounded-2xl border border-[#D8E6EB] bg-white p-1">
            <button type="button" onClick={() => setActiveTab('submissions')} className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.16em] ${activeTab === 'submissions' ? 'bg-[#0A3640] text-white' : 'text-[#5F7077]'}`}>
              Recebimentos
            </button>
            <button type="button" onClick={() => setActiveTab('forms')} className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.16em] ${activeTab === 'forms' ? 'bg-[#0A3640] text-white' : 'text-[#5F7077]'}`}>
              Configurar formularios
            </button>
          </div>

          <select value={formFilter} onChange={(event) => setFormFilter(event.target.value)} className="h-11 rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-black text-[#15323b] outline-none" disabled={activeTab !== 'submissions'}>
            <option value="all">Todos</option>
            <option value="contact">Contato</option>
            <option value="teach">Ensine na GenFlix</option>
            <option value="newsletter">Newsletter</option>
            <option value="lead">Lead</option>
            <option value="support">Suporte</option>
          </select>
          {formFilter === 'newsletter' ? (<select value={interestAreaFilter} onChange={(event) => setInterestAreaFilter(event.target.value)} className="h-11 rounded-2xl border border-[#D8E6EB] bg-white px-4 text-sm font-black text-[#15323b] outline-none" disabled={activeTab !== 'submissions'}>
              <option value="all">Todas as areas</option>
              {newsletterInterestAreas.map((area) => (<option key={area} value={area}>
                  {area}
                </option>))}
            </select>) : null}
          <Button type="button" variant="outline" onClick={() => void loadSubmissions()} className="rounded-2xl border-[#D8E6EB]">
            Atualizar
          </Button>
          <Button type="button" onClick={exportCsv} className="rounded-2xl bg-[#1398B7] hover:bg-[#0A3640]">
            Exportar CSV
          </Button>
        </div>
      </header>

      {errorMessage ? (<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {errorMessage}
        </div>) : null}

      {activeTab === 'submissions' ? (<section className="overflow-hidden rounded-[28px] border border-[#D8E6EB] bg-white">
          {isLoading ? (<p className="p-5 text-sm font-medium text-[#6d7f84]">Carregando formularios...</p>) : filteredItems.length === 0 ? (<p className="p-5 text-sm font-medium text-[#6d7f84]">Nenhum formulario encontrado.</p>) : (<div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#D8E6EB] text-left text-sm">
                <thead className="bg-[#F2F7F9] text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">
                  <tr>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3">Contato</th>
                    <th className="px-5 py-3">Mensagem</th>
                    <th className="px-5 py-3">Origem</th>
                    <th className="px-5 py-3">Recebido em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E6EB]">
                  {filteredItems.map((item) => (<tr key={item.id} className="align-top">
                      <td className="px-5 py-4 font-black uppercase text-[#15323b]">{item.form_type}</td>
                      <td className="px-5 py-4">
                        <p className="font-black text-[#15323b]">{item.name || 'Sem nome'}</p>
                        <p className="mt-1 text-xs font-semibold text-[#6d7f84]">{item.email || 'Sem e-mail'}</p>
                        {readInterestAreas(item).length > 0 ? (<p className="mt-2 inline-flex rounded-full border border-[#D8E6EB] bg-[#F2F7F9] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                            Areas: {readInterestAreas(item).join(', ')}
                          </p>) : null}
                      </td>
                      <td className="max-w-[360px] px-5 py-4 text-[#5f7077]">
                        {item.message || JSON.stringify(item.payload)}
                      </td>
                      <td className="px-5 py-4 text-xs font-semibold text-[#6d7f84]">
                        {item.source_url || item.source_path || '-'}
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#5f7077]">{formatDateTime(item.created_at)}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </section>) : (<section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-[24px] border border-[#D8E6EB] bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5F7077]">Formularios do site</p>
            <div className="mt-3 space-y-2">
              {formDefinitions.map((form) => (<button key={form.id} type="button" onClick={() => setSelectedFormId(form.id)} className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selectedForm?.id === form.id ? 'border-[#1398B7] bg-[#E8F6FA]' : 'border-[#D8E6EB] bg-white hover:border-[#BEE3EA]'}`}>
                  <p className="text-sm font-black text-[#15323b]">{form.label}</p>
                  <p className="mt-1 text-xs font-medium text-[#6d7f84]">{form.description}</p>
                </button>))}
            </div>
          </aside>

          <div className="rounded-[24px] border border-[#D8E6EB] bg-white p-5">
            {!selectedForm ? null : (<>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D8E6EB] pb-4">
                  <div>
                    <h2 className="text-xl font-black text-[#15323b]">{selectedForm.label}</h2>
                    <p className="mt-1 text-sm font-medium text-[#6d7f84]">{selectedForm.description}</p>
                  </div>
                  <Link to={selectedForm.route} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-xl border border-[#D8E6EB] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#15323b] hover:bg-[#F2F7F9]">
                    Editar no site
                  </Link>
                </div>

                <div className="mt-5 space-y-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5F7077]">Textos principais</p>
                  {isLoadingConfig ? (<p className="text-sm font-medium text-[#6d7f84]">Carregando configura??es...</p>) : (<div className="grid gap-4 md:grid-cols-2">
                      {selectedForm.editableFields.map((field) => (<label key={field.key} className="space-y-1">
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#5F7077]">{field.label}</span>
                          <input type="text" value={fieldValues[field.key] ?? ''} onChange={(event) => setFieldValues((current) => ({ ...current, [field.key]: event.target.value }))} className="h-11 w-full rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"/>
                        </label>))}
                    </div>)}
                </div>

                <div className="mt-6 border-t border-[#D8E6EB] pt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#5F7077]">Campos personalizados</p>
                    <Button type="button" variant="outline" onClick={addCustomField} className="rounded-xl border-[#D8E6EB]">
                      Inserir campo
                    </Button>
                  </div>
                  <p className="mt-2 text-xs font-medium text-[#6d7f84]">
                    Campos extras ficam salvos para integracoes e ajustes futuros deste formulario.
                  </p>
                  <div className="mt-3 space-y-3">
                    {selectedCustomFields.length === 0 ? (<p className="text-sm font-medium text-[#6d7f84]">Nenhum campo personalizado cadastrado.</p>) : selectedCustomFields.map((field) => (<div key={field.id} className="rounded-2xl border border-[#D8E6EB] bg-[#F8FBFC] p-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <input type="text" value={field.label} onChange={(event) => updateCustomField(field.id, (current) => ({ ...current, label: event.target.value }))} placeholder="N?ome do campo" className="h-10 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"/>
                          <select value={field.type} onChange={(event) => updateCustomField(field.id, (current) => ({ ...current, type: event.target.value as CustomFormField['type'] }))} className="h-10 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]">
                            <option value="text">Texto</option>
                            <option value="email">E-mail</option>
                            <option value="textarea">Texto longo</option>
                            <option value="select">Selecao</option>
                            <option value="checkbox">Checkbox</option>
                          </select>
                          <input type="text" value={field.placeholder ?? ''} onChange={(event) => updateCustomField(field.id, (current) => ({ ...current, placeholder: event.target.value }))} placeholder="Placeholder (opcional)" className="h-10 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7] md:col-span-2"/>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#5F7077]">
                            <input type="checkbox" checked={field.required === true} onChange={(event) => updateCustomField(field.id, (current) => ({ ...current, required: event.target.checked }))}/>Campo obrigatrio
                          </label>
                          <button type="button" onClick={() => removeCustomField(field.id)} className="text-xs font-black uppercase tracking-[0.14em] text-[#A53A3A]">
                            Remover
                          </button>
                        </div>
                      </div>))}
                  </div>
                </div>

                {configFeedback ? (<p className="mt-4 text-sm font-semibold text-[#5F7077]">{configFeedback}</p>) : null}

                <div className="mt-5 flex justify-end">
                  <Button type="button" onClick={() => void saveSelectedFormConfig()} disabled={isSavingConfig || isLoadingConfig} className="rounded-xl bg-[#1398B7] px-6 hover:bg-[#0A3640]">
                    {isSavingConfig ? 'Salvando...' : "Salvar configura??es"}
                  </Button>
                </div>
              </>)}
          </div>
        </section>)}
    </div>);
}
