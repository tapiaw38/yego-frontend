export interface Role {
  id: string
  name: string
}

export interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string | null
  picture: string | null
  is_active: boolean
  verified_email: boolean
  auth_method: 'password' | 'google' | 'hybrid'
  roles: Role[]
}

export function isAdmin(user: User | null): boolean {
  if (!user?.roles) return false
  return user.roles.some(role => role.name === 'admin' || role.name === 'superadmin')
}

export interface LoginParams {
  email?: string
  password?: string
  ssoType?: string
  ssoCode?: string
}

export interface LoginResponse {
  token: string
  data: User
}

export interface MeUserResponse {
  data: User
}

export interface RegisterParams {
  first_name: string
  last_name: string
  email: string
  password: string
}

export interface RegisterResponse {
  data: User
}
