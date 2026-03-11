import { apiClient } from './client'
import type { Order, CreateOrderInput, UpdateStatusInput, ClaimOrderResponse, MyOrdersResponse, OrderData } from '../types/order'

export interface UpdateOrderInput {
  status?: string
  status_message?: string
  eta?: string
  data?: OrderData
}

export const orderService = {
  async getOrder(id: string): Promise<Order> {
    const response = await apiClient.get<{ data: Order }>(`/api/orders/${id}`)
    return response.data.data
  },

  async createOrder(input: CreateOrderInput): Promise<Order> {
    const { data } = await apiClient.post<Order>('/api/orders', input)
    return data
  },

  async updateStatus(id: string, input: UpdateStatusInput): Promise<Order> {
    const { data } = await apiClient.patch<Order>(`/api/orders/${id}/status`, input)
    return data
  },

  async claimOrder(token: string, securityCode?: string): Promise<ClaimOrderResponse> {
    const { data } = await apiClient.post<ClaimOrderResponse>(`/api/orders/claim/${token}`, {
      security_code: securityCode
    })
    return data
  },

  async getClaimInfo(token: string): Promise<{ order_id: string; user_id: string | null; profile_id: string | null; status: string; is_claimed: boolean }> {
    const { data } = await apiClient.get(`/api/orders/claim/${token}/info`)
    return data
  },

  async payForOrder(orderId: string, securityCode: string): Promise<{ order_id: string; status: string }> {
    const { data } = await apiClient.post(`/api/orders/${orderId}/pay`, {
      security_code: securityCode
    })
    return data
  },

  async createPaymentLink(orderId: string): Promise<{ init_point: string; sandbox_init_point: string }> {
    const { data } = await apiClient.post(`/api/orders/${orderId}/payment-link`, {})
    return data
  },

  async getMyOrders(): Promise<MyOrdersResponse> {
    const { data } = await apiClient.get<MyOrdersResponse>('/api/orders/my')
    return data
  },

  async updateOrder(id: string, input: UpdateOrderInput): Promise<Order> {
    const { data } = await apiClient.put<Order>(`/api/admin/orders/${id}`, input)
    return data
  },

  async assignDelivery(orderId: string, deliveryUserId: string): Promise<Order> {
    const { data } = await apiClient.post<Order>(`/api/admin/orders/${orderId}/assign-delivery`, {
      delivery_user_id: deliveryUserId
    })
    return data
  },

  async acceptDelivery(orderId: string): Promise<{ data: Order }> {
    const { data } = await apiClient.post<{ data: Order }>(`/api/orders/${orderId}/accept-delivery`, {})
    return data
  },

  async getDeliveryOrders(): Promise<{ orders: Order[]; total: number }> {
    const { data } = await apiClient.get<{ orders: Order[]; total: number }>('/api/orders/delivery')
    return data
  }
}
