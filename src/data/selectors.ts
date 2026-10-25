// حسابات مشتقة من البيانات المسجلة فعلًا: الاكتمال، والمؤشرات، والنواقص.
import type { AppData, Evidence, Indicator, PolicyItem, Practice, Ref, RefKind, StudentProject, Workshop } from './types'
import type { Option } from './options'
import { isFilled, normalizeArabic, todayIso } from '../lib/util'

export type DocState = 'none' | 'partial' | 'complete'

export const docStateLabels: Record<DocState, string> = {
  none: 'لم يبدأ التوثيق',
  partial: 'توثيق ناقص',
  complete: 'موثق',
}

export const docStateTone = { none: 'neutral', partial: 'warning', complete: 'success' } as const

export interface Completeness {
  filled: number
  total: number
  missing: string[]
  pct: number
}

function measure(record: object, fields: [string, string][]): Completeness {
  const r = record as Record<string, unknown>
  const missing = fields.filter(([k]) => !isFilled(r[k])).map(([, label]) => label)
  const total = fields.length
  const filled = total - missing.length
  return { filled, total, missing, pct: total ? Math.round((filled / total) * 100) : 0 }
}

export const workshopKeyFields: [string, string][] = [
  ['title', 'العنوان'],
  ['description', 'الوصف'],
  ['objectives', 'الأهداف'],
  ['date', 'التاريخ'],
  ['presenter', 'المنفذة'],
  ['audience', 'الفئة المستهدفة'],
  ['participants', 'عدد المشاركات'],
  ['attendance', 'سجل الحضور'],
  ['skills', 'المهارات المكتسبة'],
  ['measureTool', 'أداة قياس الاستفادة'],
  ['results', 'النتائج'],
  ['finalReport', 'التقرير الختامي'],
]

export const practiceKeyFields: [string, string][] = [
  ['subject', 'المادة'],
  ['stage', 'المرحلة'],
  ['objective', 'الهدف التعليمي'],
  ['need', 'المشكلة أو الحاجة'],
  ['strategy', 'الاستراتيجية'],
  ['tool', 'الأداة'],
  ['implementation', 'وصف التنفيذ'],
  ['teacherRole', 'دور المعلمة'],
  ['studentRole', 'دور الطالبات'],
  ['outcome', 'ناتج التعلم'],
  ['assessment', 'أداة التقويم'],
  ['results', 'النتائج الفعلية'],
]

export const projectKeyFields: [string, string][] = [
  ['problem', 'وصف المشكلة'],
  ['idea', 'الفكرة'],
  ['solution', 'الحل'],
  ['tools', 'الأدوات'],
  ['steps', 'خطوات التصميم والتنفيذ'],
  ['testing', 'الاختبار والتحسين'],
  ['finalProduct', 'الناتج النهائي'],
  ['successCriteria', 'معايير النجاح'],
  ['evaluation', 'تقويم المشروع'],
]

export const evidenceKeyFields: [string, string][] = [
  ['title', 'العنوان'],
  ['description', 'الوصف'],
  ['executedOn', 'تاريخ التنفيذ'],
  ['source', 'المصدر'],
  ['domain', 'المجال'],
  ['owner', 'المسؤول'],
  ['proves', 'ما الذي يثبته'],
  ['howLinked', 'كيف يرتبط بالمؤشر'],
  ['visibleProof', 'الدليل الظاهر داخله'],
  ['hasPersonalData', 'هل يحتوي بيانات شخصية'],
]

export const evidenceFor = (data: AppData, ref: Ref): Evidence[] =>
  data.evidence.filter((e) => e.links.some((l) => l.kind === ref.kind && l.id === ref.id))

function docState(c: Completeness, evidenceCount: number): DocState {
  if (c.filled === 0 && evidenceCount === 0) return 'none'
  if (c.missing.length === 0 && evidenceCount > 0) return 'complete'
  return 'partial'
}

