import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteR2Object, fetchR2Objects, fetchR2UsageOverview, type R2ObjectRow, type R2UsageOverview, } from '@/features/admin/storage-r2/api';
function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** power);
    return `${value.toFixed(value >= 100 || power === 0 ? 0 : 2)} ${units[power]}`;
}
function formatNumber(value: number) {
    return new Intl.NumberFormat('pt-BR').format(value);
}
function formatDate(value: string) {
    if (!value) {
        return 'â€”';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'â€”';
    }
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date);
}
type ActiveTab = 'overview' | 'files';
const CLOUDFLARE_R2_PRICING = {
    freeTier: {
        storageGbMonth: 10,
        classARequests: 1000000,
        classBRequests: 10000000,
    },
    standard: {
        storageUsdPerGbMonth: 0.015,
        classAUsdPerMillion: 4.5,
        classBUsdPerMillion: 0.36,
    },
    infrequentAccess: {
        storageUsdPerGbMonth: 0.01,
        classAUsdPerMillion: 9,
        classBUsdPerMillion: 0.9,
        retrievalUsdPerGb: 0.01,
    },
} as const;
function bytesToDecimalGb(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return 0;
    }
    return bytes / 1000000000;
}
function roundUpBillingUnit(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
        return 0;
    }
    return Math.ceil(value);
}
function formatUsd(value: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}
function resolveFileExtension(key: string) {
    const normalizedKey = key.toLowerCase().split('?')[0] ?? '';
    const fileName = normalizedKey.split('/').pop() ?? normalizedKey;
    const extension = fileName.includes('.') ? fileName.split('.').pop() ?? '' : '';
    return extension.trim();
}
function isImageObjectKey(key: string) {
    return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(key);
}
type FileTypeFilter = 'all' | 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
const FILE_TYPE_FILTERS: Array<{
    value: FileTypeFilter;
    label: string;
}> = [
    { value: 'all', label: 'Todos' },
    { value: 'image', label: 'Imagens' },
    { value: 'video', label: 'Videos' },
    { value: 'audio', label: 'Audios' },
    { value: 'document', label: 'Documentos' },
    { value: 'archive', label: 'Compactados' },
    { value: 'other', label: 'Outros' },
];
const FILES_PER_PAGE_OPTIONS = [12, 24, 50, 100] as const;
function resolveFileType(key: string): Exclude<FileTypeFilter, 'all'> {
    const extension = resolveFileExtension(key);
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg'].includes(extension)) {
        return 'image';
    }
    if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'].includes(extension)) {
        return 'video';
    }
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(extension)) {
        return 'audio';
    }
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'json', 'xml', 'md'].includes(extension)) {
        return 'document';
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
        return 'archive';
    }
    return 'other';
}
export function AdminR2StoragePage() {
    const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
    const [overview, setOverview] = useState<R2UsageOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedBucket, setSelectedBucket] = useState('');
    const [prefixInput, setPrefixInput] = useState('');
    const [appliedPrefix, setAppliedPrefix] = useState('');
    const [objects, setObjects] = useState<R2ObjectRow[]>([]);
    const [objectsLoading, setObjectsLoading] = useState(false);
    const [objectsLoadingMore, setObjectsLoadingMore] = useState(false);
    const [objectsError, setObjectsError] = useState<string | null>(null);
    const [nextToken, setNextToken] = useState<string | null>(null);
    const [deletingKey, setDeletingKey] = useState<string | null>(null);
    const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
    const [currentFilesPage, setCurrentFilesPage] = useState(1);
    const [filesPerPage, setFilesPerPage] = useState<number>(24);
    async function loadData(mode: 'initial' | 'refresh' = 'initial') {
        if (mode === 'initial') {
            setLoading(true);
        }
        else {
            setRefreshing(true);
        }
        setError(null);
        try {
            const payload = await fetchR2UsageOverview();
            setOverview(payload);
        }
        catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar dados do R2.');
        }
        finally {
            if (mode === 'initial') {
                setLoading(false);
            }
            else {
                setRefreshing(false);
            }
        }
    }
    useEffect(() => {
        void loadData('initial');
    }, []);
    useEffect(() => {
        if (!overview?.buckets?.length) {
            setSelectedBucket('');
            return;
        }
        if (selectedBucket && overview.buckets.some((bucket) => bucket.name === selectedBucket)) {
            return;
        }
        setSelectedBucket(overview.buckets[0]?.name ?? '');
    }, [overview, selectedBucket]);
    const topBucket = useMemo(() => {
        if (!overview?.buckets?.length) {
            return null;
        }
        return [...overview.buckets].sort((a, b) => b.total_size_bytes - a.total_size_bytes)[0] ?? null;
    }, [overview]);
    const costEstimate = useMemo(() => {
        const buckets = overview?.buckets ?? [];
        const totals = overview?.totals;
        const totalStorageGb = bytesToDecimalGb(totals?.total_size_bytes ?? 0);
        const infrequentStorageGb = bytesToDecimalGb(totals?.infrequent_access_total_size_bytes ?? 0);
        const standardStorageGb = Math.max(0, totalStorageGb - infrequentStorageGb);
        const standardStorageBillableGb = Math.max(0, roundUpBillingUnit(standardStorageGb) - CLOUDFLARE_R2_PRICING.freeTier.storageGbMonth);
        const infrequentStorageBillableGb = roundUpBillingUnit(infrequentStorageGb);
        const standardStorageCost = standardStorageBillableGb * CLOUDFLARE_R2_PRICING.standard.storageUsdPerGbMonth;
        const infrequentStorageCost = infrequentStorageBillableGb * CLOUDFLARE_R2_PRICING.infrequentAccess.storageUsdPerGbMonth;
        const standardClassARequests = buckets.reduce((acc, bucket) => acc + bucket.upload_count, 0);
        const infrequentClassARequests = buckets.reduce((acc, bucket) => acc + bucket.infrequent_access_upload_count, 0);
        const standardClassABillableMillions = Math.max(0, roundUpBillingUnit(standardClassARequests / 1000000) - 1);
        const infrequentClassABillableMillions = roundUpBillingUnit(infrequentClassARequests / 1000000);
        const standardClassACost = standardClassABillableMillions * CLOUDFLARE_R2_PRICING.standard.classAUsdPerMillion;
        const infrequentClassACost = infrequentClassABillableMillions * CLOUDFLARE_R2_PRICING.infrequentAccess.classAUsdPerMillion;
        const subtotalKnown = standardStorageCost + infrequentStorageCost + standardClassACost + infrequentClassACost;
        return {
            totalStorageGb,
            standardStorageGb,
            infrequentStorageGb,
            standardStorageBillableGb,
            infrequentStorageBillableGb,
            standardClassARequests,
            infrequentClassARequests,
            standardClassABillableMillions,
            infrequentClassABillableMillions,
            standardStorageCost,
            infrequentStorageCost,
            standardClassACost,
            infrequentClassACost,
            subtotalKnown,
        };
    }, [overview]);
    const fileTypeCounts = useMemo(() => {
        const counts: Record<FileTypeFilter, number> = {
            all: objects.length,
            image: 0,
            video: 0,
            audio: 0,
            document: 0,
            archive: 0,
            other: 0,
        };
        for (const objectRow of objects) {
            counts[resolveFileType(objectRow.key)] += 1;
        }
        return counts;
    }, [objects]);
    const filteredObjects = useMemo(() => {
        if (fileTypeFilter === 'all') {
            return objects;
        }
        return objects.filter((objectRow) => resolveFileType(objectRow.key) === fileTypeFilter);
    }, [fileTypeFilter, objects]);
    const totalFilesPages = Math.max(1, Math.ceil(filteredObjects.length / filesPerPage));
    const paginatedObjects = useMemo(() => {
        const startIndex = (currentFilesPage - 1) * filesPerPage;
        return filteredObjects.slice(startIndex, startIndex + filesPerPage);
    }, [currentFilesPage, filesPerPage, filteredObjects]);
    async function loadObjects(options?: {
        append?: boolean;
        continuationToken?: string | null;
    }) {
        if (!selectedBucket) {
            return;
        }
        const append = Boolean(options?.append);
        if (append) {
            setObjectsLoadingMore(true);
        }
        else {
            setObjectsLoading(true);
            setObjects([]);
            setNextToken(null);
        }
        setObjectsError(null);
        try {
            const payload = await fetchR2Objects({
                bucket: selectedBucket,
                prefix: appliedPrefix,
                continuationToken: options?.continuationToken ?? null,
            });
            setObjects((previous) => (append ? [...previous, ...payload.objects] : payload.objects));
            setNextToken(payload.continuation_token);
        }
        catch (requestError) {
            setObjectsError(requestError instanceof Error ? requestError.message : 'Falha ao listar objetos do bucket.');
        }
        finally {
            if (append) {
                setObjectsLoadingMore(false);
            }
            else {
                setObjectsLoading(false);
            }
        }
    }
    useEffect(() => {
        setCurrentFilesPage(1);
    }, [selectedBucket, appliedPrefix, fileTypeFilter, filesPerPage]);
    useEffect(() => {
        if (currentFilesPage <= totalFilesPages) {
            return;
        }
        setCurrentFilesPage(totalFilesPages);
    }, [currentFilesPage, totalFilesPages]);
    useEffect(() => {
        if (activeTab !== 'files' || !selectedBucket) {
            return;
        }
        void loadObjects();
    }, [activeTab, selectedBucket, appliedPrefix]);
    async function handleDeleteObject(objectKey: string) {
        if (!selectedBucket) {
            return;
        }
        const confirmed = window.confirm(`Deseja excluir o arquivo

${objectKey}`);
        if (!confirmed) {
            return;
        }
        setDeletingKey(objectKey);
        try {
            await deleteR2Object({ bucket: selectedBucket, key: objectKey });
            setObjects((previous) => previous.filter((entry) => entry.key !== objectKey));
        }
        catch (requestError) {
            setObjectsError(requestError instanceof Error ? requestError.message : 'Falha ao excluir arquivo.');
        }
        finally {
            setDeletingKey(null);
        }
    }
    return (<div className="space-y-6 text-[#163138]">
      <header className="flex flex-col gap-4 rounded-[24px] border border-[#D8E6EB] bg-[#F8FBFC] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#1398B7]">Cloudflare R2</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#15323B]">Storage R2</h1>
          <p className="mt-2 text-sm text-[#5F7077]">
            Acompanhe consumo, navegue entre arquivos e remova objetos do storage.
          </p>
        </div>

        <Button type="button" variant="outline" onClick={() => {
            if (activeTab === 'overview') {
                void loadData('refresh');
            }
            else {
                void loadObjects();
            }
        }} disabled={loading || refreshing || objectsLoading || objectsLoadingMore} className="h-11 rounded-2xl border-[#BEE3EA] bg-white px-4 font-black text-[#15323B] hover:bg-[#F2F7F9]">
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing || objectsLoading ? 'animate-spin' : ''}`}/>
          Atualizar
        </Button>
      </header>

      <section className="rounded-[20px] border border-[#D8E6EB] bg-white p-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveTab('overview')} className={`rounded-xl px-4 py-2 text-sm font-black transition ${activeTab === 'overview' ? 'bg-[#15323B] text-white' : 'text-[#15323B] hover:bg-[#F2F7F9]'}`}>
            Visao geral
          </button>
          <button type="button" onClick={() => setActiveTab('files')} className={`rounded-xl px-4 py-2 text-sm font-black transition ${activeTab === 'files' ? 'bg-[#15323B] text-white' : 'text-[#15323B] hover:bg-[#F2F7F9]'}`}>
            Arquivos
          </button>
        </div>
      </section>

      {activeTab === 'overview' ? (<>
          {error ? (<section className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
              {error}
            </section>) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Buckets</p>
              <p className="mt-2 text-3xl font-black text-[#15323B]">
                {loading ? 'â€”' : formatNumber(overview?.bucket_count ?? 0)}
              </p>
            </article>
            <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Armazenamento total</p>
              <p className="mt-2 text-3xl font-black text-[#15323B]">
                {loading ? 'â€”' : formatBytes(overview?.totals.total_size_bytes ?? 0)}
              </p>
            </article>
            <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Objetos</p>
              <p className="mt-2 text-3xl font-black text-[#15323B]">
                {loading ? 'â€”' : formatNumber(overview?.totals.object_count ?? 0)}
              </p>
            </article>
            <article className="rounded-[20px] border border-[#D8E6EB] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Uploads acumulados</p>
              <p className="mt-2 text-3xl font-black text-[#15323B]">
                {loading ? 'â€”' : formatNumber(overview?.totals.upload_count ?? 0)}
              </p>
            </article>
          </section>

          <section className="rounded-[24px] border border-[#D8E6EB] bg-white p-5">
            <div className="mb-4 flex flex-col gap-1">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                Estimativa de custo mensal (Cloudflare R2)
              </p>
              <p className="text-sm text-[#5F7077]">Precos em USD baseados no uso atual com franquia gratuita mensal aplicada quando disponvel.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <article className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                  Subtotal estimado
                </p>
                <p className="mt-2 text-2xl font-black text-[#15323B]">
                  {loading ? '--' : formatUsd(costEstimate.subtotalKnown)}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#5F7077]">
                  Inclui Storage e Class A (Standard e IA).
                </p>
              </article>
              <article className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                  Storage Standard faturavel
                </p>
                <p className="mt-2 text-2xl font-black text-[#15323B]">
                  {loading ? '--' : `${costEstimate.standardStorageBillableGb} GB-mes`}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#5F7077]">
                  Uso atual: {loading ? '--' : `${costEstimate.standardStorageGb.toFixed(2)} GB`}
                </p>
              </article>
              <article className="rounded-[16px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">
                  Class A Standard faturavel
                </p>
                <p className="mt-2 text-2xl font-black text-[#15323B]">
                  {loading ? '--' : `${costEstimate.standardClassABillableMillions} mi`}
                </p>
                <p className="mt-1 text-xs font-semibold text-[#5F7077]">
                  Requisicoes atuais: {loading ? '--' : formatNumber(costEstimate.standardClassARequests)}
                </p>
              </article>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-[11px] font-black uppercase tracking-[0.14em] text-[#5F7077]">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Preco</th>
                    <th className="px-3 py-2">Franquia gratis</th>
                    <th className="px-3 py-2">Uso atual</th>
                    <th className="px-3 py-2">Estimativa</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="rounded-2xl bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                    <td className="rounded-l-2xl px-3 py-3">Storage Standard</td>
                    <td className="px-3 py-3">$0.015 / GB-mes</td>
                    <td className="px-3 py-3">10 GB-mes</td>
                    <td className="px-3 py-3">{loading ? '--' : `${costEstimate.standardStorageGb.toFixed(2)} GB`}</td>
                    <td className="rounded-r-2xl px-3 py-3">{loading ? '--' : formatUsd(costEstimate.standardStorageCost)}</td>
                  </tr>
                  <tr className="rounded-2xl bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                    <td className="rounded-l-2xl px-3 py-3">Class A Standard</td>
                    <td className="px-3 py-3">$4.50 / milhao</td>
                    <td className="px-3 py-3">1 milhao</td>
                    <td className="px-3 py-3">{loading ? '--' : formatNumber(costEstimate.standardClassARequests)}</td>
                    <td className="rounded-r-2xl px-3 py-3">{loading ? '--' : formatUsd(costEstimate.standardClassACost)}</td>
                  </tr>
                  <tr className="rounded-2xl bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                    <td className="rounded-l-2xl px-3 py-3">Class B Standard</td>
                    <td className="px-3 py-3">$0.36 / milhao</td>
                    <td className="px-3 py-3">10 milhoes</td>
                    <td className="px-3 py-3">N?o disponvel no endpoint</td>
                    <td className="rounded-r-2xl px-3 py-3">N?o calculado</td>
                  </tr>
                  <tr className="rounded-2xl bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                    <td className="rounded-l-2xl px-3 py-3">Storage IA</td>
                    <td className="px-3 py-3">$0.01 / GB-mes</td>
                    <td className="px-3 py-3">Sem franquia</td>
                    <td className="px-3 py-3">{loading ? '--' : `${costEstimate.infrequentStorageGb.toFixed(2)} GB`}</td>
                    <td className="rounded-r-2xl px-3 py-3">{loading ? '--' : formatUsd(costEstimate.infrequentStorageCost)}</td>
                  </tr>
                  <tr className="rounded-2xl bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                    <td className="rounded-l-2xl px-3 py-3">Class A IA</td>
                    <td className="px-3 py-3">$9.00 / milhao</td>
                    <td className="px-3 py-3">Sem franquia</td>
                    <td className="px-3 py-3">{loading ? '--' : formatNumber(costEstimate.infrequentClassARequests)}</td>
                    <td className="rounded-r-2xl px-3 py-3">{loading ? '--' : formatUsd(costEstimate.infrequentClassACost)}</td>
                  </tr>
                  <tr className="rounded-2xl bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                    <td className="rounded-l-2xl px-3 py-3">Class B IA / Retrieval IA</td>
                    <td className="px-3 py-3">$0.90 / milhao + $0.01 / GB</td>
                    <td className="px-3 py-3">Sem franquia</td>
                    <td className="px-3 py-3">N?o disponvel no endpoint</td>
                    <td className="rounded-r-2xl px-3 py-3">N?o calculado</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs font-semibold text-[#5F7077]">A Cloudflare arredonda para cima por unidade de cobranca (GB-mes, milhao de operacoes e GB de
              retrieval). Este painel e uma estimativa de acompanhamento e n?o substitui a fatura oficial.
            </p>
          </section>

          <section className="rounded-[24px] border border-[#D8E6EB] bg-white p-5">
            <div className="mb-4 flex flex-col gap-1">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Detalhamento por bucket</p>
              <p className="text-sm text-[#5F7077]">
                Ultima atualizacao: {loading ? 'â€”' : formatDate(overview?.checked_at ?? '')}
              </p>
            </div>

            {loading ? (<p className="text-sm font-semibold text-[#5F7077]">Carregando metricas...</p>) : (overview?.buckets?.length ?? 0) === 0 ? (<p className="text-sm font-semibold text-[#5F7077]">Nenhum bucket R2 encontrado.</p>) : (<div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-[11px] font-black uppercase tracking-[0.14em] text-[#5F7077]">
                      <th className="px-3 py-2">Bucket</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Objetos</th>
                      <th className="px-3 py-2">Uploads</th>
                      <th className="px-3 py-2">Regiao</th>
                      <th className="px-3 py-2">Atualizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview?.buckets.map((bucket) => (<tr key={bucket.name} className="rounded-2xl bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                        <td className="rounded-l-2xl px-3 py-3">
                          <div>
                            <p className="font-black text-[#15323B]">{bucket.name}</p>
                            <p className="text-xs font-semibold text-[#5F7077]">{bucket.storage_class}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3">{formatBytes(bucket.total_size_bytes)}</td>
                        <td className="px-3 py-3">{formatNumber(bucket.object_count)}</td>
                        <td className="px-3 py-3">{formatNumber(bucket.upload_count)}</td>
                        <td className="px-3 py-3">{bucket.location}</td>
                        <td className="rounded-r-2xl px-3 py-3">{formatDate(bucket.usage_end)}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>)}
          </section>

          {topBucket ? (<section className="rounded-[24px] border border-[#D8E6EB] bg-white p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Bucket com maior consumo</p>
              <p className="mt-2 text-xl font-black text-[#15323B]">{topBucket.name}</p>
              <p className="mt-1 text-sm text-[#5F7077]">
                {formatBytes(topBucket.total_size_bytes)} em {formatNumber(topBucket.object_count)} objetos.
              </p>
            </section>) : null}
        </>) : (<section className="space-y-4 rounded-[24px] border border-[#D8E6EB] bg-white p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)_auto] md:items-end">
            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Bucket</span>
              <select value={selectedBucket} onChange={(event) => setSelectedBucket(event.target.value)} className="h-11 w-full rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323B]">
                {(overview?.buckets ?? []).map((bucket) => (<option key={bucket.name} value={bucket.name}>
                    {bucket.name}
                  </option>))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5F7077]">Prefixo (pasta)</span>
              <input value={prefixInput} onChange={(event) => setPrefixInput(event.target.value)} placeholder="Ex.: a37fdd1a-d961-46a1-94e4-7389231ac938/" className="h-11 w-full rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323B] placeholder:text-[#95A7AE]"/>
            </label>

            <Button type="button" disabled={!selectedBucket || objectsLoading || objectsLoadingMore} onClick={() => setAppliedPrefix(prefixInput.trim())} className="h-11 rounded-xl bg-[#15323B] px-4 font-black text-white hover:bg-[#10252C]">
              <Search className="mr-2 h-4 w-4"/>
              Buscar
            </Button>
          </div>

          <div className="flex flex-col gap-3 rounded-[20px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
            <div className="flex flex-wrap gap-2">
              {FILE_TYPE_FILTERS.map((filterOption) => (<button key={filterOption.value} type="button" onClick={() => setFileTypeFilter(filterOption.value)} className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${fileTypeFilter === filterOption.value
                        ? 'bg-[#15323B] text-white'
                        : 'bg-white text-[#15323B] hover:bg-[#EDF5F7]'}`}>
                  {filterOption.label} ({formatNumber(fileTypeCounts[filterOption.value])})
                </button>))}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm font-semibold text-[#5F7077]">
                {filteredObjects.length === 0 ? 'Nenhum arquivo carregado para este tipo.' : `Exibindo ${formatNumber(paginatedObjects.length)} de ${formatNumber(filteredObjects.length)} arquivos carregados.`}
                {nextToken ? ' Ainda existem mais arquivos no bucket para carregar.' : ''}
              </div>

              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#5F7077]">
                <span>Itens por pagina</span>
                <select value={String(filesPerPage)} onChange={(event) => setFilesPerPage(Number(event.target.value))} className="h-10 rounded-xl border border-[#D8E6EB] bg-white px-3 text-sm font-semibold text-[#15323B]">
                  {FILES_PER_PAGE_OPTIONS.map((option) => (<option key={option} value={option}>
                      {option}
                    </option>))}
                </select>
              </label>
            </div>
          </div>

          {objectsError ? (<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {objectsError}
            </div>) : null}

          {objectsLoading ? (<p className="text-sm font-semibold text-[#5F7077]">Carregando arquivos...</p>) : filteredObjects.length === 0 ? (<p className="text-sm font-semibold text-[#5F7077]">Nenhum arquivo encontrado para este filtro.</p>) : (<div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-[11px] font-black uppercase tracking-[0.14em] text-[#5F7077]">
                    <th className="px-3 py-2">Prévia</th>
                    <th className="px-3 py-2">Arquivo</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Tamanho</th>
                    <th className="px-3 py-2">Ultima alteracao</th>
                    <th className="px-3 py-2 text-right">Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedObjects.map((objectRow) => (<tr key={objectRow.key} className="rounded-2xl bg-[#F8FBFC] text-sm font-semibold text-[#163138]">
                      <td className="rounded-l-2xl px-3 py-3">
                        {isImageObjectKey(objectRow.key) && objectRow.preview_url ? (<a href={objectRow.preview_url} target="_blank" rel="noreferrer" className="block">
                            <img src={objectRow.preview_url} alt={objectRow.key} className="h-14 w-14 rounded-xl border border-[#D8E6EB] object-cover"/>
                          </a>) : (<div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-[#D8E6EB] bg-white text-[10px] font-black uppercase tracking-[0.12em] text-[#95A7AE]">
                            Sem imagem
                          </div>)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-black text-[#15323B] break-all">{objectRow.key}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#15323B]">
                          {FILE_TYPE_FILTERS.find((filterOption) => filterOption.value === resolveFileType(objectRow.key))?.label ?? 'Outros'}
                        </span>
                      </td>
                      <td className="px-3 py-3">{formatBytes(objectRow.size_bytes)}</td>
                      <td className="px-3 py-3">{formatDate(objectRow.last_modified ?? '')}</td>
                      <td className="rounded-r-2xl px-3 py-3 text-right">
                        <Button type="button" variant="outline" className="h-9 rounded-lg border-rose-200 bg-white px-3 font-black text-rose-700 hover:bg-rose-50" disabled={deletingKey === objectRow.key} onClick={() => void handleDeleteObject(objectRow.key)}>
                          <Trash2 className="mr-2 h-4 w-4"/>
                          {deletingKey === objectRow.key ? 'Excluindo...' : 'Excluir'}
                        </Button>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}

          {(filteredObjects.length > 0 || nextToken) ? (<div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="h-10 rounded-xl border-[#BEE3EA] bg-white px-4 font-black text-[#15323B] hover:bg-[#F2F7F9]" disabled={currentFilesPage <= 1} onClick={() => setCurrentFilesPage((previous) => Math.max(1, previous - 1))}>
                  Anterior
                </Button>
                <div className="rounded-xl border border-[#D8E6EB] bg-[#F8FBFC] px-4 py-2 text-sm font-black text-[#15323B]">
                  Pagina {formatNumber(currentFilesPage)} de {formatNumber(totalFilesPages)}
                </div>
                <Button type="button" variant="outline" className="h-10 rounded-xl border-[#BEE3EA] bg-white px-4 font-black text-[#15323B] hover:bg-[#F2F7F9]" disabled={currentFilesPage >= totalFilesPages} onClick={() => setCurrentFilesPage((previous) => Math.min(totalFilesPages, previous + 1))}>
                  Proxima
                </Button>
              </div>

              <Button type="button" variant="outline" className="h-10 rounded-xl border-[#BEE3EA] bg-white px-4 font-black text-[#15323B] hover:bg-[#F2F7F9]" disabled={!nextToken || objectsLoadingMore} onClick={() => void loadObjects({ append: true, continuationToken: nextToken })}>
                {objectsLoadingMore ? 'Carregando...' : nextToken ? 'Carregar mais do bucket' : 'Todos os arquivos carregados'}
              </Button>
            </div>) : null}
        </section>)}
    </div>);
}
