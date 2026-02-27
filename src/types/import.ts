export interface ImportRecord {
  id: string
  data: Record<string, unknown>
  profile_id?: string
  created_at: string
  updated_at: string
}

export interface ListImportsResponse {
  records: ImportRecord[]
  total: number
}

export interface UploadImportResponse {
  imported: number
}
