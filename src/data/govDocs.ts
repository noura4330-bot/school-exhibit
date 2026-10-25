// الإصدار 10: وثيقة حوكمة موحدة تحل محل الوثائق المنفصلة لكل عنصر.
// محتوى السياسة في ملفها المرفوع (PDF)، ولا يُعاد كتابته هنا: الأقسام العشرة عناوين تُربط بها العناصر،
// ولكل قسم خانة اختيارية لموضعه في الملف (رقم البند أو الصفحة).
import type { AppData, GovernanceDoc, PolicyDocRef, PolicyItem } from './types'
import { POLICY_TITLE } from './planning'
import { newId, nowIso } from '../lib/util'

export const UNIFIED_POLICY_TITLE = 'سياسة حوكمة الاستخدام المسؤول للذكاء الاصطناعي في ثانوية أحد بني زيد'

export const unifiedSectionTitles: [string, string][] = [
  ['s1', 'الاستخدام المسؤول للذكاء الاصطناعي'],
  ['s2', 'حماية البيانات والخصوصية'],
  ['s3', 'النزاهة الأكاديمية'],
  ['s4', 'التحقق من صحة المخرجات'],
  ['s5', 'الإشراف البشري والمسؤوليات'],
  ['s6', 'أمن الحسابات والأجهزة'],
  ['s7', 'اختيار أدوات الذكاء الاصطناعي واستخدامها'],
  ['s8', 'التوعية والتدريب'],
  ['s9', 'الإبلاغ عن المخالفات والمخاطر'],
  ['s10', 'المتابعة والتقييم والمراجعة الدورية'],
]

/** ربط العناصر العشرة الحالية بأقسام الوثيقة بحسب الموضوع. التغطية تُترك «لم تُقيَّم» حتى تُراجع مقابل نص الملف */
const elementLinks: Record<string, { sections: string[]; stages?: boolean }> = {
  'سياسة الاستخدام المسؤول للذكاء الاصطناعي': { sections: ['s1'] },
  'حماية البيانات والخصوصية': { sections: ['s2'] },
  'النزاهة الأكاديمية': { sections: ['s3'] },
  'التحقق من صحة المخرجات': { sections: ['s4'] },
  'الإشراف البشري': { sections: ['s5'] },
  'أمن الحسابات والأجهزة': { sections: ['s6'] },
  'توعية المعلمات': { sections: ['s8'] },
  'توعية الطالبات': { sections: ['s8'] },
  'إجراءات مراجعة السياسات وتحديثها': { sections: ['s10'] },
  'إثباتات الاعتماد والنشر والتطبيق': { sections: [], stages: true },
}

const docStatusFrom = (p?: PolicyItem): GovernanceDoc['status'] =>
  p?.status === 'awaiting_review' ? 'under_review' : p?.status === 'approved' || p?.status === 'applied' ? 'approved' : 'drafting'

export function createUnifiedDoc(policies: PolicyItem[]): GovernanceDoc {
  const now = nowIso()
  const main = policies.find((p) => p.element === 'سياسة الاستخدام المسؤول للذكاء الاصطناعي')
  const hasDraft = !!main?.summary.trim()
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    title: UNIFIED_POLICY_TITLE,
    description: 'المرجع الموحد لعناصر حوكمة الذكاء الاصطناعي في المدرسة. يُرفع ملفها مرة واحدة، وتُربط أقسامها بالعناصر التي تغطيها.',
    version: '',
    versionNote: hasDraft ? `نص المسودة السابقة («${POLICY_TITLE}») محفوظ كما هو في عنصر «${main!.element}».` : '',
    status: docStatusFrom(main),
    url: main?.docUrl ?? '',
    files: [],
    sections: unifiedSectionTitles.map(([id, title]) => ({ id, title, text: '' })),
    history: [],
    stages: {
      // مسودة مكتوبة موجودة فعلًا، فالإعداد جارٍ؛ ولا تُعد أي مرحلة مكتملة تلقائيًا
      prepare: { status: hasDraft ? 'in_progress' : 'not_started', date: '', note: '' },
      review: { status: 'not_started', date: '', note: '' },
      approve: { status: 'not_started', date: '', note: '' },
      publish: { status: 'not_started', date: '', note: '' },
      apply: { status: 'not_started', date: '', note: '' },
      document: { status: 'not_started', date: '', note: '' },
    },
  }
}

