import { apiClient } from './client'
import type { ListImportsResponse, UploadImportResponse } from '../types/import'

export const importsService = {
  async uploadFile(file: File): Promise<UploadImportResponse> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await apiClient.post<UploadImportResponse>('/api/admin/import', formData, {
      headers: { 'Content-Type': undefined }
    })
    return data
  },

  async getAll(): Promise<ListImportsResponse> {
    const { data } = await apiClient.get<ListImportsResponse>('/api/admin/imports')
    return data
  },

  async update(id: string, payload: { data: Record<string, unknown>; profile_id?: string | null }): Promise<void> {
    await apiClient.put(`/api/admin/imports/${id}`, payload)
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/admin/imports/${id}`)
  },

  async clearAll(): Promise<{ deleted: number }> {
    const { data } = await apiClient.delete<{ deleted: number }>('/api/admin/imports')
    return data
  }
}
