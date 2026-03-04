export interface Transaction {
  id: string
  order_id: string
  user_id: string
  profile_id?: string
  amount: number
  currency: string
  status: string
  payment_id?: number
  gateway_payment_id?: string
  collector_id?: string
  description?: string
  created_at: string
  updated_at: string
}

export interface ListTransactionsResponse {
  transactions: Transaction[]
  total: number
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(price)
}

export const StatusLabels: Record<string, string> = {
  approved: 'Aprobado',
  pending: 'Pendiente',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  charged_back: 'Contracargo'
}

export const StatusColors: Record<string, string> = {
  approved: '#10b981',
  pending: '#f59e0b',
  rejected: '#ef4444',
  cancelled: '#6b7280',
  refunded: '#8b5cf6',
  charged_back: '#dc2626'
}
