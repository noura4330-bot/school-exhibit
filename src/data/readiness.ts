// متطلبات الجاهزية لطلب Showcase School كما وردت في دليل التقديم الرسمي 2026–2027، وحالة كل متطلب من البيانات المسجلة فقط.
// كل متطلب يُحسب مرة واحدة، ونسبة الجاهزية = المكتمل ÷ عدد المتطلبات. لا شيء هنا يعني أهلية أو اعترافًا من Microsoft.
import type { AppData, RubricArea, Task } from './types'
import { evidenceFor, indicatorLevel, minimumCheck } from './selectors'

export type ReqStatus = 'done' | 'in_progress' | 'not_started' | 'review'

export type ReqAction = 'program' | 'pgArea' | 'addArea' | 'governance' | 'indicators'

export interface Requirement {
  key: string
  title: string
  /** سطر قصير يوضح المسجل أو المطلوب */
  hint: string
  status: ReqStatus
  action: ReqAction
  /** المتطلب منصوص عليه في دليل التقديم الرسمي، أو داعم داخلي */
  official: boolean
}

export const levelNum = (v: string) => {
  const n = Number(v)
  return v.trim() !== '' && Number.isFinite(n) ? n : null
}

const step = (v: string | undefined): ReqStatus => (v === 'done' ? 'done' : v === 'in_progress' ? 'in_progress' : 'not_started')

export function requirements(data: AppData): Requirement[] {
  const p = data.program
  const check = minimumCheck(data)
  const pg = data.areas.find((a) => a.isPolicyGovernance)
  const others = data.areas.filter((a) => !a.isPolicyGovernance)
  const othersLevel1 = others.filter((a) => (levelNum(a.selfLevel) ?? 0) >= 1)
  const doc = data.govDocs[0]
  const inds = data.indicators
  const lv = inds.map((i) => indicatorLevel(data, i))
  const withEv = inds.filter((i) => evidenceFor(data, { kind: 'indicator', id: i.id }).length > 0).length

  const pathfinder: ReqStatus =
    p.pathfinderStatus === 'joined' ? 'done' : p.pathfinderStatus === 'in_progress' ? 'in_progress' : p.pathfinderStatus === 'unknown' ? 'review' : 'not_started'

  const pgStatus: ReqStatus =
    check.pgLevel === null ? 'not_started' : check.pgLevel >= 2 ? (pg?.levelReviewed ? 'done' : 'review') : 'in_progress'

  const othersStatus: ReqStatus =
    othersLevel1.length >= 2 ? (othersLevel1.every((a) => a.levelReviewed) ? 'done' : 'review') : othersLevel1.length || others.length ? 'in_progress' : 'not_started'

  const govStatus: ReqStatus = !doc
    ? 'not_started'
    : doc.stages.approve.status === 'done'
      ? 'done'
      : doc.status === 'approved' || doc.status === 'published'
        ? 'review'
        : doc.stages.prepare.status === 'not_started'
          ? 'not_started'
          : 'in_progress'

  const indStatus: ReqStatus = !inds.length
    ? 'not_started'
    : lv.some((l) => l.needsAction)
      ? 'review'
      : lv.every((l) => l.level === 'done')
        ? 'done'
        : 'in_progress'

  const showcase: ReqStatus = p.showcaseStatus === 'submitted' || p.showcaseStatus === 'decision_received' ? 'done' : p.showcaseStatus === 'preparing' ? 'in_progress' : 'not_started'

  return [
    {
      key: 'pathfinder',
      title: 'حساب المدرسة والانضمام إلى Pathfinder',
      hint: p.pathfinderStatus === 'unknown' ? 'الحالة غير معروفة، تحققي منها وسجليها.' : p.pathfinderStatus === 'joined' ? 'منضمة، مع رابط الدليل.' : 'الخطوة الأولى في دليل التقديم.',
      status: pathfinder,
      action: 'program',
      official: true,
    },
    {
      key: 'pg',
      title: 'المستوى 2 في Policy and Governance',
      hint: check.pgName ? `المستوى المسجل: ${check.pgLevel ?? 'لم يُحدد'}${check.pgLevel !== null && !pg?.levelReviewed ? '، ولم يُراجع مقابل الشواهد' : ''}.` : 'لم يُعرَّف المجال بعد.',
      status: pgStatus,
      action: pg ? 'pgArea' : 'addArea',
      official: true,
    },
    {
      key: 'others',
      title: 'المستوى 1 في مجالين آخرين على الأقل',
      hint: others.length ? `مجالات بمستوى 1 أو أعلى: ${othersLevel1.length} من 2.` : 'لم تُضف مجالات أخرى من المقياس بعد.',
      status: othersStatus,
      action: 'addArea',
      official: true,
    },
    {
      key: 'policy',
      title: 'اعتماد سياسة الحوكمة والاستخدام المسؤول',
      hint: govStatus === 'done' ? 'معتمدة بشاهد.' : govStatus === 'review' ? 'مسجلة معتمدة دون إكمال مرحلة الاعتماد بشاهد.' : 'الوثيقة مسودة لم تُعتمد بعد.',
      status: govStatus,
      action: 'governance',
      official: false,
    },
    {
      key: 'indicators',
      title: 'مؤشرات المقياس الرسمي وشواهدها',
      hint: inds.length ? `${withEv} من ${inds.length} مؤشرًا مرتبط بشاهد.` : 'لم تُدخل مؤشرات المقياس بعد.',
      status: indStatus,
      action: 'indicators',
      official: true,
    },
    {
      key: 'questions',
      title: 'مسودة إجابات أسئلة نموذج Showcase',
      hint: 'تُنزل الأسئلة من الرابط الرسمي وتُصاغ الإجابات.',
      status: step(p.questionsStatus),
      action: 'program',
      official: true,
    },
    {
      key: 'template',
      title: 'Showcase Evidence Template (الشريحة 3) بصيغة PDF',
      hint: 'يوضح استيفاء المستوى المطلوب في المحور المختار.',
      status: step(p.templateStatus),
      action: 'program',
      official: true,
    },
    {
      key: 'submit',
      title: 'تقديم الطلب',
      hint: showcase === 'done' ? 'قُدِّم الطلب.' : 'نافذة 2026–2027 أُغلقت في 31 يوليو 2026، وموعد الدورة التالية يحتاج إلى تحقق.',
      status: showcase,
      action: 'program',
      official: true,
    },
  ]
}

