// بطاقات قسمي «مؤشرات قياس الأثر» و«إدارة التنفيذ» في صفحة ملف المبادرة:
// البطاقة تعرض الملخص، والتفاصيل تُفتح أسفلها عند الضغط. العرض فقط؛ البيانات والحسابات كما هي.
import { useId, useState, type ReactNode } from 'react'
import { ChevronDownRegular, DeleteRegular, EditRegular, OpenRegular } from '@fluentui/react-icons'
import type { Activity, AppData, Task } from '../data/types'
import { activityStatuses, labelOf, siteDomains, taskPriorities, taskStatuses } from '../data/options'
import { evidenceFor } from '../data/selectors'
import { taskPriority } from '../data/readiness'
import { href } from '../lib/router'
import { formatDate, todayIso } from '../lib/util'
import { Badge, StatusBadge, Value } from './ui'
import { AxisTable, impactAxes, isMeasured, type AxisItem } from './InitiativeSections'

/** رأس بطاقة قابلة للفتح: زر يغطي الملخص، وسهم واضح */
function useToggle() {
  const [open, setOpen] = useState(false)
  const id = useId()
  return { open, toggle: () => setOpen((v) => !v), bodyId: `${id}-body` }
}

const Chev = () => (
  <span className="ic-chev" aria-hidden>
    <ChevronDownRegular />
  </span>
)

/* ===== مؤشرات قياس الأثر ===== */

const countLabel = (n: number) => (n === 1 ? 'مؤشر فرعي واحد' : n === 2 ? 'مؤشران فرعيان' : `${n} مؤشرات فرعية`)

function measureState(items: AxisItem[]): { tone: 'neutral' | 'brand' | 'success' | 'warning'; label: string } {
  if (!items.length) return { tone: 'warning', label: 'لا مؤشرات' }
  const m = items.filter(isMeasured).length
  if (!m) return { tone: 'neutral', label: 'لم يُقس بعد' }
  if (m < items.length) return { tone: 'brand', label: `مقيس جزئيًا: ${m} من ${items.length}` }
  return { tone: 'success', label: 'مقيس' }
}

function AxisCard({ n, axis, items }: { n: number; axis: (typeof impactAxes)[number]; items: AxisItem[] }) {
  const { open, toggle, bodyId } = useToggle()
  const st = measureState(items)
  return (
    <li className={`ic-card${open ? ' is-open' : ''}`}>
      <button type="button" className="ic-head" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
        <span className="ic-n" aria-hidden>
          {String(n).padStart(2, '0')}
        </span>
        <span className="ic-main">
          <strong className="ic-title">{axis.title}</strong>
          <span className="ic-desc">{axis.desc}</span>
          <span className="ic-meta">
            <span className="ic-chip">{items.length ? countLabel(items.length) : 'لم يُسجل مؤشر'}</span>
            <Badge tone={st.tone}>{st.label}</Badge>
          </span>
        </span>
        <Chev />
      </button>
      <div className="ic-body" id={bodyId} hidden={!open}>
        {items.length ? <AxisTable items={items} /> : <p className="empty-value">لم يُسجل مؤشر لهذا المحور بعد.</p>}
      </div>
    </li>
  )
}

export function ImpactAxisCards({ axes }: { axes: { axis: (typeof impactAxes)[number]; items: AxisItem[] }[] }) {
  return (
    <ol className="ic-list ic-axes">
      {axes.map(({ axis, items }, i) => (
        <AxisCard key={axis.key} n={i + 1} axis={axis} items={items} />
      ))}
    </ol>
  )
}

/* ===== إدارة التنفيذ ===== */

/** خانة معلومة صغيرة داخل البطاقة */
const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="ic-fact">
    <span className="ic-fact-l">{label}</span>
    <span className="ic-fact-v">{children}</span>
  </div>
)

function EvidenceLinks({ data, kind, id }: { data: AppData; kind: 'task' | 'activity'; id: string }) {
  const ev = evidenceFor(data, { kind, id })
  if (!ev.length) return <span className="empty-value">لا شواهد مرتبطة بعد.</span>
  return (
    <ul className="ic-ev">
      {ev.map((e) => (
        <li key={e.id}>
          <a href={href('evidence', e.id)}>{e.title || 'شاهد بلا عنوان'}</a>
        </li>
      ))}
    </ul>
  )
}

function Actions({ title, onView, onEdit, onDelete }: { title: string; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="ic-actions no-print">
      <button type="button" className="btn small" onClick={onView}>
        <OpenRegular /> العرض الكامل
      </button>
      <button type="button" className="btn subtle small icon edit-only" aria-label={`تعديل ${title}`} title="تعديل" onClick={onEdit}>
        <EditRegular />
      </button>
      <button type="button" className="btn subtle small icon danger edit-only" aria-label={`حذف ${title}`} title="حذف" onClick={onDelete}>
        <DeleteRegular />
      </button>
    </div>
  )
}

