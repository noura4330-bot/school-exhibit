// تخزين الملفات المرفوعة في IndexedDB داخل متصفح هذا الجهاز فقط.
// الملفات لا تنتقل إلى أجهزة أخرى ولا تُرفع إلى أي خادم.
import type { StoredFileMeta } from '../data/types'
import { downloadBlob, isEmbedded, newId, nowIso } from './util'

const DB_NAME = 'school-exhibit-files'
const STORE = 'files'

interface StoredFile extends StoredFileMeta {
  blob: Blob
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('المتصفح لا يدعم تخزين الملفات محليًا'))
        return
      }
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('تعذر فتح مخزن الملفات'))
    })
    dbPromise.catch(() => {
      dbPromise = null
    })
  }
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        t.oncomplete = () => resolve(req.result)
        t.onerror = () => reject(t.error ?? req.error ?? new Error('فشلت عملية التخزين'))
        t.onabort = () => reject(t.error ?? new Error('أُلغيت عملية التخزين، قد تكون المساحة ممتلئة'))
      }),
  )
}

export const MAX_FILE_BYTES = 50 * 1024 * 1024

export async function saveFile(file: File | Blob, name?: string): Promise<StoredFileMeta> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`حجم الملف أكبر من الحد المسموح (50 م.ب)`)
  }
  const meta: StoredFileMeta = {
    id: newId(),
    name: name ?? (file instanceof File ? file.name : 'ملف'),
    type: file.type || 'application/octet-stream',
    size: file.size,
    addedAt: nowIso(),
  }
  const record: StoredFile = { ...meta, blob: file }
  await tx('readwrite', (s) => s.put(record))
  return meta
}

export async function getFile(id: string): Promise<StoredFile | undefined> {
  return tx<StoredFile | undefined>('readonly', (s) => s.get(id) as IDBRequest<StoredFile | undefined>)
}

export async function deleteFile(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
}

export async function listFileIds(): Promise<string[]> {
  const keys = await tx('readonly', (s) => s.getAllKeys())
  return keys.map(String)
}

export async function listAllFiles(): Promise<StoredFile[]> {
  return tx<StoredFile[]>('readonly', (s) => s.getAll() as IDBRequest<StoredFile[]>)
}

export async function clearFiles(): Promise<void> {
  await tx('readwrite', (s) => s.clear())
}

export async function putRawFile(record: StoredFileMeta & { blob: Blob }): Promise<void> {
  await tx('readwrite', (s) => s.put(record))
}

/** فتح الملف للمعاينة؛ داخل الصفحة المنشورة لا تُفتح نوافذ جديدة، فيُعرض التنزيل بدلًا من ذلك */
export async function openStoredFile(id: string): Promise<boolean> {
  const f = await getFile(id)
  if (!f) return false
  if (isEmbedded) {
    await downloadBlob(f.blob, f.name)
    return true
  }
  const url = URL.createObjectURL(f.blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}

export async function downloadStoredFile(id: string): Promise<boolean> {
  const f = await getFile(id)
  if (!f) return false
  await downloadBlob(f.blob, f.name)
  return true
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  const e = await navigator.storage.estimate()
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 }
}

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}
