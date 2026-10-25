// بيانات البداية: معلومات تعريفية وسجلات أولية بحالة «لم يبدأ» فقط، دون أي إنجازات أو نتائج.
import { profileV16 } from './profileV16'
import type { AppData, PolicyItem, Practice, RubricArea, Task, OfficialLink } from './types'
import { newId, nowIso } from '../lib/util'
import { applyPlanning } from './planning'
import { applyGovDocs, applyPolicyFile } from './govDocs'
import { applyImpactV13 } from './impactV13'
import { applyPlanV14 } from './planV14'
import { evaluationDefaults, followUpTaskRecords, plannedActivityRecords, seedTaskDetails } from './planContent'

export const DATA_VERSION = 16

/** ملاحظة مرجع Fluent؛ القديمة تُستبدل عند الترحيل إن لم تُعدَّل */
export const FLUENT_NOTE = 'مرجع التصميم للمسافات والطباعة. الألوان الزمردية هوية خاصة بالمعرض.'
export const OLD_FLUENT_NOTE =
  'مرجع التصميم للمسافات والطباعة وألوان الحالات. ألوان الكحلي والأزرق والفيروزي هوية خاصة بالمعرض.'

/** تاريخ آخر مراجعة لروابط المراجع الرسمية عند بناء الموقع */
const LINKS_REVIEWED = '2026-10-24'

const GUIDE_URL =
  'https://www.microsoft.com/en-us/education/blog/2026/05/microsoft-elevate-for-educators-advanced-recognition-application-guide-2026-2027/'

export const officialLinkDefaults = (): OfficialLink[] => [
  {
    id: newId(),
    title: 'دليل التقديم للاعتراف المتقدم 2026–2027',
    url: GUIDE_URL,
    note: 'تمت قراءته. يذكر الحد الأدنى: المستوى 2 في Policy and Governance والمستوى 1 في مجالين آخرين على الأقل، وأن نافذة تقديم 2026–2027 انتهت في 31 يوليو 2026.',
    reviewedAt: LINKS_REVIEWED,
  },
  {
    id: newId(),
    title: 'صفحة Microsoft Elevate Showcase Schools',
    url: 'https://learn.microsoft.com/en-us/training/educator-center/programs/microsoft-educator/showcase-schools',
    note: 'لم يُتح فتحها من بيئة البناء. راجعيها مباشرة.',
    reviewedAt: '',
  },
  {
    id: newId(),
    title: 'AI Transformation Rubric (المقياس الرسمي)',
    url: 'https://aka.ms/AITransformationrubric',
    note: 'الرابط مأخوذ من دليل التقديم الرسمي. لم يُتح فتح محتواه من بيئة البناء، لذلك لم تُدخل أي مؤشرات منه.',
    reviewedAt: '',
  },
  {
    id: newId(),
    title: 'Showcase Evidence Template (الشريحة 3)',
    url: 'https://aka.ms/ShowcaseApplicationPPT',
    note: 'الرابط مأخوذ من دليل التقديم الرسمي. يُكمَل ويُصدَّر بصيغة PDF حسب الدليل.',
    reviewedAt: '',
  },
  {
    id: newId(),
    title: 'أسئلة نموذج Showcase',
    url: 'https://aka.ms/ShowcaseQuestions2027',
    note: 'الرابط مأخوذ من دليل التقديم الرسمي.',
    reviewedAt: '',
  },
  {
    id: newId(),
    title: 'Microsoft Fluent 2 Design System',
    url: 'https://fluent2.microsoft.design/',
    note: FLUENT_NOTE,
    reviewedAt: '',
  },
]

const policyElements = [
  'سياسة الاستخدام المسؤول للذكاء الاصطناعي',
  'حماية البيانات والخصوصية',
  'النزاهة الأكاديمية',
  'التحقق من صحة المخرجات',
  'الإشراف البشري',
  'أمن الحسابات والأجهزة',
  'توعية المعلمات',
  'توعية الطالبات',
  'إجراءات مراجعة السياسات وتحديثها',
  'إثباتات الاعتماد والنشر والتطبيق',
]

const seedTasks = [
  'خطة التمكين المدرسي للذكاء الاصطناعي والتحول الرقمي',
  'سياسة الاستخدام المسؤول للذكاء الاصطناعي',
  'برنامج تدريب المعلمات',
  'برنامج توعية الطالبات',
  'توثيق الدروس التطبيقية',
  'توثيق مشروعات الطالبات',
  'سجل قياس الأثر',
  'ملف متطلبات Microsoft Elevate',
  'سجل مراسلات التسجيل',
  'تقرير الجاهزية',
]

const seedTaskAreas = [
  'initiative',
  'governance',
  'professional',
  'governance',
  'teaching',
  'projects',
  'impact',
  'readiness',
  'readiness',
  'readiness',
]

