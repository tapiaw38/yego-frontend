import { apiClient } from './client'

export const paymentService = {
  async checkPaymentMethod(userId: string): Promise<{ has_payment_method: boolean }> {
    const { data } = await apiClient.get<{ has_payment_method: boolean }>(
      `/api/payment/check/${userId}`
    )
    return data
  }
}
