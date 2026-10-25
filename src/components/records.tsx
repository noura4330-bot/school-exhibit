// إدارة السجلات العامة: نموذج الإضافة والتعديل، وعرض التفاصيل، والحذف بعد التأكيد، وعرض القائمة أو الجدول.
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { DeleteRegular, EditRegular, GridRegular, TableRegular } from '@fluentui/react-icons'
import type { Attachment, BaseRecord, CollectionKey, Evidence, RefKind } from '../data/types'
import { useStore } from '../data/store'
import { evidenceFor } from '../data/selectors'
import { labelOf } from '../data/options'
import { deleteFile } from '../lib/fileStore'
import { formatDate } from '../lib/util'
import { Drawer, useFeedback } from './feedback'
import { AttachmentList, EvidencePicker, FormFields, validateFields, type Errors, type FieldDef } from './form'
import { Badge, DescList, StatusBadge, Value } from './ui'
import { reviewStatuses } from '../data/options'
import { href } from '../lib/router'

const attachmentIds = (rec: object): string[] =>
  Object.values(rec as Record<string, unknown>).flatMap((v) =>
    Array.isArray(v) && v.every((x) => x && typeof x === 'object' && 'size' in x) ? (v as Attachment[]).map((a) => a.id) : [],
  )

export interface EditorConfig<T> {
  title: string
  fields: FieldDef[]
  linkKind?: RefKind
  linkLabel?: string
  /** تحقق خاص بالسجل بعد تحقق الحقول (مثل منع حالة «مطبق» دون شاهد) */
  extraValidate?: (draft: T, evidenceIds: string[]) => Errors
  intro?: (draft: T) => ReactNode
  /** الحقول المعروضة عند القراءة (لإخفاء ما لا يجوز عرضه، مثل الصور دون موافقات) */
  viewFields?: (record: T) => FieldDef[]
  viewIntro?: (record: T) => ReactNode
  /** محتوى بعد تفاصيل السجل عند العرض */
  viewOutro?: (record: T) => ReactNode
  /** محتوى إضافي في النموذج بعد الحقول (مثل ربط العنصر بقسم من الوثيقة المرجعية) */
  extra?: (draft: T, set: (key: string, v: unknown) => void, errors: Errors) => ReactNode
  /** تعديل السجل قبل حفظه (مثل حفظ الإصدار السابق في السجل التاريخي) */
  beforeSave?: (draft: T, initial: T) => T
  /** إخفاء زر الحذف (للسجلات المرجعية التي ترتبط بها عناصر أخرى) */
  noDelete?: boolean
}

