export type RoleCode = 'admin' | 'student'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  timezone: string
  locale: string
}

export interface UpdateProfileInput {
  full_name: string | null
  timezone: string
  locale: string
}
