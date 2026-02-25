import { apiClient } from './client'
import type { TokenDataInput, TokenResponse } from '../types/payment'

export const mercadopagoService = {
  async createToken(tokenData: TokenDataInput): Promise<TokenResponse> {
    const response = await apiClient.post<TokenResponse>('/api/mercadopago/token', tokenData)
    return response.data
  },

  async getPaymentMethodByBin(bin: string): Promise<string> {
    const response = await apiClient.get<{ id: string }>(`/api/mercadopago/payment_method?bin=${bin}`)
    return response.data?.id ?? 'visa'
  }
}
