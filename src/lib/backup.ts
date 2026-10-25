// النسخة الاحتياطية (JSON): تصديرها واستيرادها، مشتركة بين الإعدادات وشاشة نقل البيانات إلى القاعدة المركزية.
import type { AppData, StoredFileMeta } from '../data/types'
import { blobToDataUrl, dataUrlToBlob } from './fileStore'

export interface ExportFile {
  app: 'school-exhibit'
  exportedAt: string
  data: AppData
  files?: (StoredFileMeta & { dataUrl: string })[]
}

export async function buildBackup(data: AppData, files?: (StoredFileMeta & { blob: Blob })[]): Promise<ExportFile> {
  const payload: ExportFile = { app: 'school-exhibit', exportedAt: new Date().toISOString(), data }
  if (files)
    payload.files = await Promise.all(
      files.map(async (f) => ({ id: f.id, name: f.name, type: f.type, size: f.size, addedAt: f.addedAt, dataUrl: await blobToDataUrl(f.blob) })),
    )
  return payload
}

export async function parseBackup(file: File): Promise<ExportFile> {
  const parsed = JSON.parse(await file.text()) as Partial<ExportFile>
  if (parsed.app !== 'school-exhibit' || !parsed.data) throw new Error('الملف ليس نسخة احتياطية من هذا المعرض.')
  return parsed as ExportFile
}

/** ملفات النسخة الاحتياطية واحدًا واحدًا (كي لا تُحمَّل كلها في الذاكرة معًا) */
export async function* backupFiles(b: ExportFile): AsyncGenerator<StoredFileMeta & { blob: Blob }> {
  for (const f of b.files ?? []) {
    yield { id: f.id, name: f.name, type: f.type, size: f.size, addedAt: f.addedAt, blob: await dataUrlToBlob(f.dataUrl) }
  }
}
