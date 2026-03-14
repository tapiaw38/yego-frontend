import { apiClient } from './client'
import type { Coupon, CreateCouponInput, UpdateCouponInput, ListCouponsResponse } from '../types/coupon'

export const couponService = {
  async list(): Promise<Coupon[]> {
    const { data } = await apiClient.get<ListCouponsResponse>('/api/admin/coupons')
    return data.coupons ?? []
  },

  async create(input: CreateCouponInput): Promise<Coupon> {
    const { data } = await apiClient.post<Coupon>('/api/admin/coupons', input)
    return data
  },

  async update(id: string, input: UpdateCouponInput): Promise<Coupon> {
    const { data } = await apiClient.put<Coupon>(`/api/admin/coupons/${id}`, input)
    return data
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/api/admin/coupons/${id}`)
  },
}