const LEAD = 'المعلمة نوره الزبيدي، معلمة التقنية الرقمية'
/** مجال المبادرة كما يرد في اسمها */
export const INITIATIVE_DOMAIN = 'الذكاء الاصطناعي والتحول الرقمي في التعليم والتعلم'

/**
 * تعريف المبادرة كما زودت به مسؤولة المبادرة (أكتوبر 2026).
 * لا يتضمن نتائج أو أعدادًا أو تواريخ تنفيذ فعلية: خط الأساس والمستهدف والنتائج تُسجل عند قياسها.
 */
export const initiativeProfileDefaults = {
  name: 'مشروع التمكين المدرسي للذكاء الاصطناعي والتحول الرقمي',
  domain: INITIATIVE_DOMAIN,
  lead: LEAD,
  vision:
    'بناء بيئة مدرسية رقمية ممكّنة بالذكاء الاصطناعي، تدعم الابتكار، وترتقي بممارسات التعليم والتعلم، وتعزز الاستخدام المسؤول للتقنيات الحديثة.',
  generalGoal:
    'تحسين نواتج التعلم من خلال توظيف الذكاء الاصطناعي والتحول الرقمي في التعليم والتعلم.',
  executionGoals: [
    'مهارات المعلمات: تطوير مهارات المعلمات في توظيف أدوات الذكاء الاصطناعي في التعليم والتعلم.',
    'وعي الطالبات: تعزيز وعي الطالبات بمفاهيم الذكاء الاصطناعي وتطبيقاته والاستخدام المسؤول له.',
    'مشروعات تطبيقية: تفعيل تطبيقات ومشروعات تعليمية توظف الذكاء الاصطناعي في معالجة مشكلات واقعية.',
    'الاستخدام الآمن: تعزيز الممارسات الرقمية الآمنة والمسؤولة، مع مراعاة الخصوصية والتحقق من المعلومات.',
    'توثيق الشواهد: توثيق الممارسات والأنشطة والشواهد التعليمية وفق متطلبات Microsoft Elevate ذات الصلة.',
    'السياسات المدرسية: تطوير السياسات والممارسات المدرسية الداعمة للاستخدام المسؤول للذكاء الاصطناعي والتحول الرقمي.',
  ].join('\n'),
  targetGroups: 'معلمات المدرسة وطالباتها، مع إشراك قيادة المدرسة في دعم المبادرة وتفعيل ممارساتها.',
  duration: 'طوال العام الدراسي، وفق الخطة التنفيذية المعتمدة للمبادرة.',
  supporters:
    'قيادة المدرسة والمعلمات المشاركات، مع الاستفادة من الموارد التدريبية المتاحة عبر Microsoft Education وMicrosoft Learn (موارد تدريبية مفتوحة، وليست شراكة رسمية).',
  responsibilities: [
    'مسؤولة المبادرة: التخطيط والتنسيق، وتصميم الأنشطة والتدريب، ومتابعة التوثيق والشواهد.',
    'قيادة المدرسة: دعم المبادرة، واعتماد الخطة والسياسات وفق الصلاحيات، وتيسير الموارد.',
    'المعلمات المشاركات: تطبيق الممارسات الصفية وتوثيقها وتقديم شواهدها.',
    'الطالبات: المشاركة في الأنشطة والمشروعات، والالتزام بالاستخدام المسؤول.',
  ].join('\n'),
  resources:
    'الأجهزة الحاسوبية، والاتصال بالإنترنت، وحسابات Microsoft التعليمية المتاحة، وقاعة التدريب، والموارد الرقمية، وأدوات الذكاء الاصطناعي المعتمدة للاستخدام التعليمي.',
  timeline: [
    'تُحدد التواريخ وفق الخطة التنفيذية المعتمدة، وتُنفذ المراحل على امتداد العام الدراسي:',
    'المرحلة 1 — التأسيس والحوكمة: إعداد الخطة وسياسة الاستخدام المسؤول للذكاء الاصطناعي.',
    'المرحلة 2 — بناء قدرات المعلمات: ورش تدريبية ومتابعة تطبيق ما تعلمنه.',
    'المرحلة 3 — التطبيق في الممارسات التعليمية: ممارسات تعليمية توظف الذكاء الاصطناعي وتوثيقها.',
    'المرحلة 4 — تمكين الطالبات والمشروعات التعليمية: توعية الطالبات بالاستخدام المسؤول، وحلول لمشكلات واقعية مع حماية الخصوصية.',
    'المرحلة 5 — توثيق الشواهد وقياس الأثر والتحسين: ربط الشواهد بالمؤشرات ومتطلبات Microsoft Elevate، وقياس الأثر، وتحديث الإجراءات بناءً على النتائج.',
  ].join('\n'),
  kpis: [
    'عدد ورش التدريب المنفذة للمعلمات.',
    'نسبة المعلمات المشاركات في التدريب، ونسبة من طبّقن ما تعلمنه في الصف.',
    'عدد الأنشطة المنفذة والموثقة بشواهد.',
    'عدد الممارسات الصفية ومشروعات الطالبات الموثقة.',
    'نسبة استكمال الشواهد المرتبطة بمؤشرات المقياس.',
    'عدد عناصر الحوكمة المعتمدة أو المطبقة من أصل عشرة عناصر.',
    'مدى تحقق الحد الأدنى من متطلبات Microsoft Elevate الواردة في دليل التقديم.',
  ].join('\n'),
}

