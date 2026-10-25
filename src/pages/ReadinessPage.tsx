import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AddRegular, ArrowDownloadRegular, ArrowUploadRegular, ChevronDownRegular, EditRegular, PrintRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { Activity, Correspondence, Indicator, ProgramStatus, RubricArea, Task } from '../data/types'
import {
  approvalStages,
  correspondenceDirections,
  govDocStatuses,
  stageStatuses,
  indicatorStatuses,
  labelOf,
  pathfinderStatuses,
  reqStatuses,
  showcaseStatuses,
  taskPriorities,
  taskStatuses,
  toneOf,
} from '../data/options'
import { computeAlerts, evidenceFor, indicatorLevel, level3Options, policyLevel } from '../data/selectors'
import { areaStatus, areaTarget, hasRubricData, levelNum, requirements, sortTasks, taskPriority, type ReqStatus, type Requirement } from '../data/readiness'
import { Badge, ExtLink, PageHeader, StatusBadge, Value } from '../components/ui'
import { More, parseStages, stageProgress } from '../components/InitiativeSections'
import { Drawer, useFeedback } from '../components/feedback'
import { FormFields, validateFields, type Errors, type FieldDef } from '../components/form'
import { RecordCollection, useCrud, type EditorConfig } from '../components/records'
import { taskConfig } from '../components/taskConfig'
import { SelectFilter } from '../components/filters'
import { href, navigate, useRoute } from '../lib/router'
import { downloadBlob, formatDate, formatNumber, isValidUrl, parseCsv, toCsv, todayIso } from '../lib/util'

const areaFields: FieldDef[] = [
  { key: 'name', label: 'اسم المجال كما ورد في المقياس الرسمي', type: 'text', required: true, full: true },
  { key: 'isPolicyGovernance', label: 'هذا مجال Policy and Governance', type: 'checkbox', full: true },
  { key: 'targeted', label: 'مجال مستهدف في طلب المدرسة', type: 'checkbox', full: true },
  {
    key: 'selfLevel',
    label: 'المستوى وفق التقييم الذاتي',
    type: 'number',
    hint: 'تقدير داخلي للمدرسة، ولا يُعد حكمًا رسميًا.',
  },
  { key: 'levelReviewed', label: 'تمت مراجعة المستوى داخليًا مقابل الشواهد', type: 'checkbox' },
  { key: 'source', label: 'مصدر المجال (رابط النسخة الرسمية)', type: 'url', full: true },
  { key: 'sourceReviewedAt', label: 'تاريخ مراجعة المصدر', type: 'date' },
  { key: 'notes', label: 'ملاحظات', type: 'textarea', rows: 2 },
]


const corrFields: FieldDef[] = [
  { key: 'subject', label: 'الموضوع', type: 'text', required: true, full: true },
  { key: 'date', label: 'التاريخ', type: 'date', required: true },
  { key: 'direction', label: 'النوع', type: 'select', options: correspondenceDirections, required: true },
  { key: 'party', label: 'الجهة', type: 'text' },
  { key: 'url', label: 'رابط المراسلة أو نسخة منها', type: 'url', full: true },
  { key: 'summary', label: 'ملخص المراسلة', type: 'textarea' },
]

const stepStatuses = [
  { value: 'not_started', label: 'لم يبدأ' },
  { value: 'in_progress', label: 'قيد الإعداد' },
  { value: 'done', label: 'مكتمل' },
]

const programFields: FieldDef[] = [
  { key: 'pathfinderStatus', label: 'حالة الانضمام إلى Pathfinder', type: 'select', options: pathfinderStatuses, required: true },
  {
    key: 'pathfinderEvidence',
    label: 'دليل الانضمام (رابط)',
    type: 'url',
    validate: (v, r) => (r.pathfinderStatus === 'joined' && !v ? 'أضيفي رابط دليل الانضمام قبل تسجيل الحالة «منضمة».' : null),
  },
  { key: 'questionsStatus', label: 'مسودة إجابات أسئلة نموذج Showcase', type: 'select', options: stepStatuses },
  { key: 'templateStatus', label: 'Showcase Evidence Template (الشريحة 3) مصدّرًا PDF', type: 'select', options: stepStatuses },
  { key: 'showcaseStatus', label: 'حالة طلب Showcase', type: 'select', options: showcaseStatuses, required: true },
  {
    key: 'submissionDate',
    label: 'تاريخ التقديم',
    type: 'date',
    validate: (v, r) => {
      if (r.showcaseStatus === 'submitted' && !v) return 'حددي تاريخ التقديم.'
      if (typeof v === 'string' && v > todayIso()) return 'تاريخ التقديم لا يكون في المستقبل.'
      return null
    },
  },
]