export function workshopDoc(data: AppData, w: Workshop) {
  const c = measure(w, workshopKeyFields)
  const ev = evidenceFor(data, { kind: 'workshop', id: w.id }).length
  return { ...c, evidence: ev, state: docState(c, ev) }
}

export function practiceDoc(data: AppData, p: Practice) {
  const c = measure(p, practiceKeyFields)
  const ev = evidenceFor(data, { kind: 'practice', id: p.id }).length
  return { ...c, evidence: ev, state: docState(c, ev) }
}

export function projectDoc(data: AppData, p: StudentProject) {
  const c = measure(p, projectKeyFields)
  const ev = evidenceFor(data, { kind: 'project', id: p.id }).length
  return { ...c, evidence: ev, state: docState(c, ev) }
}

export const hasSource = (e: Evidence) => e.files.length > 0 || isFilled(e.url)

export function evidenceCompleteness(e: Evidence): Completeness {
  const c = measure(e, evidenceKeyFields)
  if (!hasSource(e)) {
    c.missing.unshift('الملف أو الرابط')
    c.total += 1
    c.pct = Math.round((c.filled / c.total) * 100)
  } else {
    c.filled += 1
    c.total += 1
    c.pct = Math.round((c.filled / c.total) * 100)
  }
  return c
}

/** مجموعات الشواهد المحتمل تكرارها: نفس العنوان، أو نفس الرابط، أو نفس الملف */
export function duplicateGroups(evidence: Evidence[]): Evidence[][] {
  const groups = new Map<string, Evidence[]>()
  const add = (key: string, e: Evidence) => {
    const g = groups.get(key) ?? []
    if (!g.includes(e)) g.push(e)
    groups.set(key, g)
  }
  for (const e of evidence) {
    if (e.title.trim()) add(`t:${normalizeArabic(e.title)}`, e)
    if (e.url.trim()) add(`u:${e.url.trim().replace(/\/+$/, '').toLowerCase()}`, e)
    for (const f of e.files) add(`f:${f.name}:${f.size}`, e)
  }
  const seen = new Set<string>()
  const result: Evidence[][] = []
  for (const g of groups.values()) {
    if (g.length < 2) continue
    const key = g.map((e) => e.id).sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(g)
  }
  return result
}

export const duplicateIds = (evidence: Evidence[]): Set<string> =>
  new Set(duplicateGroups(evidence).flat().map((e) => e.id))

export interface Kpis {
  activitiesDone: number
  workshopsDone: number
  evidenceDocumented: number
  documentedProjects: number
  indicatorsComplete: number
  indicatorsPending: number
  indicatorsTotal: number
}

export function computeKpis(data: AppData): Kpis {
  const today = todayIso()
  const practicesDone = data.practices.filter((p) => practiceDoc(data, p).state === 'complete').length
  const projectsDone = data.projects.filter((p) => projectDoc(data, p).state === 'complete').length
  const complete = data.indicators.filter((i) => i.status === 'internally_complete').length
  return {
    activitiesDone: data.activities.filter((a) => a.status === 'implemented').length,
    workshopsDone: data.workshops.filter((w) => w.date && w.date <= today).length,
    evidenceDocumented: data.evidence.filter(hasSource).length,
    documentedProjects: practicesDone + projectsDone,
    indicatorsComplete: complete,
    indicatorsPending: data.indicators.length - complete,
    indicatorsTotal: data.indicators.length,
  }
}

export const refKindLabels: Record<RefKind, string> = {
  activity: 'نشاط',
  policy: 'عنصر حوكمة',
  workshop: 'ورشة',
  practice: 'ممارسة تعليمية',
  project: 'مشروع طالبات',
  indicator: 'مؤشر جاهزية',
  impact: 'مؤشر أثر',
  task: 'مهمة',
  govdoc: 'وثيقة حوكمة',
}

