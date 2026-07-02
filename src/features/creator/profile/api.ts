import { supabase } from '@/services/supabase/client';

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export interface CreatorPayoutProfile {
    user_id: string;
    payout_name: string | null;
    document: string | null;
    pix_key_type: PixKeyType | null;
    pix_key: string | null;
    default_commission_percent: number;
    payout_hold_days: number;
    is_payout_enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreatorPublicProfile {
    user_id: string;
    public_slug: string | null;
    public_title: string | null;
    public_short_bio: string | null;
    public_long_bio: string | null;
    public_areas: string[];
    public_education: string | null;
    public_experience: string | null;
    public_photo_url: string | null;
    public_website_url: string | null;
    public_instagram_url: string | null;
    public_linkedin_url: string | null;
    public_youtube_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreatorPayoutProfileInput {
    userId: string;
    payoutName: string;
    document: string;
    pixKeyType: PixKeyType | '';
    pixKey: string;
    defaultCommissionPercent?: number;
}

export interface CreatorPublicProfileInput {
    userId: string;
    publicSlug: string;
    publicTitle: string;
    publicShortBio: string;
    publicLongBio: string;
    publicAreas: string[];
    publicEducation: string;
    publicExperience: string;
    publicPhotoUrl: string;
    publicWebsiteUrl: string;
    publicInstagramUrl: string;
    publicLinkedinUrl: string;
    publicYoutubeUrl: string;
}

export async function fetchCreatorPayoutProfile(userId: string) {
    const { data, error } = await supabase
        .from('creator_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        throw error;
    }
    return (data as CreatorPayoutProfile | null) ?? null;
}

export async function fetchCreatorPublicProfile(userId: string) {
    const { data, error } = await supabase
        .from('creator_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        throw error;
    }
    return (data as CreatorPublicProfile | null) ?? null;
}

export async function upsertCreatorPayoutProfile(input: CreatorPayoutProfileInput) {
    const isPayoutEnabled = Boolean(input.payoutName.trim() &&
        input.document.trim() &&
        input.pixKeyType &&
        input.pixKey.trim());
    const { data, error } = await supabase
        .from('creator_profiles')
        .upsert({
        user_id: input.userId,
        payout_name: input.payoutName.trim() || null,
        document: input.document.trim() || null,
        pix_key_type: input.pixKeyType || null,
        pix_key: input.pixKey.trim() || null,
        ...(typeof input.defaultCommissionPercent === 'number'
            ? { default_commission_percent: input.defaultCommissionPercent }
            : {}),
        payout_hold_days: 30,
        is_payout_enabled: isPayoutEnabled,
    }, { onConflict: 'user_id' })
        .select('*')
        .single();
    if (error) {
        throw error;
    }
    return data as CreatorPayoutProfile;
}

export async function upsertCreatorPublicProfile(input: CreatorPublicProfileInput) {
    const { data, error } = await supabase
        .from('creator_profiles')
        .upsert({
        user_id: input.userId,
        public_slug: input.publicSlug.trim() || null,
        public_title: input.publicTitle.trim() || null,
        public_short_bio: input.publicShortBio.trim() || null,
        public_long_bio: input.publicLongBio.trim() || null,
        public_areas: input.publicAreas.map((area) => area.trim()).filter(Boolean),
        public_education: input.publicEducation.trim() || null,
        public_experience: input.publicExperience.trim() || null,
        public_photo_url: input.publicPhotoUrl.trim() || null,
        public_website_url: input.publicWebsiteUrl.trim() || null,
        public_instagram_url: input.publicInstagramUrl.trim() || null,
        public_linkedin_url: input.publicLinkedinUrl.trim() || null,
        public_youtube_url: input.publicYoutubeUrl.trim() || null,
    }, { onConflict: 'user_id' })
        .select('*')
        .single();
    if (error) {
        throw error;
    }
    return data as CreatorPublicProfile;
}
