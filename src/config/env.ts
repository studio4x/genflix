import { z } from 'zod';
const envSchema = z.object({
    VITE_APP_ENV: z.enum(['development', 'production']).default('development'),
    VITE_APP_TIMEZONE: z.string().default('America/Sao_Paulo'),
    VITE_APP_LOCALE: z.string().default('pt-BR'),
    VITE_SUPABASE_URL: z.string().url(),
    VITE_SUPABASE_ANON_KEY: z.string().min(1),
});
const parsedEnv = envSchema.safeParse(import.meta.env);
if (!parsedEnv.success) {
    const fields = parsedEnv.error.issues.map((issue) => issue.path.join('.'));
    throw new Error(`Invalid environment variables: ${fields.join(', ')}`);
}
export const env = parsedEnv.data;
