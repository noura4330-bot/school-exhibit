import { AddRegular, EditRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { ImpactMeasure } from '../data/types'
import { impactExamples } from '../data/seed'
import { evidenceFor, practiceDoc } from '../data/selectors'
import { Badge, EmptyState, Message, PageHeader, Section, Value } from '../components/ui'
import { useCrud, type EditorConfig } from '../components/records'
import type { FieldDef } from '../components/form'
import { formatDate, formatNumber, todayIso, toNumber } from '../lib/util'

const numeric = (label: string) => (v: unknown) =>
  typeof v === 'string' && v.trim() && toNumber(v) === null ? `${label}: أدخلي رقمًا (يمكن إضافة الوحدة في حقل الوحدة).` : null

const fields: FieldDef[] = [
  { key: 'title', label: 'المؤشر', type: 'text', required: true, full: true },
  { key: 'unit', label: 'الوحدة', type: 'text', hint: 'مثل: % أو عدد أو درجة من 5.' },
  {
    key: 'measuredOn',
    label: 'تاريخ القياس',
    type: 'date',
    validate: (v) => (typeof v === 'string' && v > todayIso() ? 'تاريخ القياس لا يكون في المستقبل.' : null),
  },
  { key: 'baseline', label: 'خط الأساس', type: 'text', validate: numeric('خط الأساس') },
  { key: 'target', label: 'المستهدف', type: 'text', validate: numeric('المستهدف') },
  {
    key: 'actual',
    label: 'النتيجة الفعلية',
    type: 'text',
    validate: (v, r) =>
      numeric('النتيجة الفعلية')(v) ??
      (typeof v === 'string' && v.trim() && !r.measuredOn ? 'سجّلي تاريخ القياس مع النتيجة الفعلية.' : null),
  },
  { key: 'method', label: 'طريقة القياس', type: 'textarea', rows: 2, hint: 'مثل: استبانة قبلية وبعدية، بطاقة ملاحظة، اختبار مهارات.' },
  { key: 'dataSource', label: 'مصدر البيانات', type: 'text', full: true },
  {
    key: 'causalDesign',
    label: 'أسلوب القياس يسمح بنسب التحسن إلى المبادرة (مثل وجود مجموعة مقارنة)',
    type: 'checkbox',
    hint: 'إن لم يُحدد، يُعرض التغير كفرق مرصود فقط دون ادعاء أثر سببي.',
  },
  { key: 'notes', label: 'الملاحظات', type: 'textarea', rows: 2 },
]

const config: EditorConfig<ImpactMeasure> = { title: 'مؤشر أثر', fields, linkKind: 'impact', linkLabel: 'الشاهد الداعم' }

/** مخطط مقارنة أفقي: خط الأساس (رمادي) والنتيجة الفعلية (أزرق) وعلامة المستهدف */
function MeasureChart({ m }: { m: ImpactMeasure }) {
  const b = toNumber(m.baseline)
  const t = toNumber(m.target)
  const a = toNumber(m.actual)
  if (a === null || (b === null && t === null))
    return <p className="caption">لا توجد بيانات كافية لاحتساب المؤشر. يلزم نتيجة فعلية مع خط أساس أو مستهدف.</p>
  const max = Math.max(b ?? 0, t ?? 0, a, 1) * 1.1
  const W = 520
  const L = 96
  const plotW = W - L - 56
  const x = (v: number) => (v / max) * plotW
  const rows = [
    ...(b !== null ? [{ label: 'خط الأساس', v: b, color: 'var(--fg4)' }] : []),
    { label: 'النتيجة الفعلية', v: a, color: 'var(--brand)' },
  ]
  const H = rows.length * 34 + 28
  const unit = m.unit && m.unit !== 'عدد' ? m.unit : ''
  // المحور يبدأ من اليمين لأن الواجهة عربية
  const X = (v: number) => W - L - x(v)
  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`مقارنة ${m.title}`}>
        <line x1={W - L} x2={W - L} y1={4} y2={H - 20} stroke="var(--stroke1)" />
        {rows.map((r, i) => {
          const y = 8 + i * 34
          return (
            <g key={r.label}>
              <text x={W - L + 8} y={y + 15} fontSize="12" fill="var(--fg2)" textAnchor="start" direction="rtl">
                {r.label}
              </text>
              <rect x={X(r.v)} y={y} width={Math.max(x(r.v), 2)} height={22} rx={4} style={{ fill: r.color }}>
                <title>{`${r.label}: ${formatNumber(r.v)}${unit}`}</title>
              </rect>
              <text x={X(r.v) - 6} y={y + 15} fontSize="12" fill="var(--fg1)" textAnchor="end">
                {formatNumber(r.v)}
                {unit}
              </text>
            </g>
          )
        })}
        {t !== null && (
          <g>
            <line x1={X(t)} x2={X(t)} y1={2} y2={H - 22} stroke="var(--fg1)" strokeWidth={2} strokeDasharray="4 3">
              <title>{`المستهدف: ${formatNumber(t)}${unit}`}</title>
            </line>
            <text x={X(t)} y={H - 6} fontSize="12" fill="var(--fg1)" textAnchor="middle">
              المستهدف {formatNumber(t)}
              {unit}
            </text>
          </g>
        )}
      </svg>
    </figure>
  )
}

