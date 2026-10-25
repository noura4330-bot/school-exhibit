export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const nowIso = (): string => new Date().toISOString()

export const todayIso = (): string => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// التقويم الميلادي بأرقام لاتينية لتجنب الالتباس عند الإدخال عبر حقول التاريخ
const dateFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})
const dateTimeFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatDate(value: string | undefined | null): string {
  if (!value) return '—'
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(d.getTime()) ? value : dateFmt.format(d)
}

export function formatDateTime(value: string | undefined | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : dateTimeFmt.format(d)
}

export const formatNumber = (n: number): string =>
  new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 1 }).format(n)

export function isValidUrl(value: string): boolean {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024)} ك.ب`
  return `${formatNumber(bytes / (1024 * 1024))} م.ب`
}

export const isFilled = (v: unknown): boolean => {
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'string') return v.trim().length > 0
  return v !== null && v !== undefined
}

/** يطابق النص بعد توحيد بعض أشكال الحروف العربية */
export function normalizeArabic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
}

export const matches = (query: string, ...fields: (string | undefined)[]): boolean => {
  const q = normalizeArabic(query)
  if (!q) return true
  return fields.some((f) => f && normalizeArabic(f).includes(q))
}

export function inRange(date: string, from: string, to: string): boolean {
  if (!from && !to) return true
  if (!date) return false
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

/** هل يعمل الموقع داخل إطار (مثل صفحة Artifact المنشورة)؟ */
export const isEmbedded = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

interface DownloadsApi {
  save: (r: { filename: string; data: Blob | string }) => Promise<{ status: string }>
}
interface ClaudeHost {
  use: (name: string) => Promise<unknown>
}

let downloadsApi: Promise<DownloadsApi | null> | null = null
function getDownloads(): Promise<DownloadsApi | null> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude
  if (!host || typeof host.use !== 'function') return Promise.resolve(null)
  downloadsApi ??= host.use('downloads').then((d) => (d as DownloadsApi | null) ?? null).catch(() => null)
  return downloadsApi
}

/** يعلن خطأ التنزيل لتعرضه واجهة الإشعارات */
function reportDownloadError(message: string) {
  window.dispatchEvent(new CustomEvent('exhibit:download-error', { detail: message }))
}

/**
 * تنزيل ملف: داخل صفحة Artifact المنشورة يمر عبر إذن التنزيل في المنصة (تأكيد من المستخدمة)،
 * وخارجها يستخدم رابط تنزيل عاديًا.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<boolean> {
  const api = await getDownloads()
  if (api) {
    try {
      await api.save({ filename, data: blob })
      return true
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'declined') return false
      reportDownloadError(
        code === 'rejected_extension'
          ? `لا يمكن تنزيل ملف بامتداد «${filename.split('.').pop()}» من النسخة المنشورة.`
          : 'تعذر التنزيل في هذه الصفحة. جرّبي النسخة المحلية من الموقع.',
      )
      return false
    }
  }
  if (isEmbedded && (window as unknown as { claude?: ClaudeHost }).claude) {
    reportDownloadError('التنزيل غير متاح في هذا العرض.')
    return false
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 2000)
  return true
}

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`

/** CSV مع علامة BOM ليفتح بشكل صحيح بالعربية في Excel */
export function toCsv(headers: string[], rows: string[][]): Blob {
  const lines = (headers.length ? [headers, ...rows] : rows).map((r) => r.map((c) => csvCell(c ?? '')).join(','))
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

/** قراءة CSV بسيطة تدعم الحقول المقتبسة */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

export const toNumber = (v: string): number | null => {
  if (!v || !v.trim()) return null
  const n = Number(v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[%٪,]/g, ''))
  return Number.isFinite(n) ? n : null
}
