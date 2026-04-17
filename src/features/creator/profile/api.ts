import { supabase } from '@/services/supabase/client'

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'

export interface CreatorPayoutProfile {
  user_id: string
  payout_name: string | null
  document: string | null
  pix_key_type: PixKeyType | null
  pix_key: string | null
  default_commission_percent: number
  payout_hold_days: number
  is_payout_enabled: boolean
  created_at: string
  updated_at: string
}

export interface CreatorPayoutProfileInput {
  userId: string
  payoutName: string
  document: string
  pixKeyType: PixKeyType | ''
  pixKey: string
  defaultCommissionPercent: number
}

export async function fetchCreatorPayoutProfile(userId: string) {
  const { data, error } = await supabase
    .from('creator_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as CreatorPayoutProfile | null) ?? null
}

export async function upsertCreatorPayoutProfile(input: CreatorPayoutProfileInput) {
  const isPayoutEnabled = Boolean(
    input.payoutName.trim() &&
      input.document.trim() &&
      input.pixKeyType &&
      input.pixKey.trim(),
  )

  const { data, error } = await supabase
    .from('creator_profiles')
    .upsert(
      {
        user_id: input.userId,
        payout_name: input.payoutName.trim() || null,
        document: input.document.trim() || null,
        pix_key_type: input.pixKeyType || null,
        pix_key: input.pixKey.trim() || null,
        default_commission_percent: input.defaultCommissionPercent,
        payout_hold_days: 30,
        is_payout_enabled: isPayoutEnabled,
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as CreatorPayoutProfile
}