/** ينشئ الوثيقة الموحدة إن لم توجد، ويربط بها العناصر غير المرتبطة. لا يحذف شيئًا ولا يغير حالة أي عنصر */
export function applyGovDocs(d: AppData): AppData {
  if (d.govDocs.length) return d
  const doc = createUnifiedDoc(d.policies)
  const policies = d.policies.map((p) => {
    const link = elementLinks[p.element]
    if (!link || p.docRef) return p
    const docRef: PolicyDocRef = {
      docId: doc.id,
      sectionIds: link.sections,
      coverage: '',
      coverageNote: '',
      tracksStages: !!link.stages,
    }
    return { ...p, docRef }
  })
  return { ...d, govDocs: [doc], policies }
}

// ===== الإصدار 11: ملف السياسة الفعلي (PDF) الذي أرسلته مسؤولة المبادرة في 25 أكتوبر 2026 =====
// العناوين منقولة حرفيًا من فهرس الملف، والموضع رقم الصفحة فيه. لا يُكتب هنا شيء من نص السياسة.

export const POLICY_FILE_ID = 'bundled-policy-v1-0'
export const REPORT_FILE_ID = 'bundled-policy-report-v1-0'

export const policyAttachment = {
  id: POLICY_FILE_ID,
  name: 'سياسة-حوكمة-الذكاء-الاصطناعي.pdf',
  type: 'application/pdf',
  size: 715052,
  addedAt: '2026-10-25T00:00:06.000Z',
}

export const reportAttachment = {
  id: REPORT_FILE_ID,
  name: 'تقرير-التحقق-والمطابقة.pdf',
  type: 'application/pdf',
  size: 293306,
  addedAt: '2026-10-25T00:00:06.000Z',
}

const policySections: [string, string, number][] = [
  ['p1', 'بيانات الوثيقة', 2],
  ['p2', 'المقدمة والمبررات', 4],
  ['p3', 'الغرض والأهداف', 4],
  ['p4', 'النطاق والفئات المشمولة', 4],
  ['p5', 'المبادئ الحاكمة للاستخدام المسؤول', 5],
  ['p6', 'المصطلحات والتعريفات', 5],
  ['p7', 'الأدوار والمسؤوليات والصلاحيات', 6],
  ['p8', 'ضوابط الاستخدام المقبول وغير المقبول', 7],
  ['p9', 'حماية الخصوصية والبيانات والمعلومات المدرسية', 7],
  ['p10', 'النزاهة الأكاديمية وضوابط استخدام الطالبات', 8],
  ['p11', 'ضوابط استخدام المعلمات في التخطيط والتدريس والتقويم', 9],
  ['p12', 'التحقق من المخرجات والإشراف البشري والعدالة', 9],
  ['p13', 'اختيار الأدوات الرقمية وضوابط استخدامها', 9],
  ['p14', 'الإبلاغ عن المخالفات والحوادث وآلية التعامل معها', 10],
  ['p15', 'التوعية والتدريب والتواصل مع المستفيدين', 11],
  ['p16', 'آلية التنفيذ والمتابعة وقياس الالتزام', 11],
  ['p17', 'مؤشرات الأداء والتحسين المستمر', 11],
  ['p18', 'آلية المراجعة والتحديث', 12],
  ['p19', 'الاعتماد والتوقيعات', 13],
  ['p20', 'الملاحق والنماذج التشغيلية (9 ملاحق)', 14],
]

