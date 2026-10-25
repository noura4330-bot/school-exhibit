// الملفات المرفقة في قاعدة البيانات المركزية: المحتوى في تخزين خاص (exhibit-files) وبياناته في جدول files.
// لا روابط عامة: التنزيل يتطلب تسجيل الدخول ودورًا يسمح بالاطلاع، والرفع والحذف لمن يملك التعديل.
import type { StoredFileMeta } from '../data/types'
import { FILES_BUCKET, must, sb, toCloudError } from './cloud'
import { bundledFile, bundledIds } from './bundledFiles'
import { newId, nowIso } from './util'

type StoredFile = StoredFileMeta & { blob: Blob }
interface FileRow {
  id: string
  name: string
  type: string
  size: number
  added_at: string
  path: string
}

const client = () => {
  if (!sb) throw new Error('قاعدة البيانات المركزية غير مفعّلة')
  return sb
}
const metaOf = (r: FileRow): StoredFileMeta => ({ id: r.id, name: r.name, type: r.type, size: Number(r.size), addedAt: r.added_at })

async function upload(path: string, blob: Blob, upsert: boolean) {
  const { error } = await client().storage.from(FILES_BUCKET).upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert })
  if (error) throw toCloudError(error)
}

async function insertRow(meta: StoredFileMeta, path: string, ignoreDuplicates: boolean) {
  const row = { id: meta.id, name: meta.name, type: meta.type, size: meta.size, added_at: meta.addedAt, path }
  // سجل جديد: إدخال فقط (لا صلاحية تعديل على جدول الملفات). عند النقل: يُتجاهل المكرر دون تعديله
  if (ignoreDuplicates) must(await client().from('files').upsert(row, { onConflict: 'id', ignoreDuplicates: true }))
  else must(await client().from('files').insert(row))
}

export async function cloudSaveFile(file: File | Blob, name?: string): Promise<StoredFileMeta> {
  const meta: StoredFileMeta = {
    id: newId(),
    name: name ?? (file instanceof File ? file.name : 'ملف'),
    type: file.type || 'application/octet-stream',
    size: file.size,
    addedAt: nowIso(),
  }
  await upload(meta.id, file, false)
  try {
    await insertRow(meta, meta.id, false)
  } catch (e) {
    await client().storage.from(FILES_BUCKET).remove([meta.id])
    throw e
  }
  return meta
}

async function row(id: string): Promise<FileRow | null> {
  return must(await client().from('files').select('*').eq('id', id).maybeSingle()) as FileRow | null
}

async function download(path: string): Promise<Blob> {
  const { data, error } = await client().storage.from(FILES_BUCKET).download(path)
  if (error || !data) throw toCloudError(error)
  return data
}

export async function cloudGetFile(id: string): Promise<StoredFile | undefined> {
  const r = await row(id)
  if (r) return { ...metaOf(r), blob: await download(r.path) }
  // ملف السياسة وتقريرها مضمّنان في الموقع نفسه
  return bundledFile(id)
}

export async function cloudDeleteFile(id: string): Promise<void> {
  const r = await row(id)
  if (!r) return
  const { error } = await client().storage.from(FILES_BUCKET).remove([r.path])
  if (error) throw toCloudError(error)
  must(await client().from('files').delete().eq('id', id))
}

export async function cloudListFileIds(): Promise<string[]> {
  const rows = must(await client().from('files').select('id')) as { id: string }[]
  return [...rows.map((r) => r.id), ...bundledIds()]
}

/** بيانات الملفات دون تنزيل محتواها */
export async function cloudListFilesMeta(): Promise<StoredFileMeta[]> {
  return (must(await client().from('files').select('*')) as FileRow[]).map(metaOf)
}

export async function cloudListAllFiles(): Promise<StoredFile[]> {
  const rows = must(await client().from('files').select('*')) as FileRow[]
  const out: StoredFile[] = []
  for (const r of rows) out.push({ ...metaOf(r), blob: await download(r.path) })
  return out
}

/** رفع ملف بمعرّفه الأصلي (عند نقل البيانات أو الاستيراد)؛ لا يكرر ملفًا موجودًا */
export async function cloudPutRawFile(record: StoredFile): Promise<void> {
  if (await row(record.id)) return
  await upload(record.id, record.blob, true)
  const { blob: _b, ...meta } = record
  void _b
  await insertRow(meta, record.id, true)
}
