// خطة التنفيذ (طلب مديرة النظام 2026-11-13): يُحسب النشاط «منفذًا وموثقًا» تلقائيًا من البيانات المسجلة في الموقع
// متى وُجد لموضوعه مصدر مطابق (شواهد برنامج، أو ملف السياسة، أو نتائج مؤشرات). النشاط الذي لا مصدر مطابقًا له
// يبقى على حالته المسجلة وربطه السابق بالشواهد، ولا يُفترض تنفيذه.
import type { Activity, AppData } from './types'

export interface ActivityAuto {
  /** عدد السجلات التي تثبت تنفيذ النشاط */
  count: number
  /** وصف المصدر، مثل «شواهد بناء قدرات المعلمات» */
  source: string
}

const programCount = (d: AppData, ids: string[]) => d.evidence.filter((e) => e.programId && ids.includes(e.programId)).length

export function activityAuto(d: AppData, a: Activity): ActivityAuto | null {
  const t = a.title
  if (/توثيق الممارسات والشواهد/.test(t)) return { count: d.evidence.filter((e) => e.programId).length, source: 'شواهد البرامج' }
  if (/قياس أثر/.test(t)) return { count: d.programMeasures.filter((m) => m.actual.trim()).length, source: 'مؤشرات بنتائج مسجلة' }
  if (/خطة المبادرة|سياسات الاستخدام/.test(t)) {
    const doc = d.govDocs[0]
    return { count: doc ? doc.files.length : 0, source: 'ملف سياسة الاستخدام والحوكمة' }
  }
  if (/ورش|المعلمات/.test(t) && !/ممارسات/.test(t)) return { count: programCount(d, ['teacher-capacity']), source: 'شواهد بناء قدرات المعلمات' }
  if (/ممارسات تعليمية/.test(t)) return { count: programCount(d, ['teaching-practices']), source: 'شواهد توظيف التقنية في الممارسات التعليمية' }
  if (/مشروعات/.test(t)) return { count: programCount(d, ['student-projects']), source: 'شواهد توثيق مشروعات الطالبات' }
  return null
}