function changeText(m: ImpactMeasure) {
  const b = toNumber(m.baseline)
  const a = toNumber(m.actual)
  const t = toNumber(m.target)
  const parts: string[] = []
  if (b !== null && a !== null) {
    const d = a - b
    parts.push(`الفرق المرصود عن خط الأساس: ${d > 0 ? '+' : ''}${formatNumber(d)}`)
  }
  if (t !== null && a !== null) parts.push(a >= t ? 'بلغت النتيجة المستهدف' : `المتبقي للمستهدف: ${formatNumber(t - a)}`)
  return parts.join(' · ')
}

export default function ImpactPage() {
  const { data } = useStore()
  const crud = useCrud<ImpactMeasure>('impact', config, (m) => m.title)
  const documentedPractices = data.practices.filter((p) => practiceDoc(data, p).state === 'complete').length

  const create = (title = '', unit = ''): ImpactMeasure => ({
    ...makeBase(),
    title,
    unit,
    baseline: '',
    target: '',
    actual: '',
    method: '',
    measuredOn: '',
    dataSource: '',
    notes: '',
    causalDesign: false,
  })

  const active = new Set(data.impact.map((m) => m.title))
  return (
    <>
      <PageHeader
        title="قياس الأثر"
        lead="لكل مؤشر خط أساس ومستهدف ونتيجة فعلية، مع طريقة القياس ومصدره."
        actions={
          <button className="btn primary" onClick={() => crud.openNew(create())}>
            <AddRegular /> إضافة مؤشر أثر
          </button>
        }
      />
      <Message tone="info">الرسوم تُبنى من القيم المدخلة فقط، ولا يُنسب التحسن إلى المبادرة ما لم يسمح أسلوب القياس بذلك.</Message>

      {impactExamples.some((ex) => !active.has(ex.title)) ? (
        <Section title="مؤشرات أساسية غير مفعّلة" sub="تُضاف بلا قيم، وتُملأ من القياس الفعلي" band="ivory">
          <div className="row">
            {impactExamples.map((ex) => (
              <button
                key={ex.title}
                className="btn"
                disabled={active.has(ex.title)}
                onClick={() => crud.openNew(create(ex.title, ex.unit))}
                title={active.has(ex.title) ? 'مفعّل' : 'تفعيل'}
              >
                <AddRegular /> {ex.title}
              </button>
            ))}
          </div>
          <p className="caption" style={{ marginTop: 8 }}>
            للمرجع: عدد الممارسات التعليمية الموثقة المحسوب من صفحة التعليم والتعلم حاليًا = {formatNumber(documentedPractices)}.
          </p>
        </Section>
      ) : (
        <p className="caption">
          للمرجع: عدد الممارسات التعليمية الموثقة المحسوب من صفحة التعليم والتعلم حاليًا = {formatNumber(documentedPractices)}.
        </p>
      )}

      {data.impact.length === 0 ? (
        <div className="section">
          <EmptyState
            title="لم تُسجل مؤشرات أثر بعد"
            action={
              <button className="btn primary" onClick={() => crud.openNew(create())}>
                <AddRegular /> إضافة مؤشر أثر
              </button>
            }
          >
            فعّلي أحد المؤشرات المقترحة أعلاه أو أضيفي مؤشرًا خاصًا، ثم سجّلي خط الأساس قبل التنفيذ.
          </EmptyState>
        </div>
      ) : (
        <div className="cols-2">
          {data.impact.map((m) => {
            const ev = evidenceFor(data, { kind: 'impact', id: m.id })
            const change = changeText(m)
            return (
              <Section
                key={m.id}
                title={m.title}
                sub={`${m.unit ? `الوحدة: ${m.unit} · ` : ''}تاريخ القياس: ${formatDate(m.measuredOn)}`}
                actions={
                  <>
                    <button className="btn small" onClick={() => crud.openView(m)}>
                      التفاصيل
                    </button>
                    <button className="btn small icon" aria-label={`تعديل ${m.title}`} onClick={() => crud.openEdit(m)}>
                      <EditRegular />
                    </button>
                  </>
                }
              >
                <div className="stack">
                  <MeasureChart m={m} />
                  <div className="legend" aria-hidden>
                    <span>
                      <i style={{ background: 'var(--fg4)' }} /> خط الأساس
                    </span>
                    <span>
                      <i style={{ background: 'var(--brand)' }} /> النتيجة الفعلية
                    </span>
                    <span>
                      <i style={{ background: 'transparent', borderTop: '2px dashed var(--fg1)', height: 0, width: 14 }} /> المستهدف
                    </span>
                  </div>
                  <table className="table">
                    <caption className="sr-only">قيم {m.title}</caption>
                    <thead>
                      <tr>
                        <th scope="col">خط الأساس</th>
                        <th scope="col">المستهدف</th>
                        <th scope="col">النتيجة الفعلية</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <Value v={m.baseline} empty="—" />
                        </td>
                        <td>
                          <Value v={m.target} empty="—" />
                        </td>
                        <td>
                          <Value v={m.actual} empty="—" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {change && (
                    <div className="row">
                      <span>{change}</span>
                      {!m.causalDesign && <Badge>فرق مرصود، لا يُنسب سببيًا</Badge>}
                    </div>
                  )}
                  <div className="caption">
                    الطريقة: {m.method || '—'} · المصدر: {m.dataSource || '—'} · الشواهد: {ev.length}
                  </div>
                  {m.notes.trim() && <p className="caption pre-line">{m.notes}</p>}
                </div>
              </Section>
            )
          })}
        </div>
      )}
      {crud.node}
    </>
  )
}
