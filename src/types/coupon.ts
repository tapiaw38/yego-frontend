export type DiscountType = 'PERCENTAGE' | 'FIXED'

export interface Coupon {
  id: string
  code: string
  description?: string
  discount_type: DiscountType
  discount_value: number
  max_uses?: number
  current_uses: number
  usage_limit_per_user: number
  min_order_amount?: number
  valid_from?: string
  valid_until?: string
  active: boolean
  icon_url?: string
  cover_url?: string
  created_at: string
  updated_at: string
}

export interface CreateCouponInput {
  code: string
  description?: string
  discount_type: DiscountType
  discount_value: number
  max_uses?: number | null
  usage_limit_per_user: number
  min_order_amount?: number | null
  valid_from?: string | null
  valid_until?: string | null
  active: boolean
  icon_url?: string | null
  cover_url?: string | null
}

export interface UpdateCouponInput {
  code?: string
  description?: string | null
  discount_type?: DiscountType
  discount_value?: number
  max_uses?: number | null
  usage_limit_per_user?: number
  min_order_amount?: number | null
  valid_from?: string | null
  valid_until?: string | null
  active?: boolean
  icon_url?: string | null
  cover_url?: string | null
}

export interface ListCouponsResponse {
  coupons: Coupon[]
}
