// أقسام صفحة ملف المبادرة: كل قسم يعرض حقول الملف والسجلات الفعلية بصيغة مختصرة، والتفاصيل تُفتح عند الطلب.
// لا يُحسب هنا أي رقم غير موجود: الحالات والأعداد مشتقة من السجلات، والفارغ يُعرض فارغًا بوضوح.
import type { CSSProperties, ReactNode } from 'react'
import { ChevronDownRegular } from '@fluentui/react-icons'
import type { Activity, AppData, ImpactMeasure, InitiativeProfile } from '../data/types'
import { Badge, Value } from './ui'
import { formatDate } from '../lib/util'

export const lines = (t: string) =>
  (t ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

export const stripMarker = (l: string) => l.replace(/^\s*(?:[-–•*·]|\(?[0-9٠-٩]+[).]|[0-9٠-٩]+\s*[-–])\s*/, '')

/** يفصل «العنوان: النص» إن كان العنوان قصيرًا، وإلا يعيد النص كما هو */
export function splitLead(line: string, sep: RegExp = /[:：]/, max = 60): [string | null, string] {
  const m = line.match(sep)
  if (!m || m.index === undefined || m.index > max) return [null, line]
  return [line.slice(0, m.index).trim(), line.slice(m.index + m[0].length).trim()]
}

/** هدف تنفيذي: عنوان مختصر اختياري قبل النقطتين، ثم الوصف */
export const goalParts = (line: string) => splitLead(stripMarker(line), /[:：]/, 32)

/** أول عبارة من نص طويل (حتى أول فاصلة بعد 40 حرفًا)، لعرض المبرر في سطر واحد */
export function firstClause(text: string): string {
  const t = lines(text)[0] ?? ''
  const i = t.indexOf('،', 40)
  return i > 0 ? `${t.slice(0, i)}.` : t
}

/** تفاصيل قابلة للفتح بصيغة موحدة */
export function More({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <details className={`more-d${className ? ` ${className}` : ''}`}>
      <summary>
        <span>{label}</span>
        <ChevronDownRegular aria-hidden className="more-chev" />
      </summary>
      <div className="more-body">{children}</div>
    </details>
  )
}

/** رأس قسم مرقم: الرقم يوضح تسلسل الصفحة */
export function SecHead({ n, id, title, sub, actions }: { n: string; id: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="ini-sec-head">
      <div>
        <h2 id={`${id}-title`} className="ini-sec-title">
          <span className="ini-sec-n" aria-hidden>
            {n}
          </span>
          {title}
        </h2>
        {sub && <p className="ini-sec-sub">{sub}</p>}
      </div>
      {actions && <div className="row no-print">{actions}</div>}
    </header>
  )
}

/* ===== الأهداف التنفيذية ===== */

export function ExecGoals({ text }: { text: string }) {
  const goals = lines(text).map(goalParts)
  if (!goals.length) return <p className="empty-value">لم تُسجل الأهداف التنفيذية بعد. أضيفيها من «تعديل ملف المبادرة»، هدفًا في كل سطر.</p>
  return (
    <ol className="ini-goals">
      {goals.map(([title, desc], i) => (
        <li key={i}>
          <span className="ini-goal-n" aria-hidden>
            {String(i + 1).padStart(2, '0')}
          </span>
          <div>
            {title && <strong>{title}</strong>}
            <p>{desc}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ===== خطة التنفيذ ===== */

/** مجالات الأنشطة التابعة لكل مرحلة بحسب ترتيبها */
const stageDomains: string[][] = [['initiative', 'governance'], ['professional'], ['teaching'], ['projects'], ['impact', 'readiness']]

export interface Stage {
  title: string
  desc: string
  activities: Activity[]
}

export function parseStages(ini: InitiativeProfile, activities: Activity[]): { intro: string | null; stages: Stage[] } {
  const ls = lines(ini.timeline)
  const intro = ls.length > 1 && !/^(المرحلة|[0-9٠-٩])/.test(ls[0]) ? ls[0] : null
  const steps = intro ? ls.slice(1) : ls
  const stages = steps.map((s, i) => {
    const [rawHead, body] = splitLead(s, /[:：]/, 90)
    const title = (rawHead ?? s).replace(/^المرحلة\s*[0-9٠-٩]+\s*[—–-]\s*/, '')
    const domains = steps.length === stageDomains.length ? stageDomains[i] : []
    return {
      title,
      desc: rawHead ? body : '',
      activities: activities.filter((a) => (a.stage && steps.length === stageDomains.length ? a.stage === i + 1 : domains.includes(a.domain))),
    }
  })
  return { intro, stages }
}

/** لا تُعرض المرحلة «منفذة» إلا إذا نُفذت كل أنشطتها ووُثقت بشاهد */
function stageState(acts: Activity[], isDocumented: (a: Activity) => boolean): { label: string; tone: 'neutral' | 'brand' | 'success' } {
  const live = acts.filter((a) => a.status !== 'cancelled')
  const done = live.filter((a) => a.status === 'implemented').length
  if (live.length && live.every((a) => a.status === 'implemented' && isDocumented(a))) return { label: 'منفذة', tone: 'success' }
  if (done > 0) return { label: 'قيد التنفيذ', tone: 'brand' }
  return { label: 'مخططة', tone: 'neutral' }
}

/** نسبة إنجاز المرحلة: الأنشطة المنفذة التي لها شاهد مرتبط، من أنشطتها غير الملغاة */
export function stageProgress(acts: Activity[], isDocumented: (a: Activity) => boolean) {
  const live = acts.filter((a) => a.status !== 'cancelled')
  const done = live.filter((a) => a.status === 'implemented' && isDocumented(a)).length
  return { done, total: live.length, pct: live.length ? Math.round((done / live.length) * 100) : 0 }
}

const activityRange = (a: Activity) =>
  a.date ? (a.endDate && a.endDate !== a.date ? `${formatDate(a.date)} – ${formatDate(a.endDate)}` : formatDate(a.date)) : ''

export function PlanPath({
  stages,
  activityStatusLabel,
  isDocumented,
}: {
  stages: Stage[]
  activityStatusLabel: (a: Activity) => ReactNode
  isDocumented: (a: Activity) => boolean
}) {
  if (!stages.length) return <p className="empty-value">لم يُسجل الجدول الزمني بعد.</p>
  return (
    <ol className="ini-path" style={{ '--steps': stages.length } as CSSProperties}>
      {stages.map((s, i) => {
        const st = stageState(s.activities, isDocumented)
        const owners = [...new Set(s.activities.map((a) => a.responsible.trim()).filter(Boolean))]
        const dates = s.activities.flatMap((a) => [a.date, a.endDate ?? '']).filter(Boolean).sort()
        const outputs = [...new Set(s.activities.map((a) => a.output?.trim() ?? '').filter(Boolean))]
        const pg = stageProgress(s.activities, isDocumented)
        return (
          <li key={i}>
            <span className="ini-node" aria-hidden>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="ini-stage">
              <h3>{s.title}</h3>
              {s.desc && <p>{s.desc}</p>}
              <dl className="ini-stage-meta">
                <div>
                  <dt>الحالة</dt>
                  <dd>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </dd>
                </div>
                <div>
                  <dt>المسؤول</dt>
                  <dd>{owners.length ? owners.join('، ') : <span className="muted">غير محدد</span>}</dd>
                </div>
                <div>
                  <dt>الموعد</dt>
                  <dd>
                    {dates.length ? (
                      dates[0] === dates[dates.length - 1] ? formatDate(dates[0]) : `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`
                    ) : (
                      <span className="muted">غير محدد</span>
                    )}
                  </dd>
                </div>
                {pg.total > 0 && (
                  <div>
                    <dt>الإنجاز</dt>
                    <dd className="ini-stage-pg">
                      <span>
                        {pg.pct}٪ <span className="muted">({pg.done} من {pg.total} منفذ وموثق)</span>
                      </span>
                      <span
                        className="progress success"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pg.pct}
                        aria-label={`نسبة إنجاز المرحلة ${pg.pct}٪`}
                      >
                        <span style={{ width: `${pg.pct}%` }} />
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
              {outputs.length > 0 && (
                <p className="ini-stage-output">
                  <span>المخرج المتوقع:</span> {outputs.join(' ')}
                </p>
              )}
              {s.activities.length > 0 && (
                <More label={`الأنشطة (${s.activities.length})`}>
                  <ul className="ini-acts">
                    {s.activities.map((a) => (
                      <li key={a.id}>
                        <span>
                          {a.title}
                          {activityRange(a) && <small className="ini-act-date">{activityRange(a)}</small>}
                        </span>
                        {activityStatusLabel(a)}
                      </li>
                    ))}
                  </ul>
                </More>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** قائمة «الدور: الوصف» */
export function RoleList({ text }: { text: string }) {
  const ls = lines(text).map(stripMarker)
  if (!ls.length) return <Value v="" />
  return (
    <ul className="ini-roles">
      {ls.map((l, i) => {
        const [lead, rest] = splitLead(l)
        return (
          <li key={i}>
            {lead && <strong>{lead}</strong>}
            <span>{rest}</span>
          </li>
        )
      })}
    </ul>
  )
}

/* ===== مؤشرات قياس الأثر ===== */

export const impactAxes = [
  {
    key: 'teachers',
    title: 'تمكين المعلمات وتطبيق المهارات',
    desc: 'التدريب، والمشاركة فيه، وتطبيقه في الصف.',
    test: (t: string) => /المعلمات|ورش|تدريب/.test(t),
  },
  {
    key: 'students',
    title: 'وعي الطالبات بالاستخدام المسؤول للذكاء الاصطناعي',
    desc: 'الأنشطة التوعوية ومستوى الوعي قبلها وبعدها.',
    test: (t: string) => /الطالبات|توعو|وعي/.test(t) && !/مشروع/.test(t),
  },
  {
    key: 'practices',
    title: 'الممارسات والمشروعات التعليمية',
    desc: 'الممارسات الصفية ومشروعات الطالبات الموثقة.',
    test: (t: string) => /الممارسات|المشروعات|مشروعات|الأنشطة/.test(t),
  },
  {
    key: 'governance',
    title: 'الحوكمة واستيفاء المتطلبات وتوثيق الشواهد',
    desc: 'عناصر الحوكمة، واستكمال الشواهد، وتحقق المستهدفات.',
    test: (t: string) => /الحوكمة|الشواهد|المستهدفات|المتطلبات|Elevate/.test(t),
  },
] as const

export interface AxisItem {
  title: string
  measure?: ImpactMeasure
}

const norm = (t: string) => t.replace(/[.،\s]+$/g, '').trim()

/** يوزع سجلات القياس ومؤشرات الملف على المحاور الأربعة دون تكرار */
export function groupIndicators(data: AppData): { axes: { axis: (typeof impactAxes)[number]; items: AxisItem[] }[]; other: AxisItem[] } {
  const items: AxisItem[] = data.impact.map((m) => ({ title: m.title, measure: m }))
  const have = new Set(items.map((i) => norm(i.title)))
  for (const k of lines(data.initiative.kpis).map(stripMarker)) if (!have.has(norm(k))) items.push({ title: norm(k) })
  const axes = impactAxes.map((axis) => ({ axis, items: [] as AxisItem[] }))
  const other: AxisItem[] = []
  for (const it of items) {
    const a = axes.find((x) => x.axis.test(it.title))
    if (a) a.items.push(it)
    else other.push(it)
  }
  return { axes, other }
}

const num = (v: string) => {
  const n = Number(String(v).replace(/[%٪\s]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))
  return v.trim() && Number.isFinite(n) ? n : null
}

/** نسبة التقدم نحو المستهدف، فقط إذا سُجلت النتيجة والمستهدف رقمين */
export function measureProgress(m?: ImpactMeasure): number | null {
  if (!m) return null
  const t = num(m.target)
  const a = num(m.actual)
  if (t === null || a === null || t <= 0) return null
  return Math.max(0, Math.min(100, Math.round((a / t) * 100)))
}

export const isMeasured = (it: AxisItem) => !!it.measure?.actual.trim()

export function AxisTable({ items }: { items: AxisItem[] }) {
  return (
    <ul className="ini-ind">
      {items.map((it, i) => {
        const m = it.measure
        const p = measureProgress(m)
        return (
          <li key={i}>
            <div className="ini-ind-name">
              <strong>{it.title}</strong>
              {m ? (
                m.dataSource && <span className="caption">المصدر: {m.dataSource}</span>
              ) : (
                <span className="caption">مؤشر في ملف المبادرة، ولم يُنشأ له سجل قياس بعد.</span>
              )}
            </div>
            <dl className="ini-bta">
              <div className="b">
                <dt>خط الأساس</dt>
                <dd>{m?.baseline.trim() ? m.baseline : <span className="muted">يحتاج إلى قياس أولي</span>}</dd>
              </div>
              <div className="t">
                <dt>المستهدف</dt>
                <dd>{m?.target.trim() ? m.target : <span className="muted">يحتاج إلى تحديد</span>}</dd>
              </div>
              <div className="a">
                <dt>النتيجة الفعلية</dt>
                <dd>
                  {m?.actual.trim() ? (
                    <>
                      {m.actual}
                      {p !== null && (
                        <span className="ini-bar" role="img" aria-label={`${p}% من المستهدف`}>
                          <span style={{ width: `${p}%` }} />
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="muted">لم يُقس بعد</span>
                  )}
                </dd>
              </div>
            </dl>
            {m?.method && (
              <More label="طريقة القياس" className="tight">
                <p>{m.method}</p>
                {m.notes && <p className="caption pre-line">{m.notes}</p>}
              </More>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* ===== التقرير ===== */

/** التحديات وإجراءاتها في صفوف متقابلة إذا تساوى عدداهما */
export function ChallengePairs({ challenges, improvements }: { challenges: string; improvements: string }) {
  const cs = lines(challenges).map(stripMarker)
  const is = lines(improvements).map(stripMarker)
  if (!cs.length && !is.length) return <Value v="" />
  if (cs.length !== is.length)
    return (
      <div className="ini-two">
        <div>
          <h4>التحديات</h4>
          <ul className="ini-plain">{cs.length ? cs.map((c, i) => <li key={i}>{c}</li>) : <li className="muted">لم تُسجل</li>}</ul>
        </div>
        <div>
          <h4>الإجراءات التحسينية</h4>
          <ul className="ini-plain">{is.length ? is.map((c, i) => <li key={i}>{c}</li>) : <li className="muted">لم تُسجل</li>}</ul>
        </div>
      </div>
    )
  return (
    <ol className="ini-pairs">
      <li className="ini-pairs-head" aria-hidden>
        <span>التحدي</span>
        <span>الإجراء التالي</span>
      </li>
      {cs.map((c, i) => {
        const [, act] = splitLead(is[i], /←/, 80)
        const m = act.match(/^(.*?)(يُقاس.*)$/)
        return (
          <li key={i}>
            <span>
              <span className="sr-only">التحدي: </span>
              {c}
            </span>
            <span>
              <span className="sr-only">الإجراء: </span>
              {m ? m[1].trim() : act}
              {m && <span className="caption measure">{m[2]}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** نص تقرير الإنجاز بشكل وثيقة */
export function ReportDoc({ text }: { text: string }) {
  if (!text.trim()) return <Value v="" />
  const isHeading = (l: string) => /^(أولًا|ثانيًا|ثالثًا|رابعًا|خامسًا|سادسًا|سابعًا|ثامنًا|تاسعًا|عاشرًا|ملاحظة)/.test(l.trim())
  return (
    <div className="ini-doc">
      {text.split('\n').map((l, i) =>
        i === 0 ? (
          <p key={i} className="ini-doc-title">
            {l}
          </p>
        ) : !l.trim() ? null : isHeading(l) ? (
          <p key={i} className="ini-doc-h">
            {l}
          </p>
        ) : (
          <p key={i}>{l}</p>
        ),
      )}
    </div>
  )
}
