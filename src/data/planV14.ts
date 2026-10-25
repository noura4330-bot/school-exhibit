// الإصدار 14: مواعيد خطة التنفيذ ومسؤوليتها كما حددتها مسؤولة المبادرة (25 أكتوبر 2026).
// يُربط كل نشاط قائم بمرحلته، ويأخذ موعدها والمسؤولة ومخرجها. لا يُغيَّر نشاط منفذ أو ملغى، ولا تُنشأ أنشطة مكررة.
import type { AppData } from './types'
import { nowIso } from '../lib/util'

export const PLAN_OWNER = 'نورة الزبيدي'

export const planStages = [
  {
    title: 'التأسيس والحوكمة',
    start: '2026-11-01',
    end: '2026-11-15',
    desc: 'إعداد خطة المبادرة، وتحديد الأهداف والمؤشرات، وتنظيم آلية التنفيذ والتوثيق، وإعداد ضوابط الاستخدام المسؤول للذكاء الاصطناعي.',
    output: 'خطة تنفيذ معتمدة، ومؤشرات واضحة، وضوابط للاستخدام المسؤول.',
  },
  {
    title: 'بناء قدرات المعلمات',
    start: '2026-11-16',
    end: '2026-12-15',
    desc: 'تنفيذ ورش تدريبية لتطوير مهارات المعلمات في توظيف الذكاء الاصطناعي والأدوات الرقمية في التعليم.',
    output: 'معلمات يمتلكن مهارات أولية قابلة للتطبيق، مع توثيق التدريب والمشاركة.',
  },
  {
    title: 'التطبيق في الممارسات التعليمية',
    start: '2026-12-16',
    end: '2027-02-28',
    desc: 'دعم المعلمات في توظيف الأدوات الرقمية والذكاء الاصطناعي في الدروس والأنشطة، وتوثيق الممارسات التعليمية الناتجة.',
    output: 'ممارسات تعليمية موثقة وشواهد على التطبيق الفعلي.',
  },
  {
    title: 'تمكين الطالبات والمشروعات التعليمية',
    start: '2027-03-01',
    end: '2027-04-30',
    desc: 'توعية الطالبات بالاستخدام المسؤول للذكاء الاصطناعي، وتنفيذ أنشطة ومشروعات تعليمية تعالج مشكلات واقعية مع مراعاة الخصوصية والتحقق من المعلومات.',
    output: 'مشروعات طلابية وشواهد على تنمية الوعي بالاستخدام المسؤول.',
  },
  {
    title: 'توثيق الشواهد وقياس الأثر والتحسين',
    start: '2027-05-01',
    end: '2027-05-31',
    desc: 'جمع الشواهد، ومراجعة مؤشرات الأداء، وتحليل نتائج القياس، وتحديد فرص التحسين، وتنظيم ملف متطلبات Microsoft Elevate.',
    output: 'ملف شواهد منظم، ونتائج قياس موثقة، وخطة تحسين مبنية على النتائج.',
  },
]

/** مرحلة كل نشاط من أنشطة الخطة الأصلية بحسب موضوعه */
const stageByTitle: Record<string, number> = {
  'إعداد خطة المبادرة وسياسات الاستخدام المسؤول للذكاء الاصطناعي': 1,
  'تنفيذ ورش تدريبية تطبيقية للمعلمات': 2,
  'تطبيق ممارسات تعليمية مبتكرة في الصفوف': 3,
  'توعية الطالبات بالاستخدام الآمن والمسؤول للذكاء الاصطناعي': 4,
  'تنفيذ مشروعات طالبات تعالج مشكلات تعليمية أو واقعية': 4,
  'توثيق الممارسات والشواهد': 5,
  'قياس أثر المبادرة ومراجعة مؤشرات الأداء': 5,
  'تطوير الإجراءات بناءً على نتائج التقييم': 5,
}

const stageByDomain: Record<string, number> = {
  initiative: 1,
  governance: 1,
  professional: 2,
  teaching: 3,
  projects: 4,
  impact: 5,
  readiness: 5,
}

const TIMELINE_INTRO = 'تُنفذ المبادرة على خمس مراحل من نوفمبر 2026 إلى مايو 2027:'

export function applyPlanV14(d: AppData): AppData {
  const now = nowIso()
  const activities = d.activities.map((a) => {
    const stage = a.stage ?? stageByTitle[a.title.trim()] ?? stageByDomain[a.domain]
    const st = stage ? planStages[stage - 1] : undefined
    const next = { ...a, responsible: PLAN_OWNER }
    if (st) {
      next.stage = stage
      if (a.status === 'planned') {
        next.date = st.start
        next.endDate = st.end
      }
      if (!a.output?.trim()) next.output = st.output
    }
    return JSON.stringify(next) === JSON.stringify(a) ? a : { ...next, updatedAt: now }
  })
  // الجدول الزمني في ملف المبادرة: تُحدَّث مراحله الخمس بأسمائها ووصفها، ويبقى كما هو إن غُيّر عدد مراحله
  const steps = d.initiative.timeline.split('\n').filter((l) => /^\s*المرحلة\s*[0-9٠-٩]/.test(l))
  const timeline = steps.length === 5
    ? [TIMELINE_INTRO, ...planStages.map((s, i) => `المرحلة ${i + 1} — ${s.title}: ${s.desc}`)].join('\n')
    : d.initiative.timeline
  return { ...d, activities, initiative: { ...d.initiative, timeline } }
}
