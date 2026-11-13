// الإصدار 22 (طلب مديرة النظام 2026-11-13): الممارسات المستهدفة والمخرجات المتوقعة بصياغة جديدة مرتبطة بالبرامج،
// سطر لكل برنامج بترتيب البرامج في الشواهد (01 إلى 11). تُستبدل مرة واحدة بطلبها، وتبقى قابلة للتعديل من «تعديل الملف».
// النص السابق محفوظ في سجل النسخ السابقة.
import type { InitiativeProfile } from './types'

// الإصدار 23: سطر البرنامج 12 (التوعية الرقمية)، يُضاف إن لم يكن موجودًا
export const PRACTICE_12 = 'توعية الطالبات بالتحول الرقمي والأمن السيبراني والاستخدام المسؤول للذكاء الاصطناعي.'
export const OUTPUT_12 = 'تعزيز وعي الطالبات بالتحول الرقمي والأمن السيبراني والاستخدام المسؤول للذكاء الاصطناعي.'
// الإصدار 25: الصياغة السابقة لسطر التوعية تُستبدل بالجديدة (طلب مديرة النظام 2026-11-13)
const OLD_PRACTICE_12 = 'توعية الطالبات بالاستخدام الآمن للذكاء الاصطناعي وبالتحول الرقمي والممارسات الرقمية.'
const OLD_OUTPUT_12 = 'تعزيز وعي الطالبات بالاستخدام الآمن والمسؤول للذكاء الاصطناعي والممارسات الرقمية السليمة.'
export function applyProfileV25(ini: Partial<InitiativeProfile>) {
  const swap = (v: string | undefined, a: string, b: string) => (v ? v.split('\n').map((l) => (l.trim() === a ? b : l)).join('\n') : v)
  ini.targetPractices = swap(ini.targetPractices, OLD_PRACTICE_12, PRACTICE_12)
  ini.expectedOutputs = swap(ini.expectedOutputs, OLD_OUTPUT_12, OUTPUT_12)
}

export function applyProfileV23(ini: Partial<InitiativeProfile>) {
  const add = (v: string | undefined, line: string) => (v?.includes(line) ? v : v?.trim() ? `${v.trimEnd()}\n${line}` : line)
  ini.targetPractices = add(ini.targetPractices, PRACTICE_12)
  ini.expectedOutputs = add(ini.expectedOutputs, OUTPUT_12)
}

// الإصدار 24: حذف برنامج «إدارة المحتوى التعليمي SharePoint» من الموقع كله بطلب مديرة النظام (2026-11-13)
const SP_PRACTICE = 'تنظيم المحتوى التعليمي وإدارته باستخدام SharePoint.'
const SP_OUTPUT = 'إتاحة المحتوى التعليمي بصورة رقمية منظمة.'
export function applyProfileV24(ini: Partial<InitiativeProfile>) {
  const drop = (v: string | undefined, line: string) => (v ? v.split('\n').filter((l) => l.trim() !== line).join('\n') : v)
  ini.targetPractices = drop(ini.targetPractices, SP_PRACTICE)
  ini.expectedOutputs = drop(ini.expectedOutputs, SP_OUTPUT)
}

export const targetPracticesV22 = [
  'تدريب الطالبات على استخدام Microsoft Teams.',
  'تفعيل دفتر الملاحظات الرقمي OneNote واستخدامه في تنظيم ملفات الإنجاز.',
  'تدريب الطالبات على التخزين السحابي باستخدام OneDrive.',
  'توظيف Microsoft Forms في الاختبارات والتقويم الإلكتروني.',
  'تنفيذ الحصص الافتراضية عبر Microsoft Teams.',
  'توظيف Word Online في إنشاء المستندات وتحريرها ومشاركتها.',
  'استخدام PowerPoint Online في إعداد العروض التقديمية وبثها عبر الإنترنت.',
  'توثيق مشروعات الطالبات الرقمية.',
  'توظيف التطبيقات الرقمية في الممارسات التعليمية والدروس المنفذة من المعلمات.',
  'بناء قدرات المعلمات في توظيف التطبيقات الرقمية.',
  PRACTICE_12,
].join('\n')

export const expectedOutputsV22 = [
  'تمكين الطالبات من استخدام تطبيقات Microsoft التعليمية.',
  'اكتساب الطالبات مهارات تنظيم ملفات الإنجاز إلكترونيًا.',
  'تنمية مهارات التخزين السحابي وإدارة الملفات.',
  'التعرف على أدوات التقويم الإلكتروني وتوظيفها.',
  'تمكين الطالبات من المشاركة في الحصص الافتراضية.',
  'تنمية مهارات الكتابة الرقمية والعمل التشاركي.',
  'تطوير مهارات إعداد العروض التقديمية ومشاركتها.',
  'توثيق مراحل مشروعات الطالبات ومخرجاتها رقميًا.',
  'زيادة توظيف التطبيقات الرقمية في الممارسات التعليمية.',
  'تعزيز جاهزية المعلمات لتوظيف التطبيقات الرقمية في التدريس.',
  OUTPUT_12,
].join('\n')

export function applyProfileV22(ini: Partial<InitiativeProfile>) {
  ini.targetPractices = targetPracticesV22
  ini.expectedOutputs = expectedOutputsV22
}
