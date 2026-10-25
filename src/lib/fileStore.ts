// تخزين الملفات المرفوعة. في الحفظ المحلي: IndexedDB داخل متصفح هذا الجهاز فقط.
// وفي الحفظ المركزي (cloudEnabled): تخزين خاص في Supabase عبر cloudFiles.ts، والدوال المصدّرة هنا تختار بينهما.
import type { StoredFileMeta } from '../data/types'
import { downloadBlob, isEmbedded, newId, nowIso } from './util'
import { cloudEnabled } from './cloud'
import { cloudDeleteFile, cloudGetFile, cloudListAllFiles, cloudListFileIds, cloudListFilesMeta, cloudPutRawFile, cloudSaveFile } from './cloudFiles'

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

async function localSaveFile(file: File | Blob, name?: string): Promise<StoredFileMeta> {
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

async function localGetFile(id: string): Promise<StoredFile | undefined> {
  return tx<StoredFile | undefined>('readonly', (s) => s.get(id) as IDBRequest<StoredFile | undefined>)
}

async function localDeleteFile(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
}

async function localListFileIds(): Promise<string[]> {
  const keys = await tx('readonly', (s) => s.getAllKeys())
  return keys.map(String)
}

async function localListAllFiles(): Promise<StoredFile[]> {
  return tx<StoredFile[]>('readonly', (s) => s.getAll() as IDBRequest<StoredFile[]>)
}

async function localClearFiles(): Promise<void> {
  await tx('readwrite', (s) => s.clear())
}

async function localPutRawFile(record: StoredFileMeta & { blob: Blob }): Promise<void> {
  await tx('readwrite', (s) => s.put(record))
}

/** ملفات IndexedDB على هذا الجهاز، حتى في الحفظ المركزي (لنقلها إلى القاعدة) */
export const localFiles = { listAll: localListAllFiles, get: localGetFile, put: localPutRawFile }

export const saveFile = (file: File | Blob, name?: string) => {
  if (file.size > MAX_FILE_BYTES) return Promise.reject(new Error('حجم الملف أكبر من الحد المسموح (50 م.ب)'))
  return cloudEnabled ? cloudSaveFile(file, name) : localSaveFile(file, name)
}
export const getFile = (id: string) => (cloudEnabled ? cloudGetFile(id) : localGetFile(id))
export const deleteFile = (id: string) => (cloudEnabled ? cloudDeleteFile(id) : localDeleteFile(id))
export const listFileIds = () => (cloudEnabled ? cloudListFileIds() : localListFileIds())
export const listAllFiles = () => (cloudEnabled ? cloudListAllFiles() : localListAllFiles())
export const listFilesMeta = (): Promise<StoredFileMeta[]> =>
  cloudEnabled ? cloudListFilesMeta() : localListAllFiles().then((all) => all.map(({ blob: _b, ...m }) => (void _b, m)))
export const clearFiles = () => (cloudEnabled ? Promise.resolve() : localClearFiles())
export const putRawFile = (record: StoredFileMeta & { blob: Blob }) => (cloudEnabled ? cloudPutRawFile(record) : localPutRawFile(record))

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
  if (cloudEnabled) return null
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