export const refRoutes: Record<RefKind, string> = {
  activity: 'initiative',
  policy: 'governance',
  workshop: 'professional',
  practice: 'teaching',
  project: 'projects',
  indicator: 'readiness',
  impact: 'impact',
  task: 'initiative',
  govdoc: 'governance',
}

export function refTitle(data: AppData, ref: Ref): string | null {
  switch (ref.kind) {
    case 'activity':
      return data.activities.find((x) => x.id === ref.id)?.title ?? null
    case 'policy': {
      const p = data.policies.find((x) => x.id === ref.id)
      return p ? p.docName || p.element : null
    }
    case 'workshop':
      return data.workshops.find((x) => x.id === ref.id)?.title ?? null
    case 'practice':
      return data.practices.find((x) => x.id === ref.id)?.title ?? null
    case 'project':
      return data.projects.find((x) => x.id === ref.id)?.title ?? null
    case 'indicator': {
      const i = data.indicators.find((x) => x.id === ref.id)
      return i ? [i.code, i.text].filter(Boolean).join(' — ') : null
    }
    case 'impact':
      return data.impact.find((x) => x.id === ref.id)?.title ?? null
    case 'task':
      return data.tasks.find((x) => x.id === ref.id)?.title ?? null
    case 'govdoc':
      return data.govDocs.find((x) => x.id === ref.id)?.title ?? null
  }
}

/** كل العناصر التي يمكن ربط شاهد بها */
export function linkableRefs(data: AppData): { ref: Ref; title: string; group: string }[] {
  const out: { ref: Ref; title: string; group: string }[] = []
  const push = (kind: RefKind, id: string) => {
    const title = refTitle(data, { kind, id })
    if (title) out.push({ ref: { kind, id }, title, group: refKindLabels[kind] })
  }
  data.indicators.forEach((x) => push('indicator', x.id))
  data.impact.forEach((x) => push('impact', x.id))
  data.govDocs.forEach((x) => push('govdoc', x.id))
  data.policies.forEach((x) => push('policy', x.id))
  data.activities.forEach((x) => push('activity', x.id))
  data.workshops.forEach((x) => push('workshop', x.id))
  data.practices.forEach((x) => push('practice', x.id))
  data.projects.forEach((x) => push('project', x.id))
  return out
}

export interface Alert {
  id: string
  tone: 'warning' | 'danger'
  text: string
  route: string
}

