import { authClient } from './authClient'
import type {
  LoginParams,
  LoginResponse,
  MeUserResponse,
  RegisterParams,
  RegisterResponse,
  UserListResponse,
} from '../types/auth'

export const authService = {
  async login(params: LoginParams): Promise<LoginResponse> {
    const { data } = await authClient.post<LoginResponse>('/auth/login', {
      email: params.email,
      password: params.password,
      sso_type: params.ssoType,
      code: params.ssoCode
    })
    return data
  },

  async register(params: RegisterParams): Promise<RegisterResponse> {
    const { data } = await authClient.post<RegisterResponse>('/auth/register', params)
    return data
  },

  async me(): Promise<MeUserResponse> {
    const { data } = await authClient.get<MeUserResponse>('/user/me')
    return data
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await authClient.put('/user/me/password', {
      old_password: oldPassword,
      new_password: newPassword,
    })
  },

  async setPassword(newPassword: string): Promise<void> {
    await authClient.post('/user/me/password/set', {
      new_password: newPassword,
    })
  },

  async requestResetPassword(email: string): Promise<void> {
    await authClient.post('/auth/request-reset-password', { email })
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await authClient.post('/auth/reset-password', { token, password })
  },

  async listUsers(params?: { role?: string; limit?: number; offset?: number }): Promise<UserListResponse> {
    const { data } = await authClient.get<UserListResponse>('/user/list', { params })
    return data
  },

  getToken(): string | null {
    return localStorage.getItem('token')
  },

  setToken(token: string): void {
    localStorage.setItem('token', token)
  },

  removeToken(): void {
    localStorage.removeItem('token')
  },

  isAuthenticated(): boolean {
    return this.getToken() !== null
  },

  logout(): void {
    this.removeToken()
  }
}