const recognitionFields: FieldDef[] = [
  {
    key: 'recognitionStatus',
    label: 'حالة الاعتراف الرسمي',
    type: 'select',
    required: true,
    options: [
      { value: 'none', label: 'لا يوجد اعتراف رسمي مسجل' },
      { value: 'recorded', label: 'اعتراف رسمي موثق بدليل' },
    ],
  },
  {
    key: 'recognitionDate',
    label: 'تاريخ الإشعار الرسمي',
    type: 'date',
    validate: (v, r) => (r.recognitionStatus === 'recorded' && !v ? 'التاريخ مطلوب لتسجيل الاعتراف.' : null),
  },
  {
    key: 'recognitionEvidenceUrl',
    label: 'رابط الدليل الرسمي (خطاب أو بريد أو صفحة رسمية)',
    type: 'url',
    full: true,
    validate: (v, r) => (r.recognitionStatus === 'recorded' && !v ? 'لا يمكن تسجيل الاعتراف دون دليل رسمي.' : null),
  },
  { key: 'recognitionNote', label: 'ملاحظات', type: 'textarea', rows: 2 },
]

function ProgramEditor({ fields, title, onClose }: { fields: FieldDef[]; title: string; onClose: () => void }) {
  const { data, setProgram } = useStore()
  const { toast } = useFeedback()
  const [draft, setDraft] = useState<ProgramStatus>(data.program)
  const [errors, setErrors] = useState<Errors>({})
  const save = () => {
    const errs = validateFields(fields, draft as unknown as Record<string, unknown>)
    if (Object.keys(errs).length) {
      setErrors(errs)
      toast('تعذر الحفظ. راجعي الحقول.', 'error')
      return
    }
    setProgram(draft)
    toast('تم الحفظ.')
    onClose()
  }
  return (
    <Drawer
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn primary" onClick={save}>
            حفظ
          </button>
        </>
      }
    >
      <FormFields fields={fields} value={draft as unknown as Record<string, unknown>} errors={errors} onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} />
    </Drawer>
  )
}

const CSV_HEADERS = ['المجال', 'الرمز', 'نص المؤشر', 'المستوى', 'المصدر']