/** تنبيهات الأدلة الناقصة والمخاطر */
export function computeAlerts(data: AppData): Alert[] {
  const alerts: Alert[] = []
  for (const p of data.policies) {
    if ((p.status === 'approved' || p.status === 'applied') && evidenceFor(data, { kind: 'policy', id: p.id }).length === 0) {
      alerts.push({
        id: `pol-${p.id}`,
        tone: 'danger',
        text: `«${p.docName || p.element}» مسجل بحالة ${p.status === 'applied' ? 'مطبق' : 'معتمد'} دون شاهد مرتبط.`,
        route: 'governance',
      })
    }
  }
  for (const i of data.indicators) {
    if (evidenceFor(data, { kind: 'indicator', id: i.id }).length === 0) {
      alerts.push({ id: `ind-${i.id}`, tone: 'warning', text: `المؤشر «${i.code || i.text}» لا يرتبط به أي شاهد.`, route: 'readiness' })
    }
  }
  for (const e of data.evidence) {
    if (!hasSource(e)) {
      alerts.push({ id: `evs-${e.id}`, tone: 'warning', text: `الشاهد «${e.title}» بلا ملف أو رابط.`, route: 'evidence' })
    } else if (e.needsCompletion === 'yes' || e.reviewStatus === 'needs_completion') {
      alerts.push({ id: `evc-${e.id}`, tone: 'warning', text: `الشاهد «${e.title}» يحتاج إلى استكمال.`, route: 'evidence' })
    }
    if (e.hasPersonalData === 'yes' && e.sensitivity === 'public') {
      alerts.push({
        id: `evp-${e.id}`,
        tone: 'danger',
        text: `الشاهد «${e.title}» يحتوي بيانات شخصية لكنه مصنف «عام».`,
        route: 'evidence',
      })
    }
  }
  for (const p of data.projects) {
    if (p.photos.length > 0 && p.consent !== 'full') {
      alerts.push({ id: `prj-${p.id}`, tone: 'danger', text: `صور مشروع «${p.title}» مخفية لعدم اكتمال موافقات النشر.`, route: 'projects' })
    }
  }
  for (const w of data.workshops) {
    if (w.date && w.date <= todayIso() && w.attendance.length === 0) {
      alerts.push({ id: `ws-${w.id}`, tone: 'warning', text: `ورشة «${w.title}» بلا سجل حضور مرفق.`, route: 'professional' })
    }
  }

  // نواقص عامة في البيانات المطلوبة للتوثيق، تأتي بعد التنبيهات الخاصة بسجلات بعينها
  const ini = data.initiative
  const missingIni = (
    [
      ['rationale', 'مبررات المبادرة'],
      ['problem', 'المشكلة التي تعالجها'],
      ['baseline', 'خط الأساس'],
      ['target', 'المستهدف'],
    ] as const
  )
    .filter(([k]) => !ini[k].trim())
    .map(([, label]) => label)
  if (missingIni.length)
    alerts.push({ id: 'gap-ini', tone: 'warning', text: `ملف المبادرة ينقصه: ${missingIni.join('، ')}.`, route: 'initiative' })
  const unstarted = data.policies.filter((p) => p.status === 'not_started').length
  if (unstarted)
    alerts.push({
      id: 'gap-pol',
      tone: 'warning',
      text: `${unstarted} من ${data.policies.length} عناصر حوكمة لم يبدأ توثيقها${
        data.policies.some((p) => p.status === 'not_started' && p.element.includes('سياسة الاستخدام المسؤول'))
          ? '، ومنها سياسة الاستخدام المسؤول المطلوبة لمستوى Policy and Governance'
          : ''
      }.`,
      route: 'governance',
    })
  if (data.evidence.length === 0)
    alerts.push({ id: 'gap-ev', tone: 'warning', text: 'لم يُسجل أي شاهد بعد. أضيفي الشواهد واربطيها بالأنشطة والمؤشرات.', route: 'evidence' })
  if (data.workshops.length === 0)
    alerts.push({ id: 'gap-ws', tone: 'warning', text: 'لم تُسجل ورش تدريب للمعلمات بعد، مع خطتها وسجلات حضورها.', route: 'professional' })
  if (data.practices.filter((p) => !p.isTemplate).length === 0)
    alerts.push({ id: 'gap-pr', tone: 'warning', text: 'لم تُوثق ممارسات صفية بعد.', route: 'teaching' })
  if (data.indicators.length === 0)
    alerts.push({
      id: 'gap-ind',
      tone: 'warning',
      text: 'لم تُدخل مؤشرات المقياس الرسمي (AI Transformation Rubric) بعد، فلا يمكن ربط الشواهد بها.',
      route: 'readiness',
    })
  const pg = data.areas.find((a) => a.isPolicyGovernance)
  if (pg && !pg.selfLevel.trim())
    alerts.push({
      id: 'gap-pg',
      tone: 'warning',
      text: 'لم يُحدد مستوى التقييم الذاتي لمجال Policy and Governance، ويتطلب مؤشرات المقياس الرسمي ومراجعة الشواهد.',
      route: 'readiness',
    })
  if (data.impact.length === 0)
    alerts.push({ id: 'gap-imp', tone: 'warning', text: 'لم تُسجل مؤشرات قياس الأثر بخط أساس ومستهدف.', route: 'impact' })
  else {
    const noBase = data.impact.filter((m) => !m.baseline.trim()).length
    if (noBase)
      alerts.push({
        id: 'gap-imp',
        tone: 'warning',
        text: `مؤشرات أثر بلا خط أساس مقيس: ${noBase} من ${data.impact.length}. يلزم قياس أولي قبل بدء التنفيذ.`,
        route: 'impact',
      })
  }
  const drafts = data.policies.filter((p) => p.status === 'drafting' || p.status === 'awaiting_review').length
  if (drafts)
    alerts.push({
      id: 'gap-draft',
      tone: 'warning',
      text: `عناصر حوكمة بحالة مسودة غير معتمدة: ${drafts}. تنتظر المراجعة والاعتماد من الجهة المخولة في المدرسة.`,
      route: 'governance',
    })
  return alerts
}