export function RecordEditor<T extends BaseRecord>({
  config,
  initial,
  isNew,
  onSave,
  onClose,
}: {
  config: EditorConfig<T>
  initial: T
  isNew: boolean
  onSave: (draft: T) => void
  onClose: () => void
}) {
  const { data, setEvidenceLinks } = useStore()
  const { toast, confirm } = useFeedback()
  const [draft, setDraft] = useState<T>(initial)
  const [errors, setErrors] = useState<Errors>({})
  const initialLinks = useMemo(
    () => (config.linkKind ? evidenceFor(data, { kind: config.linkKind, id: initial.id }).map((e) => e.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [links, setLinks] = useState<string[]>(initialLinks)
  const uploaded = useRef<string[]>([])
  const dirty = useRef(false)

  const set = (key: string, v: unknown) => {
    dirty.current = true
    setDraft((d) => ({ ...d, [key]: v }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }))
  }

  const cancel = async () => {
    if (dirty.current) {
      const ok = await confirm({
        title: 'تجاهل التعديلات؟',
        body: 'لم تُحفظ التعديلات التي أجريتِها على هذا السجل.',
        confirmLabel: 'تجاهل التعديلات',
        danger: true,
      })
      if (!ok) return
    }
    await Promise.all(uploaded.current.map((id) => deleteFile(id).catch(() => undefined)))
    onClose()
  }

  const save = async () => {
    const errs = { ...validateFields(config.fields, draft as unknown as Record<string, unknown>), ...(config.extraValidate?.(draft, links) ?? {}) }
    Object.keys(errs).forEach((k) => !errs[k] && delete errs[k])
    if (Object.keys(errs).length) {
      setErrors(errs)
      toast('تعذر الحفظ. راجعي الحقول المظللة باللون الأحمر.', 'error')
      setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0)
      return
    }
    const keep = new Set(attachmentIds(draft))
    const removed = attachmentIds(initial).filter((id) => !keep.has(id))
    onSave(config.beforeSave ? config.beforeSave(draft, initial) : draft)
    if (config.linkKind) setEvidenceLinks({ kind: config.linkKind, id: draft.id }, links)
    await Promise.all(removed.map((id) => deleteFile(id).catch(() => undefined)))
    toast(isNew ? 'تمت الإضافة والحفظ.' : 'تم حفظ التعديلات.')
    onClose()
  }

  return (
    <Drawer
      title={`${isNew ? 'إضافة' : 'تعديل'}: ${config.title}`}
      onClose={() => void cancel()}
      footer={
        <>
          <button className="btn" onClick={() => void cancel()}>
            إلغاء
          </button>
          <button className="btn primary" onClick={() => void save()}>
            حفظ
          </button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        noValidate
      >
        {config.intro?.(draft)}
        {Object.values(errors).some(Boolean) && errors._form && <div className="error">{errors._form}</div>}
        <FormFields
          fields={config.fields}
          value={draft as unknown as Record<string, unknown>}
          onChange={set}
          errors={errors}
          onUploaded={(a) => uploaded.current.push(a.id)}
        />
        {config.extra?.(draft, set, errors)}
        {config.linkKind && (
          <div className="form-grid">
            <h3 className="form-section-title">{config.linkLabel ?? 'الشواهد'}</h3>
            <EvidencePicker
              evidence={data.evidence}
              selected={links}
              onChange={(ids) => {
                dirty.current = true
                setLinks(ids)
                if (errors._links) setErrors((e) => ({ ...e, _links: '' }))
              }}
            />
            {errors._links && <div className="error full">{errors._links}</div>}
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Drawer>
  )
}

/** عرض قيم السجل للقراءة */
export function RecordDetails({
  fields,
  record,
  linkKind,
}: {
  fields: FieldDef[]
  record: Record<string, unknown> & { id: string }
  linkKind?: RefKind
}) {
  const { data } = useStore()
  const items = fields
    .filter((f) => f.type !== 'heading')
    .map((f) => {
      const v = record[f.key]
      let value: ReactNode
      if (f.type === 'attachments') {
        const list = (v as Attachment[]) ?? []
        value = list.length ? <AttachmentList items={list} /> : <Value v="" empty="لا توجد ملفات" />
      } else if (f.type === 'select') {
        value = <Value v={v ? labelOf(f.options ?? [], String(v)) : ''} />
      } else if (f.type === 'date') {
        value = <Value v={v ? formatDate(String(v)) : ''} />
      } else if (f.type === 'checkbox') {
        value = v ? 'نعم' : 'لا'
      } else if (f.type === 'url') {
        value = v ? (
          <a href={String(v)} target="_blank" rel="noopener noreferrer">
            <bdi className="ltr">{String(v)}</bdi>
          </a>
        ) : (
          <Value v="" />
        )
      } else value = <Value v={String(v ?? '')} />
      return { label: f.label, value }
    })
  const linked = linkKind ? evidenceFor(data, { kind: linkKind, id: record.id }) : []
  return (
    <div className="stack">
      <DescList items={items} />
      {linkKind && (
        <div>
          <h3 style={{ marginBottom: 8 }}>الشواهد المرتبطة</h3>
          <EvidenceMiniList items={linked} />
        </div>
      )}
    </div>
  )
}

export function EvidenceMiniList({ items }: { items: Evidence[] }) {
  if (!items.length) return <Value v="" empty="لا يرتبط به أي شاهد بعد." />
  return (
    <ul className="list surface">
      {items.map((e) => (
        <li key={e.id}>
          <div className="item-main">
            <a className="item-title" href={href('evidence', e.id)}>
              {e.title}
            </a>
            <div className="item-meta">
              <span>{formatDate(e.executedOn)}</span>
              <StatusBadge options={reviewStatuses} value={e.reviewStatus} />
              {e.files.length === 0 && !e.url && <Badge tone="warning">بلا ملف أو رابط</Badge>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export interface Column<T> {
  label: string
  render: (item: T) => ReactNode
  className?: string
}

/** جدول أو قائمة للسجلات مع أزرار التعديل والحذف */
export function RecordCollection<T extends BaseRecord>({
  items,
  columns,
  getTitle,
  meta,
  onOpen,
  onEdit,
  onDelete,
  empty,
  view,
}: {
  items: T[]
  columns: Column<T>[]
  getTitle: (item: T) => string
  meta?: (item: T) => ReactNode
  onOpen: (item: T) => void
  onEdit: (item: T) => void
  onDelete: (item: T) => void
  empty: ReactNode
  view: 'table' | 'list'
}) {
  if (!items.length) return <>{empty}</>
  const actions = (item: T) => (
    <>
      <button className="btn subtle small icon" aria-label={`تعديل ${getTitle(item)}`} title="تعديل" onClick={() => onEdit(item)}>
        <EditRegular />
      </button>
      <button
        className="btn subtle small icon danger"
        aria-label={`حذف ${getTitle(item)}`}
        title="حذف"
        onClick={() => onDelete(item)}
      >
        <DeleteRegular />
      </button>
    </>
  )
  if (view === 'list')
    return (
      <ul className="list">
        {items.map((item) => (
          <li key={item.id}>
            <div className="item-main">
              <button className="btn subtle" style={{ padding: 0, minHeight: 0, border: 0 }} onClick={() => onOpen(item)}>
                <span className="item-title">{getTitle(item) || 'بلا عنوان'}</span>
              </button>
              {meta && <div className="item-meta">{meta(item)}</div>}
            </div>
            <div className="row no-print" style={{ flexWrap: 'nowrap' }}>
              {actions(item)}
            </div>
          </li>
        ))}
      </ul>
    )
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">العنوان</th>
            {columns.map((c) => (
              <th scope="col" key={c.label}>
                {c.label}
              </th>
            ))}
            <th scope="col" className="no-print">
              <span className="sr-only">إجراءات</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="title-cell">
                <button onClick={() => onOpen(item)}>{getTitle(item) || 'بلا عنوان'}</button>
              </td>
              {columns.map((c) => (
                <td key={c.label} className={c.className}>
                  {c.render(item)}
                </td>
              ))}
              <td className="actions no-print">{actions(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ViewToggle({ view, onChange }: { view: 'table' | 'list'; onChange: (v: 'table' | 'list') => void }) {
  return (
    <div className="segmented" role="group" aria-label="طريقة العرض">
      <button aria-pressed={view === 'table'} onClick={() => onChange('table')}>
        <TableRegular aria-hidden /> جدول
      </button>
      <button aria-pressed={view === 'list'} onClick={() => onChange('list')}>
        <GridRegular aria-hidden /> قائمة
      </button>
    </div>
  )
}

/** حالة الإضافة والتعديل والعرض والحذف لمجموعة سجلات */
export function useCrud<T extends BaseRecord>(key: CollectionKey, config: EditorConfig<T>, titleOf: (t: T) => string) {
  const { upsert, remove } = useStore()
  const { confirm, toast } = useFeedback()
  const [editing, setEditing] = useState<{ item: T; isNew: boolean } | null>(null)
  const [viewing, setViewing] = useState<T | null>(null)

  const askDelete = async (item: T) => {
    const ok = await confirm({
      title: 'حذف السجل؟',
      body: (
        <>
          سيُحذف «{titleOf(item) || 'بلا عنوان'}» وملفاته المرفقة من هذا الجهاز، وتُزال روابطه بالشواهد. لا يمكن التراجع إلا من نسخة
          احتياطية.
        </>
      ),
      confirmLabel: 'حذف',
      danger: true,
    })
    if (!ok) return
    await remove(key, item.id)
    setViewing(null)
    toast('تم الحذف.')
  }

  const node = (
    <>
      {editing && (
        <RecordEditor<T>
          config={config}
          initial={editing.item}
          isNew={editing.isNew}
          onSave={(d) => upsert(key, d as never)}
          onClose={() => setEditing(null)}
        />
      )}
      {viewing && !editing && (
        <Drawer
          title={titleOf(viewing) || config.title}
          onClose={() => setViewing(null)}
          footer={
            <>
              {!config.noDelete && (
                <button className="btn danger" onClick={() => void askDelete(viewing)}>
                  <DeleteRegular /> حذف
                </button>
              )}
              <span className="spacer" />
              <button
                className="btn primary"
                onClick={() => {
                  setEditing({ item: viewing, isNew: false })
                  setViewing(null)
                }}
              >
                <EditRegular /> تعديل
              </button>
            </>
          }
        >
          {config.viewIntro?.(viewing)}
          <RecordDetails
            fields={config.viewFields?.(viewing) ?? config.fields}
            record={viewing as unknown as Record<string, unknown> & { id: string }}
            linkKind={config.linkKind}
          />
          {config.viewOutro?.(viewing)}
        </Drawer>
      )}
    </>
  )

  return {
    node,
    openNew: (item: T) => setEditing({ item, isNew: true }),
    openEdit: (item: T) => setEditing({ item, isNew: false }),
    openView: (item: T) => setViewing(item),
    close: () => {
      setViewing(null)
      setEditing(null)
    },
    askDelete,
  }
}