export default function ReadinessPage() {
  const { data, upsert } = useStore()
  const { toast, confirm } = useFeedback()
  const [editProgram, setEditProgram] = useState<null | 'program' | 'recognition'>(null)
  const [areaFilter, setAreaFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const p = data.program
  const links = data.settings.links
  const rubricLink = links.find((l) => /rubric/i.test(l.url + l.title))
  const areaOptions = data.areas.map((a) => ({ value: a.id, label: a.name }))

  const indicatorFields: FieldDef[] = [
    { key: 'areaId', label: 'المجال', type: 'select', options: areaOptions, required: true },
    { key: 'code', label: 'رمز المؤشر', type: 'text', hint: 'كما ورد في المقياس الرسمي إن وجد.' },
    { key: 'text', label: 'نص المؤشر أو المتطلب (من النسخة الرسمية)', type: 'textarea', required: true },
    { key: 'level', label: 'المستوى المرتبط', type: 'text' },
    {
      key: 'status',
      label: 'الحالة',
      type: 'select',
      options: indicatorStatuses,
      required: true,
      hint: '«مكتمل داخليًا» يعني مراجعة داخلية فقط، وليس استيفاءً رسميًا.',
    },
    { key: 'source', label: 'المصدر (رابط النسخة الرسمية)', type: 'url', required: true, full: true },
    { key: 'sourceReviewedAt', label: 'تاريخ مراجعة المصدر', type: 'date', required: true },
    { key: 'gap', label: 'النواقص', type: 'textarea', rows: 2 },
    { key: 'notes', label: 'ملاحظات', type: 'textarea', rows: 2 },
  ]

  const indicatorConfig: EditorConfig<Indicator> = {
    title: 'مؤشر',
    fields: indicatorFields,
    linkKind: 'indicator',
    linkLabel: 'الشواهد الداعمة',
    extraValidate: (d, ev): Errors => {
      if ((d.status === 'evidence_ready' || d.status === 'internally_complete' || d.status === 'awaiting_review') && ev.length === 0)
        return { _links: 'هذه الحالة تتطلب ربط شاهد واحد على الأقل.' }
      return {}
    },
  }

  const indCrud = useCrud<Indicator>('indicators', indicatorConfig, (i) => [i.code, i.text].filter(Boolean).join(' — '))
  const areaCrud = useCrud<RubricArea>('areas', { title: 'مجال', fields: areaFields }, (a) => a.name)
  const taskCrud = useCrud<Task>('tasks', taskConfig, (t) => t.title)
  const corrCrud = useCrud<Correspondence>('correspondence', { title: 'مراسلة', fields: corrFields }, (c) => c.subject)

  /* ===== الحسابات: كلها من البيانات المسجلة ===== */
  const reqs = requirements(data)
  const nReq = (s: ReqStatus) => reqs.filter((r) => r.status === s).length
  const doneReq = nReq('done')
  const readyPct = Math.round((doneReq / reqs.length) * 100)
  const enoughData = hasRubricData(data)

  const total = data.indicators.length
  const lv = new Map(data.indicators.map((i) => [i.id, indicatorLevel(data, i)]))
  const indDone = data.indicators.filter((i) => lv.get(i.id)!.level === 'done').length
  const evCount = (i: Indicator) => evidenceFor(data, { kind: 'indicator', id: i.id }).length
  const indicators = data.indicators.filter((i) => (!areaFilter || i.areaId === areaFilter) && (!statusFilter || i.status === statusFilter))
  const gaps = data.indicators.filter((i) => evCount(i) === 0 || i.status === 'needs_improvement' || i.status === 'not_started' || i.gap.trim())
  const emptyAreas = data.areas.filter((a) => !data.indicators.some((i) => i.areaId === a.id))
  // تنبيهات الأدلة مدمجة في النواقص؛ تنبيه «مؤشر بلا شاهد» مكرر مع النواقص فيُستبعد
  const alerts = computeAlerts(data)
    .filter((a) => !a.id.startsWith('ind-'))
    .sort((a, b) => Number(b.tone === 'danger') - Number(a.tone === 'danger'))
  const gapCount = emptyAreas.length + gaps.length + alerts.length

  const openTasks = sortTasks(data.tasks.filter((t) => t.status !== 'done'))
  const TOP = 6

  // المراجع: روابط الإعدادات دون تكرار، وبلا روابط التصميم التي لا تخص التقديم
  const refs = links.filter((l, i) => links.findIndex((x) => x.url.trim() === l.url.trim()) === i && !/fluent/i.test(l.url + l.title))

  const newIndicator = (): Indicator => ({
    ...makeBase(),
    areaId: areaFilter || data.areas[0]?.id || '',
    code: '',
    text: '',
    level: '',
    status: 'not_reviewed',
    source: rubricLink?.url ?? '',
    sourceReviewedAt: '',
    gap: '',
    notes: '',
  })
  const newArea = (): RubricArea => ({
    ...makeBase(),
    name: '',
    isPolicyGovernance: false,
    targeted: true,
    selfLevel: '',
    levelReviewed: false,
    source: rubricLink?.url ?? '',
    sourceReviewedAt: '',
    notes: '',
  })
  const newTask = (): Task => ({ ...makeBase(), title: '', area: 'readiness', owner: '', due: '', status: 'not_started', notes: '', priority: '' })
  const newCorr = (): Correspondence => ({ ...makeBase(), date: todayIso(), direction: 'outgoing', party: '', subject: '', summary: '', url: '' })

  const runAction = (r: Requirement) => {
    if (r.action === 'program') return setEditProgram('program')
    if (r.action === 'pgArea') {
      const pg = data.areas.find((a) => a.isPolicyGovernance)
      return pg ? areaCrud.openEdit(pg) : areaCrud.openNew({ ...newArea(), isPolicyGovernance: true })
    }
    if (r.action === 'addArea') return areaCrud.openNew(newArea())
    if (r.action === 'governance') return navigate('governance', 'manage')
    if (r.action === 'indicators') return data.areas.length ? indCrud.openNew(newIndicator()) : areaCrud.openNew(newArea())
  }

  const importCsv = async (file: File) => {
    try {
      const rows = parseCsv(await file.text())
      if (rows.length < 2) throw new Error('الملف فارغ أو بلا صفوف بيانات.')
      const [head, ...body] = rows
      const idx = (name: string) => head.findIndex((h) => h.trim() === name)
      const ai = idx('المجال')
      const ti = idx('نص المؤشر')
      if (ai < 0 || ti < 0) throw new Error('يجب أن يحتوي الملف على عمودي «المجال» و«نص المؤشر». نزّلي القالب للاطلاع على الصيغة.')
      const ci = idx('الرمز')
      const li = idx('المستوى')
      const si = idx('المصدر')
      const valid = body.filter((r) => r[ai]?.trim() && r[ti]?.trim())
      const ok = await confirm({
        title: 'استيراد المؤشرات؟',
        body: `سيُضاف ${valid.length} مؤشر بحالة «لم تتم المراجعة». تأكدي أن الملف منقول من النسخة الرسمية للمقياس.`,
        confirmLabel: 'استيراد',
      })
      if (!ok) return
      const areaIds = new Map(data.areas.map((a) => [a.name.trim(), a.id]))
      const today = todayIso()
      for (const r of valid) {
        const name = r[ai].trim()
        let areaId = areaIds.get(name)
        if (!areaId) {
          const area: RubricArea = { ...newArea(), name, isPolicyGovernance: /policy/i.test(name), sourceReviewedAt: today, notes: 'أُنشئ عند استيراد ملف مؤشرات.' }
          upsert('areas', area)
          areaIds.set(name, area.id)
          areaId = area.id
        }
        const src = si >= 0 && isValidUrl(r[si]?.trim() ?? '') ? r[si].trim() : rubricLink?.url ?? ''
        upsert('indicators', {
          ...newIndicator(),
          areaId,
          code: ci >= 0 ? r[ci]?.trim() ?? '' : '',
          text: r[ti].trim(),
          level: li >= 0 ? r[li]?.trim() ?? '' : '',
          source: src,
          sourceReviewedAt: today,
        })
      }
      toast(`تم استيراد ${valid.length} مؤشر.`)
    } catch (e) {
      toast(`تعذر الاستيراد: ${(e as Error).message}`, 'error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const taskRow = (t: Task) => {
    const pr = taskPriority(t)
    const late = t.due && t.due < todayIso()
    return (
      <li key={t.id}>
        <button type="button" className="link-btn rd-task-title" onClick={() => taskCrud.openView(t)}>
          {t.title}
        </button>
        <span className="rd-task-meta">
          <Badge tone={toneOf(taskPriorities, pr.value)}>
            {labelOf(taskPriorities, pr.value)}
            {pr.auto && <span className="sr-only"> (مقترحة من المجال)</span>}
          </Badge>
          <select
            className="select rd-status"
            aria-label={`حالة المهمة: ${t.title}`}
            value={t.status}
            onChange={(e) => {
              upsert('tasks', { ...t, status: e.target.value as Task['status'] })
              toast('تم تحديث الحالة.')
            }}
          >
            {taskStatuses.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className={`nowrap caption${late ? ' warn' : ''}`}>{t.due ? `${formatDate(t.due)}${late ? ' · متأخرة' : ''}` : 'بلا موعد'}</span>
          <button className="btn subtle small icon no-print" aria-label={`تعديل ${t.title}`} title="تعديل" onClick={() => taskCrud.openEdit(t)}>
            <EditRegular />
          </button>
        </span>
      </li>
    )
  }

  /* ===== أقسام اللوحة ===== */
  const planStages = parseStages(data.initiative, data.activities).stages
  const actDocumented = (a: Activity) => evidenceFor(data, { kind: 'activity', id: a.id }).length > 0
  const tasksDone = data.tasks.filter((t) => t.status === 'done').length
  const doc = data.govDocs[0]
  const provenPolicies = data.policies.filter((x) => policyLevel(data, x).level === 'done').length
  const nextReqs = [...reqs]
    .filter((r) => r.status !== 'done')
    .sort((a, b) => Number(b.status === 'review') - Number(a.status === 'review'))
    .slice(0, 3)
  const reqRank = (r: Requirement) => reqs.indexOf(r) + 1

  // عناوين الأقسام وملخصاتها القصيرة الظاهرة قبل الفتح
  const sections: { id: string; title: string; summary: string }[] = [
    { id: 'requirements', title: 'متطلبات Microsoft Elevate والمجالات', summary: `${formatNumber(doneReq)} من ${formatNumber(reqs.length)} مكتملة${nReq('review') ? ` · ${formatNumber(nReq('review'))} تحتاج إلى مراجعة` : ''}` },
    { id: 'evidence', title: 'الشواهد والمؤشرات', summary: total ? `${formatNumber(indDone)} من ${formatNumber(total)} مؤشرًا مكتمل · ${formatNumber(gapCount)} نواقص` : `لم تُدخل المؤشرات بعد · ${formatNumber(gapCount)} نواقص` },
    { id: 'plan', title: 'خطة التنفيذ والمهام', summary: `${formatNumber(planStages.length)} مراحل · ${formatNumber(openTasks.length)} مهمة مفتوحة` },
    { id: 'governance', title: 'السياسات والحوكمة', summary: doc ? `${labelOf(govDocStatuses, doc.status)}${doc.version ? ` · الإصدار ${doc.version}` : ''} · ${formatNumber(provenPolicies)} من ${formatNumber(data.policies.length)} عناصر مثبتة` : 'لا توجد وثيقة مسجلة' },
    { id: 'submission', title: 'التقديم والاعتراف والمراجع والمراسلات', summary: `الطلب: ${labelOf(showcaseStatuses, p.showcaseStatus)} · الاعتراف الرسمي: ${p.recognitionStatus === 'recorded' ? 'موثق' : 'لا يوجد'}` },
  ]

  return (
    <>
      <PageHeader
        title="لوحة متابعة جاهزية Microsoft Elevate"
        lead={
          <>
            {data.initiative.name || data.settings.exhibitName} · {data.settings.schoolName}
          </>
        }
        actions={
          <a className="btn primary" href={href('reports', 'readiness')}>
            <PrintRegular /> تقرير الجاهزية للطباعة
          </a>
        }
      />

      {/* ===== نظرة عامة ===== */}
      <section className="stats-sec rd-summary" aria-labelledby="ready-kpi">
        <div className="stats-head">
          <h2 id="ready-kpi" className="section-title">
            نظرة عامة
          </h2>
          <p className="sub">محسوبة من البيانات المسجلة فعلًا</p>
        </div>
        <div className="stats-4">
          <div className="stat tint-brand">
            {enoughData ? <span className="stat-value">{readyPct}٪</span> : <span className="stat-value is-empty">—</span>}
            <span className="stat-label">نسبة الجاهزية</span>
            <span className="stat-note">{enoughData ? `${formatNumber(doneReq)} من ${formatNumber(reqs.length)} متطلبات` : 'لم تُسجّل بيانات المقياس بعد'}</span>
          </div>
          <div className="stat tint-green">
            <span className="stat-value">{formatNumber(doneReq)}</span>
            <span className="stat-label">متطلبات مكتملة</span>
            <span className="stat-note">
              من {formatNumber(reqs.length)} · {formatNumber(reqs.length - doneReq)} متبقية
            </span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatNumber(tasksDone)}</span>
            <span className="stat-label">مهام مكتملة</span>
            <span className="stat-note">من {formatNumber(data.tasks.length)} مهمة</span>
          </div>
          <div className="stat tint-gold">
            <span className="stat-value">{formatNumber(openTasks.length)}</span>
            <span className="stat-label">مهام متبقية</span>
            <span className="stat-note">{openTasks.filter((t) => taskPriority(t).value === 'high').length} منها عالية الأولوية</span>
          </div>
        </div>
        <p className="rd-status-line">
          <span>
            طلب Showcase: <StatusBadge options={showcaseStatuses} value={p.showcaseStatus} />
          </span>
          <span>
            الاعتراف الرسمي من Microsoft: {p.recognitionStatus === 'recorded' ? <Badge tone="success">موثق بدليل</Badge> : <Badge>لا يوجد</Badge>}
          </span>
          <span className="caption">الجاهزية هنا داخلية، ولا تعني الأهلية للتقديم ولا الاعتراف الرسمي.</span>
        </p>

        {nextReqs.length > 0 && (
          <div className="rd-next">
            <h3>يحتاج إلى إجراء الآن</h3>
            <ol>
              {nextReqs.map((r) => (
                <li key={r.key}>
                  <span className="rd-next-n" aria-hidden>
                    {formatNumber(reqRank(r))}
                  </span>
                  <span className="rd-next-t">
                    {r.title}
                    <span className="caption">{r.hint}</span>
                  </span>
                  <StatusBadge options={reqStatuses} value={r.status} />
                  <button className="btn small no-print" onClick={() => runAction(r)}>
                    تعديل
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

      </section>

      <div className="rd-accs">
        {/* ===== متطلبات Microsoft Elevate والمجالات ===== */}
        <Acc id="requirements" n={2} title={sections[0].title} summary={sections[0].summary}>
          <p className="caption rd-acc-intro">من دليل التقديم الرسمي 2026–2027، بتسلسل التقديم. المستوى المسجل تقييم ذاتي داخلي.</p>
          <ol className="rd-reqs">
            {reqs.map((r) => (
              <li key={r.key} className={`st-${r.status}`}>
                <div className="rd-req-main">
                  <span className="rd-req-title">
                    {r.title}
                    {!r.official && <span className="caption"> · داعم داخلي</span>}
                  </span>
                  <span className="caption">{r.hint}</span>
                </div>
                <StatusBadge options={reqStatuses} value={r.status} />
                <button className="btn small no-print" onClick={() => runAction(r)}>
                  {r.status === 'done' ? 'عرض' : 'تعديل'}
                </button>
              </li>
            ))}
          </ol>
          <div className="rd-sub-head">
            <h3>مجالات المقياس</h3>
            <span className="caption">المستهدف: الحد الأدنى في دليل التقديم</span>
            <div className="row no-print rd-ind-actions">
              <button className="btn small" onClick={() => areaCrud.openNew(newArea())}>
                <AddRegular /> إضافة مجال
              </button>
            </div>
          </div>
          <RecordCollection
            view="table"
            items={data.areas}
            getTitle={(a) => a.name}
            onOpen={areaCrud.openView}
            onEdit={areaCrud.openEdit}
            onDelete={(a) => void areaCrud.askDelete(a)}
            columns={[
              { label: 'المستهدف', render: (a) => areaTarget(a) ?? '—', className: 'nowrap' },
              { label: 'المسجل', render: (a) => (levelNum(a.selfLevel) === null ? <span className="empty-value">لم يُحدد</span> : a.selfLevel), className: 'nowrap' },
              {
                label: 'المؤشرات المكتملة',
                render: (a) => {
                  const list = data.indicators.filter((i) => i.areaId === a.id)
                  return list.length ? `${formatNumber(list.filter((i) => lv.get(i.id)!.level === 'done').length)} من ${formatNumber(list.length)}` : <span className="empty-value">لا مؤشرات</span>
                },
                className: 'nowrap',
              },
              { label: 'الحالة', render: (a) => <StatusBadge options={reqStatuses} value={areaStatus(data, a)} /> },
            ]}
            empty={<p className="empty-inline">لم تُضف مجالات المقياس بعد.</p>}
          />
        </Acc>

        {/* ===== الشواهد والمؤشرات ===== */}
        <Acc id="evidence" n={3} title={sections[1].title} summary={sections[1].summary}>
          <div className="rd-sub-head first">
            <p className="rd-counts">
              <span>
                الإجمالي <strong>{formatNumber(total)}</strong>
              </span>
              <span>
                المكتملة <strong>{formatNumber(indDone)}</strong>
              </span>
              <span>
                الناقصة <strong>{formatNumber(total - indDone)}</strong>
              </span>
            </p>
            <div className="row no-print rd-ind-actions">
              <button className="btn small" onClick={() => void downloadBlob(toCsv(CSV_HEADERS, []), 'rubric-indicators-template.csv')}>
                <ArrowDownloadRegular /> قالب CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label="ملف المؤشرات" onChange={(e) => e.target.files?.[0] && void importCsv(e.target.files[0])} />
              <button className="btn small" onClick={() => fileRef.current?.click()}>
                <ArrowUploadRegular /> استيراد CSV
              </button>
              <a className="btn small" href={href('evidence', 'new')}>
                <AddRegular /> إضافة شاهد
              </a>
              <button className="btn small primary" onClick={() => indCrud.openNew(newIndicator())} disabled={!data.areas.length}>
                <AddRegular /> إضافة مؤشر
              </button>
            </div>
          </div>
          {total === 0 ? (
            <p className="rd-hint">
              لم تُدخل مؤشرات المقياس بعد. انقليها من {rubricLink ? <ExtLink url={rubricLink.url}>المقياس الرسمي</ExtLink> : 'المقياس الرسمي'} يدويًا أو باستيراد ملف CSV، ثم اربطي بكل مؤشر شاهده من «تعديل».
            </p>
          ) : (
            <>
              <div className="toolbar">
                <SelectFilter label="المجال" value={areaFilter} onChange={setAreaFilter} options={areaOptions} />
                <SelectFilter label="الحالة" value={statusFilter} onChange={setStatusFilter} options={indicatorStatuses} />
              </div>
              <RecordCollection
                view="table"
                items={indicators}
                getTitle={(i) => [i.code, i.text].filter(Boolean).join(' — ')}
                onOpen={indCrud.openView}
                onEdit={indCrud.openEdit}
                onDelete={(i) => void indCrud.askDelete(i)}
                columns={[
                  { label: 'المجال', render: (i) => labelOf(areaOptions, i.areaId) },
                  { label: 'الشواهد', render: (i) => (evCount(i) ? formatNumber(evCount(i)) : <span className="caption warn">لا يوجد</span>), className: 'nowrap' },
                  {
                    label: 'الحالة',
                    render: (i) => {
                      const l = lv.get(i.id)!
                      return (
                        <span className="status-cell">
                          <StatusBadge options={level3Options} value={l.level} />
                          {l.detail && <span className={`caption${l.needsAction ? ' warn' : ''}`}>{l.detail}</span>}
                        </span>
                      )
                    },
                  },
                ]}
                empty={<p className="empty-inline">لا توجد مؤشرات مطابقة للتصفية.</p>}
              />
            </>
          )}
          <div id="alerts">
            <More label={`النواقص والتنبيهات (${formatNumber(gapCount)})`} className="rd-more">
              {gapCount === 0 ? (
                <p className="empty-inline">لا توجد نواقص أو تنبيهات حاليًا.</p>
              ) : (
                <ul className="rd-gaps">
                  {emptyAreas.map((a) => (
                    <li key={a.id}>
                      <Badge tone="warning">ناقص</Badge>
                      <span>«{a.name}» بلا مؤشرات مسجلة.</span>
                      <button className="btn small no-print" onClick={() => indCrud.openNew({ ...newIndicator(), areaId: a.id })}>
                        إضافة مؤشر
                      </button>
                    </li>
                  ))}
                  {gaps.map((i) => (
                    <li key={i.id}>
                      <Badge tone="warning">ناقص</Badge>
                      <span>
                        {i.code || i.text}: {evCount(i) === 0 ? 'لا يرتبط به شاهد' : i.gap || labelOf(indicatorStatuses, i.status)}
                      </span>
                      <button className="btn small no-print" onClick={() => indCrud.openEdit(i)}>
                        معالجة
                      </button>
                    </li>
                  ))}
                  {alerts.map((a) => (
                    <li key={a.id}>
                      <Badge tone={a.tone}>{a.tone === 'danger' ? 'حرج' : 'ناقص'}</Badge>
                      <span>{a.text}</span>
                      <a className="btn small no-print" href={href(a.route, a.route === 'governance' ? 'manage' : undefined)}>
                        فتح
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </More>
          </div>
        </Acc>

        {/* ===== خطة التنفيذ والمهام ===== */}
        <Acc id="plan" n={4} title={sections[2].title} summary={sections[2].summary}>
          {planStages.length > 0 && (
            <>
              <div className="rd-sub-head first">
                <h3>مراحل الخطة</h3>
                <a className="btn small no-print rd-ind-actions" href={`${href('initiative')}`}>
                  تفاصيل الخطة في ملف المبادرة
                </a>
              </div>
              <ol className="rd-stages">
                {planStages.map((s, i) => {
                  const pg = stageProgress(s.activities, actDocumented)
                  const ds = s.activities.flatMap((a) => [a.date, a.endDate ?? '']).filter(Boolean).sort()
                  return (
                    <li key={i}>
                      <span className="rd-next-n" aria-hidden>
                        {formatNumber(i + 1)}
                      </span>
                      <span className="rd-next-t">
                        {s.title}
                        <span className="caption">{ds.length ? `${formatDate(ds[0])} – ${formatDate(ds[ds.length - 1])}` : 'بلا موعد'}</span>
                      </span>
                      <span className="rd-stage-pg">
                        <span className="caption">
                          {pg.pct}٪ ({formatNumber(pg.done)} من {formatNumber(pg.total)} منفذ وموثق)
                        </span>
                        <span className="progress success" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pg.pct} aria-label={`إنجاز ${s.title}`}>
                          <span style={{ width: `${pg.pct}%` }} />
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            </>
          )}
          <div className="rd-sub-head">
            <h3>المهام التالية</h3>
            <span className="caption">مرتبة بالأولوية ثم الموعد</span>
            <div className="row no-print rd-ind-actions">
              <button className="btn small primary" onClick={() => taskCrud.openNew(newTask())}>
                <AddRegular /> إضافة مهمة
              </button>
            </div>
          </div>
          {openTasks.length === 0 ? (
            <p className="empty-inline">لا توجد مهام مفتوحة.</p>
          ) : (
            <>
              <ul className="rd-tasks">{openTasks.slice(0, TOP).map(taskRow)}</ul>
              {openTasks.length > TOP && (
                <More label={`بقية المهام (${formatNumber(openTasks.length - TOP)})`} className="rd-more">
                  <ul className="rd-tasks">{openTasks.slice(TOP).map(taskRow)}</ul>
                </More>
              )}
            </>
          )}
          <p className="caption rd-foot">الأولوية غير المحددة تُقترح من مجال المهمة: الحوكمة والجاهزية أولًا. حدديها من «تعديل».</p>
        </Acc>

        {/* ===== السياسات والحوكمة ===== */}
        <Acc id="governance" n={5} title={sections[3].title} summary={sections[3].summary}>
          {doc ? (
            <div className="rd-gov">
              <p className="rd-gov-title">
                <strong>{doc.title}</strong>
                <StatusBadge options={govDocStatuses} value={doc.status} />
              </p>
              <ol className="rd-gov-stages">
                {approvalStages.map((s) => (
                  <li key={s.key}>
                    <span>{s.label}</span>
                    <StatusBadge options={stageStatuses} value={doc.stages[s.key].status} />
                  </li>
                ))}
              </ol>
              <p className="caption">
                {formatNumber(provenPolicies)} من {formatNumber(data.policies.length)} عناصر حوكمة مثبتة بشواهد. اكتمال الإعداد لا يعني الاعتماد.
              </p>
              <div className="row no-print">
                <a className="btn small" href={href('governance')}>
                  صفحة الحوكمة
                </a>
                <a className="btn small primary" href={href('governance', 'manage')}>
                  متابعة العناصر وتعديلها
                </a>
              </div>
            </div>
          ) : (
            <p className="empty-inline">لا توجد وثيقة حوكمة مسجلة.</p>
          )}
        </Acc>

        {/* ===== التقديم والاعتراف والمراجع والمراسلات ===== */}
        <Acc id="submission" n={6} title={sections[4].title} summary={sections[4].summary}>
          <div className="rd-cols">
            <div>
              <div className="rd-sub-head first">
                <h3>حالة البرنامج</h3>
                <button className="btn small no-print rd-ind-actions" onClick={() => setEditProgram('program')}>
                  <EditRegular /> تعديل
                </button>
              </div>
              <dl className="rd-dl">
                <div>
                  <dt>Pathfinder</dt>
                  <dd>
                    <StatusBadge options={pathfinderStatuses} value={p.pathfinderStatus} /> {p.pathfinderEvidence && <ExtLink url={p.pathfinderEvidence}>الدليل</ExtLink>}
                  </dd>
                </div>
                <div>
                  <dt>أسئلة النموذج</dt>
                  <dd>{labelOf(stepStatuses, p.questionsStatus ?? 'not_started')}</dd>
                </div>
                <div>
                  <dt>Evidence Template</dt>
                  <dd>{labelOf(stepStatuses, p.templateStatus ?? 'not_started')}</dd>
                </div>
                <div>
                  <dt>طلب Showcase</dt>
                  <dd>
                    <StatusBadge options={showcaseStatuses} value={p.showcaseStatus} /> {p.submissionDate && formatDate(p.submissionDate)}
                  </dd>
                </div>
              </dl>
              <div className="rd-sub-head">
                <h3>الاعتراف الرسمي</h3>
                <button className="btn small no-print rd-ind-actions" onClick={() => setEditProgram('recognition')}>
                  <EditRegular /> تعديل
                </button>
              </div>
              <p className="rd-pad">
                {p.recognitionStatus === 'recorded' ? (
                  <>
                    <Badge tone="success">موثق بدليل</Badge> {formatDate(p.recognitionDate)} · <ExtLink url={p.recognitionEvidenceUrl}>الدليل الرسمي</ExtLink>
                  </>
                ) : (
                  <span className="caption">لا يوجد اعتراف رسمي مسجل. يُسجل فقط عند وصول إشعار رسمي مع دليله.</span>
                )}
              </p>
            </div>
            <div>
              <div className="rd-sub-head first">
                <h3>المراجع الرسمية</h3>
                <a className="btn small no-print rd-ind-actions" href={href('settings')}>
                  تعديل الروابط
                </a>
              </div>
              <ul className="rd-refs">
                {refs.map((l) => (
                  <li key={l.id}>
                    <ExtLink url={l.url}>{l.title}</ExtLink>
                    {!l.reviewedAt && !/aka\.ms|microsoft\.com\/en-us\/education\/blog/i.test(l.url) && <span className="caption warn">يحتاج إلى تحقق</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rd-sub-head">
            <h3>المراسلات ({formatNumber(data.correspondence.length)})</h3>
            <div className="row no-print rd-ind-actions">
              <button className="btn small" onClick={() => corrCrud.openNew(newCorr())}>
                <AddRegular /> إضافة مراسلة
              </button>
            </div>
          </div>
          <RecordCollection
            view="table"
            items={[...data.correspondence].sort((a, b) => b.date.localeCompare(a.date))}
            getTitle={(c) => c.subject}
            onOpen={corrCrud.openView}
            onEdit={corrCrud.openEdit}
            onDelete={(c) => void corrCrud.askDelete(c)}
            columns={[
              { label: 'التاريخ', render: (c) => formatDate(c.date), className: 'nowrap' },
              { label: 'النوع', render: (c) => labelOf(correspondenceDirections, c.direction) },
              { label: 'الجهة', render: (c) => <Value v={c.party} empty="—" /> },
              { label: 'الرابط', render: (c) => (c.url ? <ExtLink url={c.url}>فتح</ExtLink> : '—') },
            ]}
            empty={<p className="empty-inline rd-pad">لا توجد مراسلات مسجلة.</p>}
          />
        </Acc>
      </div>

      {editProgram === 'program' && <ProgramEditor title="حالة البرنامج وخطوات التقديم" fields={programFields} onClose={() => setEditProgram(null)} />}
      {editProgram === 'recognition' && <ProgramEditor title="حالة الاعتراف الرسمية" fields={recognitionFields} onClose={() => setEditProgram(null)} />}
      {indCrud.node}
      {areaCrud.node}
      {taskCrud.node}
      {corrCrud.node}
    </>
  )
}

/** قسم قابل للفتح: العنوان والملخص ظاهران، والتفاصيل عند الفتح. يُفتح تلقائيًا إذا طُلب في الرابط (#/readiness/القسم) */
function Acc({ id, n, title, summary, children }: { id: string; n: number; title: string; summary: string; children: ReactNode }) {
  const { param } = useRoute()
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (param !== id || !ref.current) return
    ref.current.open = true
    ref.current.scrollIntoView({ block: 'start' })
  }, [param, id])
  return (
    <details className="rd-acc" id={id} ref={ref}>
      <summary>
        <span className="rd-acc-n" aria-hidden>
          {String(n).padStart(2, '0')}
        </span>
        <span className="rd-acc-head">
          <span className="rd-acc-title">{title}</span>
          <span className="rd-acc-sum">{summary}</span>
        </span>
        <ChevronDownRegular aria-hidden className="more-chev" />
      </summary>
      <div className="rd-acc-body">{children}</div>
    </details>
  )
}