/** فحص الحد الأدنى الوارد في دليل التقديم مقابل التقييم الذاتي المسجل فقط */
export function minimumCheck(data: AppData) {
  const levelOf = (v: string) => {
    const n = Number(v)
    return Number.isFinite(n) && v.trim() !== '' ? n : null
  }
  const pg = data.areas.find((a) => a.isPolicyGovernance)
  const pgLevel = pg ? levelOf(pg.selfLevel) : null
  const others = data.areas.filter((a) => !a.isPolicyGovernance && (levelOf(a.selfLevel) ?? 0) >= 1)
  return {
    pgName: pg?.name ?? null,
    pgLevel,
    pgMet: pgLevel !== null && pgLevel >= 2,
    othersMet: others.length,
    othersOk: others.length >= 2,
    allReviewed: data.areas.every((a) => a.levelReviewed),
  }
}

/** الحالة الموحدة بثلاث درجات للعرض. لا تُعد أي حالة «مكتملة» دون شاهد مرتبط يثبتها */
export type Level3 = 'not_started' | 'in_progress' | 'done'

export const level3Options: Option[] = [
  { value: 'not_started', label: 'لم يبدأ', tone: 'neutral' },
  { value: 'in_progress', label: 'قيد التنفيذ', tone: 'brand' },
  { value: 'done', label: 'مكتمل', tone: 'success' },
]

export interface Level3State {
  level: Level3
  /** الحالة التفصيلية المسجلة، أو سبب عدم عدّها مكتملة */
  detail: string
  /** يحتاج إلى إجراء: شاهد ناقص أو تحسين مطلوب */
  needsAction: boolean
}

export function policyLevel(data: AppData, p: PolicyItem): Level3State {
  const ev = evidenceFor(data, { kind: 'policy', id: p.id }).length
  if (p.status === 'not_started') return { level: 'not_started', detail: '', needsAction: false }
  if ((p.status === 'approved' || p.status === 'applied') && ev > 0) return { level: 'done', detail: p.status === 'applied' ? 'مطبق بشاهد' : 'معتمد بشاهد', needsAction: false }
  if (p.status === 'approved' || p.status === 'applied') return { level: 'in_progress', detail: 'مسجل معتمدًا دون شاهد', needsAction: true }
  return { level: 'in_progress', detail: p.status === 'awaiting_review' ? 'بانتظار المراجعة' : 'مسودة', needsAction: false }
}

export function indicatorLevel(data: AppData, i: Indicator): Level3State {
  const ev = evidenceFor(data, { kind: 'indicator', id: i.id }).length
  if (i.status === 'internally_complete' && ev > 0) return { level: 'done', detail: '', needsAction: false }
  if (i.status === 'internally_complete') return { level: 'in_progress', detail: 'مسجل مكتملًا دون شاهد', needsAction: true }
  if (i.status === 'not_started' || i.status === 'not_reviewed') return { level: 'not_started', detail: i.status === 'not_reviewed' ? 'لم تتم المراجعة' : '', needsAction: false }
  if (i.status === 'needs_improvement') return { level: 'in_progress', detail: 'يحتاج إلى تحسين', needsAction: true }
  const detail = i.status === 'evidence_ready' ? 'الشاهد جاهز' : i.status === 'awaiting_review' ? 'بانتظار المراجعة' : ''
  return { level: 'in_progress', detail, needsAction: ev === 0 }
}
