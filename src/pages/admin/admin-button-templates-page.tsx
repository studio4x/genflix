import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BUTTON_ICON_OPTIONS, BUTTON_THEME_OPTIONS, BUTTON_VARIANT_OPTIONS, getButtonThemeLabel, getButtonVariantLabel, getLessonFooterButtonClassName, getLessonFooterButtonStyle, renderButtonTemplateIcon, } from '@/features/admin/content/button-template-icons';
import { createButtonTemplate, deleteButtonTemplate, fetchButtonTemplates, toErrorMessage, updateButtonTemplate, } from '@/features/admin/content/api';
import { buttonTemplateFormSchema, type ButtonTemplateFormInput, } from '@/features/admin/content/schemas';
import type { ButtonTemplate } from '@/types/content';
import { GlobalButtonsTab } from '@/features/admin/content/global-buttons-tab';
import { fetchSiteIconLibrary } from '@/features/site-editor/api';
import { resolveSiteAssetLibraryLabel } from '@/features/site-assets/library-utils';
import type { SiteAsset } from '@/features/site-editor/types';

const INITIAL_FORM: ButtonTemplateFormInput = {
    name: '',
    default_label: '',
    variant: 'outline',
    theme: 'blue',
    custom_background_color: null,
    custom_text_color: null,
    icon: 'link',
    is_active: true,
};

