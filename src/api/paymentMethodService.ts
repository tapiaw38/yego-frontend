import { apiClient } from './client'
import type { PaymentMethod, PaymentMethodCreate, PaymentMethodUpdate } from '../types/payment'

export const paymentMethodService = {
  async createPaymentMethod(data: PaymentMethodCreate): Promise<PaymentMethod> {
    const response = await apiClient.post<PaymentMethod>('/api/payment-methods', data)
    return response.data
  },

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await apiClient.get<PaymentMethod[]>('/api/payment-methods')
    return response.data
  },

  async getDefaultPaymentMethod(): Promise<PaymentMethod | null> {
    try {
      const response = await apiClient.get<PaymentMethod>('/api/payment-methods/default')
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  async updatePaymentMethod(paymentMethodId: number, data: PaymentMethodUpdate): Promise<PaymentMethod> {
    const response = await apiClient.put<PaymentMethod>(`/api/payment-methods/${paymentMethodId}`, data)
    return response.data
  },

  async deletePaymentMethod(paymentMethodId: number): Promise<void> {
    await apiClient.delete(`/api/payment-methods/${paymentMethodId}`)
  }
}
