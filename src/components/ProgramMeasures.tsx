// مؤشرات قياس أثر البرامج الثمانية: لكل برنامج مؤشر أو أكثر (المؤشر، المستهدف، النتيجة الفعلية، وصف مختصر)
import { AddRegular, DeleteRegular, EditRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { ProgramMeasure } from '../data/types'
import { programById, programs } from '../data/programs'
import { useCrud, type EditorConfig } from './records'
import type { FieldDef } from './form'
import { Section, Value } from './ui'

const fields: FieldDef[] = [
  { key: 'programId', label: 'اسم البرنامج', type: 'select', required: true, full: true, options: programs.map((p, n) => ({ value: p.id, label: `${n + 1}. ${p.name}` })) },
  { key: 'title', label: 'مؤشر القياس', type: 'text', required: true, full: true, hint: 'مثل: نسبة الطالبات المتدربات على المنصة.' },
  { key: 'target', label: 'المستهدف', type: 'text' },
  { key: 'actual', label: 'النتيجة الفعلية', type: 'text' },
  { key: 'notes', label: 'وصف مختصر للنتيجة', type: 'textarea', rows: 3, full: true },
]

const config: EditorConfig<ProgramMeasure> = { title: 'مؤشر قياس', fields }

export function ProgramMeasures() {
  const { data } = useStore()
  const crud = useCrud<ProgramMeasure>('programMeasures', config, (m) => m.title)
  const create = (programId = ''): ProgramMeasure => ({ ...makeBase(), programId, title: '', target: '', actual: '', notes: '' })
  const orphan = data.programMeasures.filter((m) => !programById(m.programId))

  return (
    <Section
      title="مؤشرات قياس أثر البرامج"
      sub="لكل برنامج مؤشر قياس أو أكثر، مع المستهدف والنتيجة الفعلية."
      actions={
        <button className="btn primary edit-only" onClick={() => crud.openNew(create())}>
          <AddRegular /> إضافة مؤشر
        </button>
      }
    >
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
                <button className="btn small edit-only" onClick={() => crud.openNew(create(p.id))} aria-label={`إضافة مؤشر لبرنامج ${p.name}`}>
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
              <td data-label="مؤشر القياس">{m.title}</td>
              <td data-label="المستهدف">
                <Value v={m.target} empty="لم يُحدد" />
              </td>
              <td data-label="النتيجة الفعلية">
                <Value v={m.actual} empty="لم تُقس بعد" />
              </td>
              <td data-label="وصف النتيجة" className="pre-line">
                <Value v={m.notes} />
              </td>
              <td className="actions no-print edit-only">
                <button className="btn subtle small icon" aria-label={`تعديل ${m.title}`} title="تعديل" onClick={() => onEdit(m)}>
                  <EditRegular />
                </button>
                <button className="btn subtle small icon danger" aria-label={`حذف ${m.title}`} title="حذف" onClick={() => onDelete(m)}>
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