export function TaskCard({
  t,
  data,
  onStatus,
  onView,
  onEdit,
  onDelete,
}: {
  t: Task
  data: AppData
  onStatus: (s: Task['status']) => void
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { open, toggle, bodyId } = useToggle()
  const late = !!t.due && t.due < todayIso() && t.status !== 'done'
  const pr = taskPriority(t)
  return (
    <li className={`ic-card ic-row${open ? ' is-open' : ''}`}>
      <div className="ic-row-top">
        <button type="button" className="ic-head ic-head-row" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
          <span className="ic-main">
            <strong className="ic-title">{t.title || 'بلا عنوان'}</strong>
            <span className="ic-meta">
              {t.area && <span className="ic-chip">{labelOf(siteDomains, t.area)}</span>}
              <span className="ic-m">
                <span className="ic-m-l">المسؤول:</span> <Value v={t.owner} empty="غير محدد" />
              </span>
              <span className="ic-m">
                <span className="ic-m-l">الموعد:</span> {t.due ? formatDate(t.due) : <span className="muted">غير محدد</span>}
              </span>
              {late && <Badge tone="danger">متأخرة</Badge>}
            </span>
          </span>
          <Chev />
        </button>
        <div className="ic-status">
          <span className="print-only">
            <StatusBadge options={taskStatuses} value={t.status} />
          </span>
          <select
            className={`input small status-select tone-${taskStatuses.find((o) => o.value === t.status)?.tone ?? 'neutral'} no-print`}
            aria-label={`حالة «${t.title}»`}
            value={t.status}
            onChange={(e) => onStatus(e.target.value as Task['status'])}
          >
            {taskStatuses.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="ic-body" id={bodyId} hidden={!open}>
        <div className="ic-facts">
          <Fact label="الأولوية">
            {labelOf(taskPriorities, pr.value)}
            {pr.auto && <span className="caption"> (مقترحة من المجال)</span>}
          </Fact>
          <Fact label="الحالة">
            <StatusBadge options={taskStatuses} value={t.status} />
          </Fact>
        </div>
        <div className="ic-block">
          <span className="ic-fact-l">الملاحظات والوصف</span>
          {t.notes?.trim() ? <p className="pre-line">{t.notes}</p> : <span className="empty-value">لا ملاحظات مسجلة.</span>}
        </div>
        <div className="ic-block">
          <span className="ic-fact-l">الشواهد</span>
          <EvidenceLinks data={data} kind="task" id={t.id} />
        </div>
        <Actions title={t.title} onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </li>
  )
}

export function ActivityCard({
  a,
  data,
  dates,
  onView,
  onEdit,
  onDelete,
}: {
  a: Activity
  data: AppData
  dates: string
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { open, toggle, bodyId } = useToggle()
  return (
    <li className={`ic-card ic-row${open ? ' is-open' : ''}`}>
      <div className="ic-row-top">
        <button type="button" className="ic-head ic-head-row" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
          <span className="ic-main">
            <strong className="ic-title">{a.title || 'بلا عنوان'}</strong>
            <span className="ic-meta">
              {a.domain && <span className="ic-chip">{labelOf(siteDomains, a.domain)}</span>}
              <span className="ic-m">
                <span className="ic-m-l">المسؤول:</span> <Value v={a.responsible} empty="غير محدد" />
              </span>
              <span className="ic-m">
                <span className="ic-m-l">الموعد:</span> {a.date ? dates : <span className="muted">غير محدد</span>}
              </span>
            </span>
          </span>
          <Chev />
        </button>
        <div className="ic-status">
          <StatusBadge options={activityStatuses} value={a.status} />
        </div>
      </div>
      <div className="ic-body" id={bodyId} hidden={!open}>
        <div className="ic-block">
          <span className="ic-fact-l">الوصف</span>
          {a.description?.trim() ? <p className="pre-line">{a.description}</p> : <span className="empty-value">لا وصف مسجل.</span>}
        </div>
        {a.output?.trim() && (
          <div className="ic-block">
            <span className="ic-fact-l">المخرج المتوقع</span>
            <p className="pre-line">{a.output}</p>
          </div>
        )}
        <div className="ic-block">
          <span className="ic-fact-l">الشواهد</span>
          <EvidenceLinks data={data} kind="activity" id={a.id} />
        </div>
        {a.notes?.trim() && (
          <div className="ic-block">
            <span className="ic-fact-l">الملاحظات</span>
            <p className="pre-line">{a.notes}</p>
          </div>
        )}
        <Actions title={a.title} onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </li>
  )
}