/** هل سُجلت بيانات تكفي لحساب نسبة جاهزية ذات معنى؟ (مستوى مجال أو مؤشرات من المقياس) */
export const hasRubricData = (data: AppData) => data.indicators.length > 0 || data.areas.some((a) => levelNum(a.selfLevel) !== null)

/** المستوى المستهدف وفق الحد الأدنى في الدليل: 2 لمجال Policy and Governance، و1 لغيره من المجالات المستهدفة */
export const areaTarget = (a: RubricArea): number | null => (a.isPolicyGovernance ? 2 : a.targeted ? 1 : null)

export function areaStatus(data: AppData, a: RubricArea): ReqStatus {
  const lvl = levelNum(a.selfLevel)
  const t = areaTarget(a)
  const inds = data.indicators.filter((i) => i.areaId === a.id)
  if (lvl === null) return inds.length ? 'in_progress' : 'not_started'
  if (t !== null && lvl < t) return 'in_progress'
  if (!a.levelReviewed) return 'review'
  // المستوى محقق ومراجع؛ يكتمل المجال حين تكتمل مؤشراته المسجلة بشواهدها
  return inds.every((i) => indicatorLevel(data, i).level === 'done') ? 'done' : 'in_progress'
}

/* ===== أولوية المهام ===== */

const rank = { high: 0, medium: 1, low: 2 } as const

/** الأولوية المسجلة، وإلا تُقترح من المجال: الحوكمة والجاهزية أولًا لأنهما شرط التقديم */
export function taskPriority(t: Task): { value: 'high' | 'medium' | 'low'; auto: boolean } {
  if (t.priority) return { value: t.priority, auto: false }
  const value = t.area === 'governance' || t.area === 'readiness' ? 'high' : t.area === 'evidence' || t.area === 'impact' ? 'medium' : 'low'
  return { value, auto: true }
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      rank[taskPriority(a).value] - rank[taskPriority(b).value] || (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title, 'ar'),
  )
}
