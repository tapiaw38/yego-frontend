import { apiClient } from './client'

export interface PresignResponse {
  upload_url: string
  public_url: string
  key: string
}

export const uploadService = {
  async presign(filename: string, contentType: string, folder = 'imports/images'): Promise<PresignResponse> {
    const res = await apiClient.post<PresignResponse>('/api/admin/uploads/presign', {
      filename,
      content_type: contentType,
      folder,
    })
    return res.data
  },

  async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
  },

  // Convenience: presign + upload, returns the public URL
  async upload(file: File, folder?: string): Promise<string> {
    const { upload_url, public_url } = await this.presign(file.name, file.type, folder)
    await this.uploadToS3(upload_url, file)
    return public_url
  },
}
