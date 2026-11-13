// مؤشرات قياس أثر البرامج: كل مؤشر مبني على أحد أنواع الشواهد في برنامجه (العناصر نفسها في نظام الشواهد)،
// مع المستهدف والنتيجة الفعلية ووصف مختصر. تُعرض في صفحة «قياس الأثر» وفي تبويب «مؤشرات قياس الأثر» بملف المبادرة.
import { useState } from 'react'
import { AddRegular, DeleteRegular, EditRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { ProgramMeasure } from '../data/types'
import { activeKinds, kindOf, programById, programs } from '../data/programs'
import { href } from '../lib/router'
import { Drawer, useFeedback } from './feedback'
import { FieldShell } from './form'
import { Section, Value } from './ui'

/** اسم المؤشر: نوع الشاهد الذي يقيسه، وإلا العنوان المكتوب سابقًا */
export const measureTitle = (m: ProgramMeasure) => kindOf(m.programId, m.kindId)?.label ?? m.title

const firstNum = (v: string) => {
  const m = v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/,/g, '').match(/\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : null
}
const isPct = (v: string) => /[%٪]/.test(v)

/** نسبة الإنجاز تُحسب تلقائيًا من العدد الفعلي إلى المستهدف (أو من نسبتين). لا تُحسب إن اختلفت الوحدتان */
export function measurePct(m: Pick<ProgramMeasure, 'target' | 'actual'>): number | null {
  const t = firstNum(m.target)
  const a = firstNum(m.actual)
  if (t === null || a === null || t <= 0 || isPct(m.target) !== isPct(m.actual.replace(/\(.*\)/, ''))) return null
  return Math.round((a / t) * 100)
}

/** النتيجة الفعلية مع النسبة المحسوبة، دون تكرارها إن كانت النتيجة نسبة أصلًا */
function Actual({ m }: { m: ProgramMeasure }) {
  const pct = measurePct(m)
  const shown = m.actual.replace(/\s*\([\d٠-٩.]+\s*[%٪]\)\s*$/, '')
  return (
    <>
      <Value v={shown} empty="لم تُقس بعد" />
      {pct !== null && !isPct(shown) && <span className="pm-pct"> ({pct}%)</span>}
    </>
  )
}

const blank = (programId = '', kindId = ''): ProgramMeasure => ({ ...makeBase(), programId, kindId, title: '', target: '', actual: '', notes: '' })

function MeasureEditor({ initial, isNew, onClose }: { initial: ProgramMeasure; isNew: boolean; onClose: () => void }) {
  const { upsert } = useStore()
  const { toast } = useFeedback()
  const [d, setD] = useState(initial)
  const [errors, setErrors] = useState<{ program?: string; kind?: string }>({})
  const program = programById(d.programId)
  const kind = kindOf(d.programId, d.kindId)
  const set = (patch: Partial<ProgramMeasure>) => setD((x) => ({ ...x, ...patch }))

  const save = () => {
    const errs: typeof errors = {}
    if (!program) errs.program = 'اختاري البرنامج.'
    if (!kind && !d.title.trim()) errs.kind = 'اختاري المؤشر.'
    if (errs.program || errs.kind) return setErrors(errs)
    upsert('programMeasures', { ...d, title: kind?.label ?? d.title, target: d.target.trim(), actual: d.actual.trim(), notes: d.notes.trim() })
    toast(isNew ? 'تمت إضافة المؤشر.' : 'تم حفظ المؤشر.')
    onClose()
  }

  return (
    <Drawer
      title={isNew ? 'إضافة مؤشر قياس' : 'تعديل مؤشر القياس'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn primary edit-only" onClick={save}>
            حفظ
          </button>
        </>
      }
    >
      <div className="form-grid">
        <FieldShell id="pm-program" label="اسم البرنامج" required error={errors.program} full>
          <select
            id="pm-program"
            className="select"
            value={d.programId}
            onChange={(e) => {
              set({ programId: e.target.value, kindId: '', title: '' })
              setErrors({})
            }}
          >
            <option value="">اختاري البرنامج</option>
            {programs.map((p, n) => (
              <option key={p.id} value={p.id}>
                {n + 1}. {p.name}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell id="pm-kind" label="مؤشر القياس" required error={errors.kind} full hint="المؤشرات هي أنواع الشواهد نفسها في البرنامج.">
          <select
            id="pm-kind"
            className="select"
            value={kind ? d.kindId : ''}
            disabled={!program}
            onChange={(e) => {
              set({ kindId: e.target.value })
              setErrors((x) => ({ ...x, kind: undefined }))
            }}
          >
            <option value="">{program ? (!kind && d.title ? `${d.title} (مؤشر سابق)` : 'اختاري المؤشر') : 'اختاري البرنامج أولًا'}</option>
            {program?.kinds.filter((k) => !k.retired || k.id === initial.kindId).map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell id="pm-target" label="المستهدف">
          <input id="pm-target" className="input" value={d.target} onChange={(e) => set({ target: e.target.value })} />
        </FieldShell>
        <FieldShell id="pm-actual" label="النتيجة الفعلية">
          <input id="pm-actual" className="input" value={d.actual} onChange={(e) => set({ actual: e.target.value })} />
        </FieldShell>
        <p className="caption pm-auto" aria-live="polite">
          {measurePct(d) !== null
            ? `نسبة الإنجاز المحسوبة تلقائيًا: ${measurePct(d)}%`
            : 'اكتبي المستهدف والنتيجة بالعدد (مثل 350 طالبة و110 طالبات) لتُحسب النسبة تلقائيًا.'}
        </p>
        <FieldShell id="pm-notes" label="وصف مختصر للنتيجة" full>
          <textarea id="pm-notes" className="input" rows={3} value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
        </FieldShell>
      </div>
    </Drawer>
  )
}

function useMeasureCrud() {
  const { remove } = useStore()
  const { confirm, toast } = useFeedback()
  const [editing, setEditing] = useState<{ m: ProgramMeasure; isNew: boolean } | null>(null)
  const askDelete = async (m: ProgramMeasure) => {
    const ok = await confirm({ title: 'حذف المؤشر؟', body: `سيُحذف مؤشر «${measureTitle(m)}» وقيمه.`, confirmLabel: 'حذف', danger: true })
    if (!ok) return
    await remove('programMeasures', m.id)
    toast('تم حذف المؤشر.')
  }
  const node = editing && <MeasureEditor initial={editing.m} isNew={editing.isNew} onClose={() => setEditing(null)} />
  return { node, openNew: (m: ProgramMeasure) => setEditing({ m, isNew: true }), openEdit: (m: ProgramMeasure) => setEditing({ m, isNew: false }), askDelete }
}

/** قسم صفحة «قياس الأثر»: مؤشرات كل برنامج في جدول */
export function ProgramMeasures() {
  const { data } = useStore()
  const crud = useMeasureCrud()
  const orphan = data.programMeasures.filter((m) => !programById(m.programId))

  return (
    <Section
      title="مؤشرات قياس أثر البرامج"
      sub="مؤشرات كل برنامج هي أنواع شواهده نفسها، ولكل مؤشر مستهدف ونتيجة فعلية."
      actions={
        <button className="btn primary edit-only" onClick={() => crud.openNew(blank())}>
          <AddRegular /> إضافة مؤشر
        </button>
      }
    >
      <p className="caption pm-caveat">
        تُحسب نسبة الإنجاز تلقائيًا من النتيجة الفعلية إلى المستهدف. والأعداد تمثل المشاركات في التدريب أو التطبيق، ولا تعني إتقان جميعهن للمهارة.
      </p>
      <div className="pm-list">
        {programs.map((p, n) => {
          const list = data.programMeasures.filter((m) => m.programId === p.id)
          return (
            <article key={p.id} className={`pm-program${list.length ? '' : ' edit-only'}`}>
              <header className="pm-head">
                <h3>
                  <span className="pm-n" aria-hidden>
                    {String(n + 1).padStart(2, '0')}
                  </span>
                  {p.name}
                </h3>
                <button className="btn small edit-only" onClick={() => crud.openNew(blank(p.id))} aria-label={`إضافة مؤشر لبرنامج ${p.name}`}>
                  <AddRegular /> إضافة مؤشر
                </button>
              </header>
              {list.length === 0 ? (
                <p className="caption">لم يُضف مؤشر لهذا البرنامج بعد.</p>
              ) : (
                <MeasureTable list={list} onEdit={crud.openEdit} onDelete={(m) => void crud.askDelete(m)} />
              )}
            </article>
          )
        })}
        {orphan.length > 0 && (
          <article className="pm-program">
            <header className="pm-head">
              <h3>مؤشرات دون برنامج</h3>
            </header>
            <MeasureTable list={orphan} onEdit={crud.openEdit} onDelete={(m) => void crud.askDelete(m)} />
          </article>
        )}
      </div>
      {data.programMeasures.length === 0 && <p className="muted">لم تُسجل مؤشرات قياس للبرامج بعد.</p>}
      {crud.node}
    </Section>
  )
}

function MeasureTable({ list, onEdit, onDelete }: { list: ProgramMeasure[]; onEdit: (m: ProgramMeasure) => void; onDelete: (m: ProgramMeasure) => void }) {
  return (
    <div className="table-wrap">
      <table className="table pm-table">
        <thead>
          <tr>
            <th scope="col">مؤشر القياس</th>
            <th scope="col">المستهدف</th>
            <th scope="col">النتيجة الفعلية</th>
            <th scope="col">وصف النتيجة</th>
            <th scope="col" className="no-print edit-only">
              <span className="sr-only">إجراءات</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((m) => (
            <tr key={m.id}>
              <td>{measureTitle(m)}</td>
              <td>
                <Value v={m.target} empty="لم يُحدد" />
              </td>
              <td>
                <Actual m={m} />
              </td>
              <td className="pre-line">
                <Value v={m.notes} />
              </td>
              <td className="actions no-print edit-only">
                <button className="btn subtle small icon" aria-label={`تعديل ${measureTitle(m)}`} title="تعديل" onClick={() => onEdit(m)}>
                  <EditRegular />
                </button>
                <button className="btn subtle small icon danger" aria-label={`حذف ${measureTitle(m)}`} title="حذف" onClick={() => onDelete(m)}>
                  <DeleteRegular />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** تبويب «مؤشرات قياس الأثر» في ملف المبادرة: لكل برنامج عناصر شواهده، مع عدد الشواهد الموثقة وقيم القياس إن سُجلت */
export function ProgramImpactOverview() {
  const { data } = useStore()
  const crud = useMeasureCrud()
  const ini = data.initiative
  const first = (t?: string) => (t ?? '').split('\n').map((x) => x.trim()).find(Boolean) ?? ''
  return (
    <>
      <dl className="ini-stages3 pi-summary">
        <div className="b">
          <dt>خط الأساس</dt>
          <dd>
            <Value v={first(ini.baseline)} />
          </dd>
        </div>
        <div className="t">
          <dt>المستهدف</dt>
          <dd>
            <Value v={first(ini.target)} />
          </dd>
        </div>
        <div className="a">
          <dt>النتيجة الفعلية</dt>
          <dd>
            <Value v={first(ini.actualResults)} empty="لم تُسجل نتائج فعلية بعد" />
          </dd>
        </div>
      </dl>
      <p className="ipf-lead">
        مؤشرات قياس الأثر هي عناصر الشواهد نفسها في كل برنامج. يظهر عدد الشواهد الموثقة لكل عنصر تلقائيًا، ويظهر المستهدف والنتيجة الفعلية متى سُجلا.
      </p>
      <div className="ipf-blocks pi-blocks">
        {programs.map((p, n) => {
          const ev = data.evidence.filter((e) => e.programId === p.id)
          const ms = data.programMeasures.filter((m) => m.programId === p.id)
          const extra = ms.filter((m) => !activeKinds(p).some((k) => k.id === m.kindId))
          return (
            <section key={p.id} className="ipf-block">
              <h4>
                <span className="ipf-block-n" aria-hidden>
                  {String(n + 1).padStart(2, '0')}
                </span>
                {p.name}
              </h4>
              <ul className="pi-list">
                {activeKinds(p).map((k) => {
                  const count = ev.filter((e) => e.programKind === k.id).length
                  const m = ms.filter((x) => x.kindId === k.id)
                  return (
                    <li key={k.id}>
                      <div className="pi-row">
                        <span className="pi-name">{k.label}</span>
                        <span className={`pi-count${count ? ' has' : ''}`}>{count === 0 ? 'لا شواهد' : count === 1 ? 'شاهد واحد' : count === 2 ? 'شاهدان' : `${count} شواهد`}</span>
                      </div>
                      {m.map((x) => (
                        <MeasureLine key={x.id} m={x} onEdit={() => crud.openEdit(x)} />
                      ))}
                      {m.length === 0 && (
                        <button className="link-btn edit-only pi-add" onClick={() => crud.openNew(blank(p.id, k.id))}>
                          <AddRegular aria-hidden /> المستهدف والنتيجة
                        </button>
                      )}
                    </li>
                  )
                })}
                {extra.map((x) => (
                  <li key={x.id}>
                    <div className="pi-row">
                      <span className="pi-name">{measureTitle(x)}</span>
                    </div>
                    <MeasureLine m={x} onEdit={() => crud.openEdit(x)} />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      <p className="caption no-print" style={{ marginTop: 12 }}>
        <a href={href('impact')}>صفحة قياس الأثر</a> تعرض كل المؤشرات في جداول.
      </p>
      {crud.node}
    </>
  )
}

function MeasureLine({ m, onEdit }: { m: ProgramMeasure; onEdit: () => void }) {
  return (
    <div className="pi-measure">
      <span>
        المستهدف: <Value v={m.target} empty="لم يُحدد" />
      </span>
      <span>
        النتيجة: <Actual m={m} />
      </span>
      {m.notes && <span className="pi-notes">{m.notes}</span>}
      <button className="btn subtle small icon edit-only" aria-label={`تعديل قياس ${measureTitle(m)}`} title="تعديل" onClick={onEdit}>
        <EditRegular />
      </button>
    </div>
  )
}