export function AdminButtonTemplatesPage() {
    const [activeTab, setActiveTab] = useState<'templates' | 'globals'>('templates');
    const [templates, setTemplates] = useState<ButtonTemplate[]>([]);
    const [form, setForm] = useState<ButtonTemplateFormInput>(INITIAL_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [iconLibraryAssets, setIconLibraryAssets] = useState<SiteAsset[]>([]);
    const [iconSearchQuery, setIconSearchQuery] = useState('');
    const [isLoadingIconLibrary, setIsLoadingIconLibrary] = useState(true);

    const filteredIconLibraryAssets = useMemo(() => {
        const normalizedQuery = iconSearchQuery.trim().toLowerCase();
        return iconLibraryAssets.filter((asset) => {
            const label = resolveSiteAssetLibraryLabel(asset).toLowerCase();
            const originalName = typeof asset.metadata?.original_name === 'string'
                ? asset.metadata.original_name.toLowerCase()
                : '';
            return normalizedQuery === '' || label.includes(normalizedQuery) || originalName.includes(normalizedQuery);
        });
    }, [iconLibraryAssets, iconSearchQuery]);

    useEffect(() => {
        async function load() {
            setIsLoading(true);
            try {
                setTemplates(await fetchButtonTemplates());
            }
            catch (err) {
                setError(toErrorMessage(err));
            }
            finally {
                setIsLoading(false);
            }
        }
        void load();
    }, []);

    useEffect(() => {
        let isMounted = true;
        async function loadIconLibrary() {
            setIsLoadingIconLibrary(true);
            try {
                const assets = await fetchSiteIconLibrary();
                if (isMounted) {
                    setIconLibraryAssets(assets.filter((asset) => Boolean(asset.public_url)));
                }
            }
            catch {
                if (isMounted) {
                    setIconLibraryAssets([]);
                }
            }
            finally {
                if (isMounted) {
                    setIsLoadingIconLibrary(false);
                }
            }
        }
        void loadIconLibrary();
        return () => {
            isMounted = false;
        };
    }, []);

    function startEdit(template: ButtonTemplate) {
        setEditingId(template.id);
        setForm({
            name: template.name,
            default_label: template.default_label,
            variant: template.variant,
            theme: template.theme,
            custom_background_color: template.custom_background_color ?? null,
            custom_text_color: template.custom_text_color ?? null,
            icon: template.icon,
            is_active: template.is_active,
        });
    }

    function resetForm() {
        setEditingId(null);
        setForm(INITIAL_FORM);
    }

    async function handleSubmit() {
        setError(null);
        const parsed = buttonTemplateFormSchema.safeParse(form);
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
            return;
        }
        setIsSaving(true);
        try {
            const saved = editingId
                ? await updateButtonTemplate(editingId, parsed.data)
                : await createButtonTemplate(parsed.data);
            setTemplates((prev) => {
                if (editingId) {
                    return prev.map((template) => (template.id === editingId ? saved : template));
                }
                return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
            });
            resetForm();
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
        finally {
            setIsSaving(false);
        }
    }

    async function handleDelete(template: ButtonTemplate) {
        if (!window.confirm(`Excluir o padrão "${template.name}"`))
            return;
        try {
            await deleteButtonTemplate(template.id);
            setTemplates((prev) => prev.filter((item) => item.id !== template.id));
            if (editingId === template.id) {
                resetForm();
            }
        }
        catch (err) {
            setError(toErrorMessage(err));
        }
    }

    return (
        <div className="space-y-8">
            <div className="border-b border-slate-200 pb-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Gerenciador de Botões das Aulas</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Configure padrões visuais reutilizáveis ou gerencie a biblioteca de botões globais da plataforma.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 mt-6">
                    <button
                        type="button"
                        onClick={() => setActiveTab('templates')}
                        className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                            activeTab === 'templates'
                                ? 'bg-slate-900 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        🎨 Padrões Visuais (Templates)
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('globals')}
                        className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                            activeTab === 'globals'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        🌐 Biblioteca de Botões Globais
                    </button>
                </div>
            </div>

            {activeTab === 'globals' ? (
                <GlobalButtonsTab />
            ) : (

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-6">
          <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">
            {editingId ? 'Editar padrão' : 'Novo padrão'}
          </h3>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Nome interno</span>
              <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}/>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Rótulo padrão</span>
              <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={form.default_label} onChange={(event) => setForm((prev) => ({ ...prev, default_label: event.target.value }))}/>
            </label>

            <div className="space-y-3">
              <span className="text-sm font-bold text-slate-700">Biblioteca de icones</span>
              <div className="flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3">
                <Search className="h-4 w-4 shrink-0 text-slate-400"/>
                <input
                  value={iconSearchQuery}
                  onChange={(event) => setIconSearchQuery(event.target.value)}
                  placeholder="Buscar ícone..."
                  className="w-full border-0 bg-transparent text-xs font-semibold text-slate-700 outline-none"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ícones nativos</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BUTTON_ICON_OPTIONS.filter((iconOption) => {
                      const normalizedQuery = iconSearchQuery.trim().toLowerCase();
                      return normalizedQuery === '' || iconOption.label.toLowerCase().includes(normalizedQuery) || iconOption.value.includes(normalizedQuery);
                  }).map((iconOption) => {
                      const isSelected = form.icon === iconOption.value;
                      return (<button key={iconOption.value} type="button" title={iconOption.label} aria-label={iconOption.label} onClick={() => setForm((prev) => ({ ...prev, icon: iconOption.value }))} className={`flex h-10 w-full items-center justify-center rounded-2xl border p-0 text-xs font-bold transition-all ${isSelected
                          ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50'}`}>
                        {renderButtonTemplateIcon(iconOption.value)}
                      </button>);
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ícones da biblioteca existente</p>
                  {isLoadingIconLibrary ? <Loader2 className="h-4 w-4 animate-spin text-slate-400"/> : <span className="text-[10px] font-bold text-slate-400">{filteredIconLibraryAssets.length}</span>}
                </div>
                {isLoadingIconLibrary ? (
                  <p className="text-xs font-semibold text-slate-500">Carregando biblioteca...</p>
                ) : filteredIconLibraryAssets.length === 0 ? (
                  <p className="text-xs font-semibold text-slate-500">Nenhum SVG encontrado.</p>
                ) : (
                  <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                    {filteredIconLibraryAssets.map((asset) => {
                        const iconValue = asset.public_url ?? '';
                        const isSelected = form.icon === iconValue;
                        const iconLabel = resolveSiteAssetLibraryLabel(asset);
                        return (<button key={asset.id} type="button" title={iconLabel} aria-label={iconLabel} onClick={() => setForm((prev) => ({ ...prev, icon: iconValue }))} className={`flex h-10 w-full min-w-0 items-center justify-center rounded-2xl border p-0 text-xs font-bold transition-all ${isSelected
                            ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50'}`}>
                          {renderButtonTemplateIcon(iconValue, 'h-5 w-5 shrink-0')}
                        </button>);
                    })}
                  </div>
                )}
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Variante</span>
              <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={form.variant} onChange={(event) => setForm((prev) => ({ ...prev, variant: event.target.value as ButtonTemplateFormInput['variant'] }))}>
                {BUTTON_VARIANT_OPTIONS.map((variant) => (<option key={variant.value} value={variant.value}>{variant.label}</option>))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-slate-700">Tema</span>
              <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm" value={form.theme} onChange={(event) => setForm((prev) => {
                  const theme = event.target.value as ButtonTemplateFormInput['theme'];
                  return theme === 'custom'
                      ? { ...prev, theme, custom_background_color: prev.custom_background_color ?? '#0A3640', custom_text_color: prev.custom_text_color ?? '#FFFFFF' }
                      : { ...prev, theme };
              })}>
                {BUTTON_THEME_OPTIONS.map((theme) => (<option key={theme.value} value={theme.value}>{theme.label}</option>))}
              </select>
            </label>

            {form.theme === 'custom' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-bold text-slate-700">Cor do fundo</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.custom_background_color ?? '#0A3640'} onChange={(event) => setForm((prev) => ({ ...prev, custom_background_color: event.target.value.toUpperCase() }))} className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1" aria-label="Selecionar cor do fundo"/>
                    <input value={form.custom_background_color ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, custom_background_color: event.target.value.toUpperCase() }))} placeholder="#0A3640" maxLength={7} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm uppercase"/>
                  </div>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-bold text-slate-700">Cor do texto</span>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.custom_text_color ?? '#FFFFFF'} onChange={(event) => setForm((prev) => ({ ...prev, custom_text_color: event.target.value.toUpperCase() }))} className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1" aria-label="Selecionar cor do texto"/>
                    <input value={form.custom_text_color ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, custom_text_color: event.target.value.toUpperCase() }))} placeholder="#FFFFFF" maxLength={7} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm uppercase"/>
                  </div>
                </label>
              </div>
            ) : null}

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}/>
              <span className="text-sm font-bold text-slate-700">Padrão ativo</span>
            </label>
          </div>

          {error ? (<div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>) : null}

          <div className="mt-6 flex gap-3">
            <Button className="flex-1 rounded-2xl bg-blue-600 hover:bg-blue-700" disabled={isSaving} onClick={() => void handleSubmit()}>
              {isSaving ? 'Salvando...' : editingId ? 'Salvar Padrão' : 'Criar Padrão'}
            </Button>
            {editingId ? (<Button variant="outline" className="rounded-2xl" onClick={resetForm}>
                Cancelar
              </Button>) : null}
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Preview do botão</p>
            <div className="mt-4">
              <Button type="button" variant="outline" style={getLessonFooterButtonStyle({
            variant: form.variant,
            theme: form.theme,
            custom_background_color: form.custom_background_color,
            custom_text_color: form.custom_text_color,
        })} className={getLessonFooterButtonClassName({
            variant: form.variant,
            theme: form.theme,
            custom_background_color: form.custom_background_color,
            custom_text_color: form.custom_text_color,
        })}>
                {renderButtonTemplateIcon(form.icon)}
                {form.default_label || 'Nome do Botão'}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-400">Catalogo</h3>

          {isLoading ? (<p className="mt-5 text-sm text-slate-500">Carregando padrões...</p>) : templates.length === 0 ? (<div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              Nenhum padrão encontrado.
            </div>) : (<div className="mt-5 grid gap-4">
              {templates.map((template) => (<article key={template.id} className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-black text-slate-900">{template.name}</h4>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${template.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {template.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="mt-3">
                        <Button type="button" variant="outline" style={getLessonFooterButtonStyle(template)} className={getLessonFooterButtonClassName(template)}>
                          {renderButtonTemplateIcon(template.icon)}
                          {template.default_label}
                        </Button>
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-wider text-slate-400">
                        {getButtonVariantLabel(template.variant)} • {getButtonThemeLabel(template.theme)} • {template.icon}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => startEdit(template)}>
                        Editar
                      </Button>
                      <Button variant="outline" className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => void handleDelete(template)}>
                        Excluir
                      </Button>
                    </div>
                  </div>
                </article>))}
            </div>)}
        </section>
      </div>
      )}
    </div>
  );
}