/** القيم الافتراضية السابقة التي تُستبدل بالتعريف الجديد إن لم تُعدَّل */
export const previousInitiativeDefaults = {
  name: 'معرض التمكين المدرسي للذكاء الاصطناعي والتحول الرقمي',
  lead: 'المعلمة نوره الزبيدي',
}

export function createSeed(): AppData {
  const now = nowIso()
  const base = () => ({ id: newId(), createdAt: now, updatedAt: now })

  const policies: PolicyItem[] = policyElements.map((element) => ({
    ...base(),
    element,
    docName: '',
    summary: '',
    status: 'not_started',
    createdOn: '',
    reviewedOn: '',
    owner: '',
    docUrl: '',
    reviewNotes: '',
    nextAction: '',
    assessment: '',
    assessmentNote: '',
  }))

  const tasks: Task[] = seedTasks.map((title, i) => ({
    ...base(),
    title,
    area: seedTaskAreas[i],
    owner: seedTaskDetails[title]?.owner ?? '',
    due: '',
    status: 'not_started',
    notes: seedTaskDetails[title]?.notes ?? '',
  }))

  const stemTemplate: Practice = {
    ...base(),
    title: 'تطبيقات الذكاء الاصطناعي',
    category: 'stem',
    subject: '',
    stage: '',
    objective: '',
    need: '',
    strategy: 'منهجية STEM (التصميم الهندسي)',
    tool: '',
    implementation: '',
    teacherRole: '',
    studentRole: '',
    outcome: '',
    assessment: '',
    results: '',
    improvement: '',
    isTemplate: true,
  }

  const pgArea: RubricArea = {
    ...base(),
    name: 'Policy and Governance (السياسات والحوكمة)',
    isPolicyGovernance: true,
    targeted: true,
    selfLevel: '',
    levelReviewed: false,
    source: GUIDE_URL,
    sourceReviewedAt: LINKS_REVIEWED,
    notes: 'ورد اسم هذا المجال في دليل التقديم الرسمي. أضيفي بقية المجالات ومؤشراتها من النسخة الرسمية للمقياس.',
  }

  return applyPlanV14(applyImpactV13(applyPolicyFile(applyGovDocs(applyPlanning({
    version: DATA_VERSION,
    lastUpdated: now,
    settings: {
      schoolName: 'ثانوية أحد بني زيد',
      exhibitName: 'معرض التمكين المدرسي للذكاء الاصطناعي والتحول الرقمي',
      department: 'إدارة تعليم مكة المكرمة',
      governorate: 'القنفذة',
      leadName: LEAD,
      academicYear: '',
      goals: '',
      logoFileId: null,
      brand: 'navy',
      links: officialLinkDefaults(),
    },
    initiative: {
      rationale: '',
      problem: '',
      baseline: '',
      target: '',
      actualResults: '',
      measurementPlan: '',
      ...evaluationDefaults,
      ...initiativeProfileDefaults,
      ...profileV16,
      status: 'drafting',
      updatedAt: now,
    },
    activities: plannedActivityRecords(base),
    policies,
    workshops: [],
    practices: [stemTemplate],
    projects: [],
    evidence: [],
    areas: [pgArea],
    indicators: [],
    correspondence: [],
    program: {
      pathfinderStatus: 'unknown',
      pathfinderEvidence: '',
      showcaseStatus: 'not_started',
      submissionDate: '',
      recognitionStatus: 'none',
      recognitionDate: '',
      recognitionEvidenceUrl: '',
      recognitionNote: '',
      questionsStatus: 'not_started',
      templateStatus: 'not_started',
    },
    impact: [],
    tasks: [...tasks, ...followUpTaskRecords(base)],
    govDocs: [],
  })))))
}

/** مؤشرات الأثر الخمسة الأساسية: تظهر للتفعيل فقط إذا حُذف أحدها */
export const impactExamples = [
  { title: 'نسبة المعلمات المشاركات في التدريب', unit: '%' },
  { title: 'نسبة المعلمات اللاتي طبّقن ما تعلمنه', unit: '%' },
  { title: 'عدد الممارسات التعليمية الرقمية الموثقة', unit: 'عدد' },
  { title: 'مستوى وعي الطالبات بالاستخدام المسؤول للذكاء الاصطناعي', unit: '% إجابات صحيحة' },
  { title: 'نسبة استيفاء متطلبات Microsoft Elevate', unit: '%' },
]
