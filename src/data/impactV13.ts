// الإصدار 13: اختصار قياس الأثر إلى خمسة مؤشرات أساسية بطلب مسؤولة المبادرة (25 أكتوبر 2026).
// تُحذف بقية المؤشرات وتُزال روابط الشواهد بها (الشواهد نفسها باقية). النتيجة الفعلية فارغة: «لم تُقَس بعد».
import type { AppData, ImpactMeasure } from './types'
import { newId, nowIso } from '../lib/util'

const PERIOD = 'فترة القياس: مدة المبادرة من 1 سبتمبر 2026م إلى 30 مايو 2027م (كما في وثيقة السياسة).'
const NOT_MEASURED = 'النتيجة الفعلية: لم تُقَس بعد.'

type Core = Pick<ImpactMeasure, 'title' | 'unit' | 'baseline' | 'target' | 'method' | 'dataSource' | 'notes'> & { aliases: string[] }

const core: Core[] = [
  {
    title: 'نسبة المعلمات المشاركات في التدريب',
    aliases: ['نسبة مشاركة المعلمات في التدريب'],
    unit: '%',
    baseline: '0',
    target: '80',
    method: 'عدد المعلمات المشاركات ÷ إجمالي المعلمات المستهدفات × 100.',
    dataSource: 'سجل الحضور وتقارير التدريب.',
    notes: `الوصف: نسبة المعلمات المشاركات في التدريب على الذكاء الاصطناعي والتحول الرقمي.\n${PERIOD}\n${NOT_MEASURED}`,
  },
  {
    title: 'نسبة المعلمات اللاتي طبّقن ما تعلمنه',
    aliases: ['نسبة المعلمات اللاتي طبقن ما تعلمنه'],
    unit: '%',
    baseline: '0',
    target: '70',
    method: 'عدد المعلمات اللاتي طبّقن المهارات المكتسبة ÷ عدد المعلمات المشاركات في التدريب × 100.',
    dataSource: 'نماذج التطبيقات التعليمية وخطط الدروس والشواهد الرقمية.',
    notes: `الوصف: نسبة المعلمات اللاتي طبّقن ما تعلمنه في ممارساتهن التعليمية.\n${PERIOD}\n${NOT_MEASURED}`,
  },
  {
    title: 'عدد الممارسات التعليمية الرقمية الموثقة',
    aliases: ['عدد الممارسات التعليمية الموثقة', 'عدد الممارسات والأنشطة التعليمية التي توظف الذكاء الاصطناعي'],
    unit: 'عدد',
    baseline: '0',
    target: '10',
    method: 'حصر الممارسات التعليمية المنفذة والموثقة خلال فترة المبادرة.',
    dataSource: 'ملفات الإنجاز والأعمال التعليمية والشواهد الرقمية.',
    notes: `الوصف: عدد الممارسات التعليمية الرقمية والذكاء الاصطناعي الموثقة.\nخط الأساس: 0 ممارسة موثقة عند بدء المبادرة.\n${PERIOD}\n${NOT_MEASURED}`,
  },
  {
    title: 'مستوى وعي الطالبات بالاستخدام المسؤول للذكاء الاصطناعي',
    aliases: ['مستوى وعي الطالبات بالاستخدام المسؤول'],
    unit: '% إجابات صحيحة',
    baseline: '',
    target: '85',
    method: 'تطبيق اختبار قبلي وبعدي حول الخصوصية والتحقق من المعلومات والنزاهة الأكاديمية والاستخدام المسؤول للذكاء الاصطناعي.',
    dataSource: 'نتائج الاختبارات القبلية والبعدية.',
    notes: `الوصف: مستوى وعي الطالبات بالاستخدام المسؤول للذكاء الاصطناعي.\nخط الأساس: يُحدَّد من خلال القياس القبلي.\nالمستهدف: تحقيق 85% على الأقل في القياس البعدي.\n${PERIOD}\n${NOT_MEASURED}`,
  },
  {
    title: 'نسبة استيفاء متطلبات Microsoft Elevate',
    aliases: [],
    unit: '%',
    baseline: '0',
    target: '',
    method: 'عدد المتطلبات المستوفاة والمدعومة بالشواهد ÷ إجمالي المتطلبات المحددة × 100.',
    dataSource: 'قائمة متطلبات البرنامج والشواهد المدرسية ونتائج التقييم الرسمي عند توفرها.',
    notes: `الوصف: نسبة استيفاء متطلبات Microsoft Elevate المدعومة بالشواهد. يقيس التقدم نحو المتطلبات، ولا يعني الحصول على اعتماد أو اعتراف من Microsoft.\nخط الأساس: 0% من المتطلبات المستوفاة والموثقة عند بدء المبادرة.\nالمستهدف: استيفاء المتطلبات المحددة للمستوى المستهدف وفق معايير البرنامج.\n${PERIOD}\n${NOT_MEASURED}`,
  },
]

export function applyImpactV13(d: AppData): AppData {
  const now = nowIso()
  const used = new Set<string>()
  const impact: ImpactMeasure[] = core.map(({ aliases, ...m }) => {
    const names = [m.title, ...aliases]
    const found = names.map((n) => d.impact.find((x) => x.title.trim() === n && !used.has(x.id))).find(Boolean)
    if (found) {
      used.add(found.id)
      // تُحفظ أي نتيجة فعلية مسجلة سابقًا مع تاريخها، ولا يُخترع غيرها
      return { ...found, ...m, actual: found.actual, measuredOn: found.measuredOn, causalDesign: found.causalDesign, updatedAt: now }
    }
    return { id: newId(), createdAt: now, updatedAt: now, ...m, actual: '', measuredOn: '', causalDesign: false }
  })
  const keep = new Set(impact.map((m) => m.id))
  const evidence = d.evidence.map((e) =>
    e.links.some((l) => l.kind === 'impact' && !keep.has(l.id)) ? { ...e, links: e.links.filter((l) => l.kind !== 'impact' || keep.has(l.id)) } : e,
  )
  return { ...d, impact, evidence }
}
