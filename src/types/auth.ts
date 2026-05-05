export type RoleCode = 'admin' | 'student' | 'aluno' | 'professor' | 'criador'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  cpf: string | null
  whatsapp_number: string | null
  address: string | null
  address_number: string | null
  address_complement: string | null
  postal_code: string | null
  state: string | null
  province: string | null
  city: string | null
  timezone: string
  locale: string
}

export interface UpdateProfileInput {
  full_name?: string | null
  avatar_url?: string | null
  cpf?: string | null
  address?: string | null
  address_number?: string | null
  address_complement?: string | null
  postal_code?: string | null
  state?: string | null
  province?: string | null
  city?: string | null
  timezone?: string
  locale?: string
  whatsapp_number?: string | null
}
