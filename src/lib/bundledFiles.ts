// ملفات مضمّنة في الموقع (ملف السياسة وتقرير التحقق المرافق).
// في الحفظ المحلي تُحفظ في مخزن الملفات عند أول فتح فتعمل مثل أي ملف مرفوع؛
// وفي الحفظ المركزي تُقرأ من الموقع مباشرة دون رفعها.
import type { AppData, StoredFileMeta } from '../data/types'
import { POLICY_FILE_ID, REPORT_FILE_ID, policyAttachment, reportAttachment } from '../data/govDocs'
// استيراد ثابت: النسخة المنشورة ملف HTML واحد لا تُحمَّل فيه أجزاء منفصلة
import policyPdf from '../assets/policy-v1.0.pdf?inline'
import reportPdf from '../assets/policy-verification-report.pdf?inline'

const sources: Record<string, { meta: StoredFileMeta; data: string }> = {
  [POLICY_FILE_ID]: { meta: policyAttachment, data: policyPdf },
  [REPORT_FILE_ID]: { meta: reportAttachment, data: reportPdf },
}

export const bundledIds = () => Object.keys(sources)

export async function bundledFile(id: string): Promise<(StoredFileMeta & { blob: Blob }) | undefined> {
  const src = sources[id]
  if (!src) return undefined
  const blob = await (await fetch(src.data)).blob()
  return { ...src.meta, blob: new Blob([blob], { type: src.meta.type }) }
}

export async function ensureBundledFiles(
  data: AppData,
  io: { getFile: (id: string) => Promise<unknown>; putRawFile: (r: StoredFileMeta & { blob: Blob }) => Promise<void> },
): Promise<void> {
  const referenced = new Set(data.govDocs.flatMap((d) => [...d.files, ...(d.companionFiles ?? [])].map((f) => f.id)))
  for (const id of Object.keys(sources)) {
    if (!referenced.has(id)) continue
    if (await io.getFile(id).catch(() => undefined)) continue
    const f = await bundledFile(id)
    if (f) await io.putRawFile(f)
  }
}
