const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});
export function formatCurrencyFromCents(value: number | null | undefined, currency = 'BRL') {
    const safeValue = Number.isFinite(value ?? NaN) ? Math.max(0, Number(value)) : 0;
    if (currency !== 'BRL') {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency,
        }).format(safeValue / 100);
    }
    return BRL_FORMATTER.format(safeValue / 100);
}
export function formatCurrencyInputFromCents(value: number | null | undefined) {
    const safeValue = Number.isFinite(value ?? NaN) ? Math.max(0, Number(value)) : 0;
    return (safeValue / 100).toFixed(2).replace('.', ',');
}
export function parseCurrencyInputToCents(value: string) {
    const normalized = value.trim().replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    if (!normalized) {
        return 0;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
        return 0;
    }
    return Math.max(0, Math.round(parsed * 100));
}