/** ربط العناصر بأقسام الملف، والتغطية بعد قراءة نص الأقسام نفسها (لا تعني اعتمادًا ولا تطبيقًا) */
const policyLinks: Record<string, Omit<PolicyDocRef, 'docId' | 'tracksStages'>> = {
  'سياسة الاستخدام المسؤول للذكاء الاصطناعي': { sectionIds: ['p5', 'p8'], coverage: 'full', coverageNote: 'المبادئ وضوابط الاستخدام المقبول وغير المقبول (ص 5–7).' },
  'حماية البيانات والخصوصية': { sectionIds: ['p9'], coverage: 'full', coverageNote: 'القسم التاسع (ص 7).' },
  'النزاهة الأكاديمية': { sectionIds: ['p10'], coverage: 'full', coverageNote: 'القسم العاشر، مع بيان الإفصاح في الملحق 7.' },
  'التحقق من صحة المخرجات': { sectionIds: ['p12'], coverage: 'full', coverageNote: 'القسم الثاني عشر، مع قائمة التحقق في الملحق 6.' },
  'الإشراف البشري': { sectionIds: ['p7', 'p12'], coverage: 'full', coverageNote: 'الأدوار والصلاحيات، والإشراف البشري في القسم الثاني عشر.' },
  'أمن الحسابات والأجهزة': {
    sectionIds: ['p9', 'p13', 'p14'],
    coverage: 'partial',
    coverageNote: 'الحسابات المؤسسية ومنع إدخال كلمات المرور والإبلاغ عن الوصول غير المأذون واردة؛ ضوابط أمن الأجهزة نفسها غير مفصلة.',
  },
  'توعية المعلمات': { sectionIds: ['p11', 'p15'], coverage: 'full', coverageNote: 'القسم الخامس عشر، مع سجل التوعية في الملحق 3.' },
  'توعية الطالبات': { sectionIds: ['p10', 'p15'], coverage: 'full', coverageNote: 'القسم الخامس عشر، مع سجل التوعية في الملحق 3.' },
  'إجراءات مراجعة السياسات وتحديثها': { sectionIds: ['p16', 'p18'], coverage: 'full', coverageNote: 'القسم الثامن عشر، مع سجل المراجعة في الملحق 5.' },
  'إثباتات الاعتماد والنشر والتطبيق': {
    sectionIds: ['p19', 'p20'],
    coverage: '',
    coverageNote: 'صفحة الاعتماد والتوقيعات في الملف غير موقعة بعد، وسجل الأدلة (الملحق 9) فارغ.',
  },
}

/** يرفق ملف السياسة بالوثيقة الموحدة مرة واحدة، ما دامت بلا ملف ولا إصدار مسجل. لا يغير حالة الاعتماد */
export function applyPolicyFile(d: AppData): AppData {
  const doc = d.govDocs.find((g) => g.title === UNIFIED_POLICY_TITLE)
  if (!doc || doc.files.length || doc.version.trim()) return d
  const defaultSections = doc.sections.every((s) => /^s\d+$/.test(s.id))
  const next: GovernanceDoc = {
    ...doc,
    updatedAt: nowIso(),
    files: [policyAttachment],
    companionFiles: doc.companionFiles?.length ? doc.companionFiles : [reportAttachment],
    version: '1.0',
    versionNote: 'مسودة أولى للمراجعة والاعتماد، كما في صفحة بيانات الوثيقة. ' + doc.versionNote,
    sections: defaultSections ? policySections.map(([id, title, page]) => ({ id, title, text: `صفحة ${page}` })) : doc.sections,
    stages: {
      ...doc.stages,
      prepare:
        doc.stages.prepare.status === 'done'
          ? doc.stages.prepare
          : { status: 'done', date: doc.stages.prepare.date, note: 'الإصدار 1.0 مكتمل الإعداد ومرفوع؛ صفحة الاعتماد فيه غير موقعة بعد.' },
    },
  }
  const policies = d.policies.map((p) => {
    const r = p.docRef
    const link = policyLinks[p.element]
    if (!defaultSections || !link || !r || r.docId !== doc.id || r.coverage || r.coverageNote || r.sectionIds.some((s) => !/^s\d+$/.test(s))) return p
    return { ...p, docRef: { ...r, ...link } }
  })
  return { ...d, govDocs: d.govDocs.map((g) => (g.id === doc.id ? next : g)), policies }
}
