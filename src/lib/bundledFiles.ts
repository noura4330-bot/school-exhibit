// ملفات مضمّنة في الموقع (ملف السياسة وتقرير التحقق المرافق) تُحفظ في مخزن الملفات المحلي عند أول فتح،
// فتعمل مثل أي ملف مرفوع: فتح وتنزيل وتحديث. لا تُعاد إذا حذفتها المستخدمة من الوثيقة.
import type { AppData } from '../data/types'
import { POLICY_FILE_ID, REPORT_FILE_ID, policyAttachment, reportAttachment } from '../data/govDocs'
import { dataUrlToBlob, getFile, putRawFile } from './fileStore'
// استيراد ثابت: النسخة المنشورة ملف HTML واحد لا تُحمَّل فيه أجزاء منفصلة
import policyPdf from '../assets/policy-v1.0.pdf?inline'
import reportPdf from '../assets/policy-verification-report.pdf?inline'

const sources = {
  [POLICY_FILE_ID]: { meta: policyAttachment, data: policyPdf },
  [REPORT_FILE_ID]: { meta: reportAttachment, data: reportPdf },
}

export async function ensureBundledFiles(data: AppData): Promise<void> {
  const referenced = new Set(data.govDocs.flatMap((d) => [...d.files, ...(d.companionFiles ?? [])].map((f) => f.id)))
  for (const [id, src] of Object.entries(sources)) {
    if (!referenced.has(id)) continue
    if (await getFile(id).catch(() => undefined)) continue
    const blob = await dataUrlToBlob(src.data)
    await putRawFile({ ...src.meta, blob: new Blob([blob], { type: src.meta.type }) })
  }
}
