// نماذج مبنية من تعريف الحقول، مع التحقق قبل الحفظ.
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { cloudEnabled } from '../lib/cloud'
import {
  ArrowDownloadRegular,
  AttachRegular,
  DeleteRegular,
  ErrorCircleRegular,
  OpenRegular,
  SearchRegular,
} from '@fluentui/react-icons'
import type { Option } from '../data/options'
import type { Attachment, Evidence } from '../data/types'
import { downloadStoredFile, openStoredFile, saveFile } from '../lib/fileStore'
import { formatDate, formatSize, isValidUrl, matches } from '../lib/util'
import { useFeedback } from './feedback'

export type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'url' | 'attachments' | 'checkbox' | 'heading'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: Option[]
  hint?: string
  full?: boolean
  placeholder?: string
  accept?: string
  rows?: number
  /** تحقق إضافي يعيد رسالة خطأ أو null */
  validate?: (value: unknown, record: Record<string, unknown>) => string | null
}

export type Errors = Record<string, string>

export function validateFields(fields: FieldDef[], record: Record<string, unknown>): Errors {
  const errors: Errors = {}
  for (const f of fields) {
    if (f.type === 'heading') continue
    const v = record[f.key]
    const empty = v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)
    if (f.required && empty) {
      errors[f.key] = `حقل «${f.label}» مطلوب.`
      continue
    }
    if (!empty && f.type === 'url' && typeof v === 'string' && !isValidUrl(v.trim())) {
      errors[f.key] = 'أدخلي رابطًا صحيحًا يبدأ بـ https:// أو http://'
      continue
    }
    if (!empty && f.type === 'number' && typeof v === 'string' && (!/^\d+(\.\d+)?$/.test(v.trim()) || Number(v) < 0)) {
      errors[f.key] = 'أدخلي رقمًا صحيحًا موجبًا.'
      continue
    }
    const custom = f.validate?.(v, record)
    if (custom) errors[f.key] = custom
  }
  return errors
}

export function FieldShell({
  id,
  label,
  required,
  hint,
  error,
  full,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  full?: boolean
  children: ReactNode
}) {
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && (
          <span className="req" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <div className="hint" id={`${id}-hint`}>
          {hint}
        </div>
      )}
      {error && (
        <div className="error" id={`${id}-err`}>
          <ErrorCircleRegular aria-hidden /> {error}
        </div>
      )}
    </div>
  )
}

export function FormFields({
  fields,
  value,
  onChange,
  errors,
  onUploaded,
}: {
  fields: FieldDef[]
  value: Record<string, unknown>
  onChange: (key: string, v: unknown) => void
  errors: Errors
  onUploaded?: (a: Attachment) => void
}) {
  const uid = useId()
  return (
    <div className="form-grid">
      {fields.map((f) => {
        if (f.type === 'heading')
          return (
            <h3 key={f.key} className="form-section-title">
              {f.label}
            </h3>
          )
        const id = `${uid}-${f.key}`
        const err = errors[f.key]
        const v = value[f.key]
        const common = {
          id,
          'aria-invalid': err ? true : undefined,
          'aria-describedby': err ? `${id}-err` : f.hint ? `${id}-hint` : undefined,
          'aria-required': f.required || undefined,
        }
        const full = f.full ?? (f.type === 'textarea' || f.type === 'attachments')
        if (f.type === 'checkbox') {
          return (
            <div key={f.key} className={`field${full ? ' full' : ''}`}>
              <label className="check" htmlFor={id} style={{ fontWeight: 'normal' }}>
                <input id={id} type="checkbox" checked={Boolean(v)} onChange={(e) => onChange(f.key, e.target.checked)} />
                <span>
                  {f.label}
                  {f.hint && <span className="hint" style={{ display: 'block' }}>{f.hint}</span>}
                </span>
              </label>
            </div>
          )
        }
        let control: ReactNode
        switch (f.type) {
          case 'textarea':
            control = (
              <textarea
                {...common}
                className="textarea"
                rows={f.rows ?? 3}
                value={String(v ?? '')}
                placeholder={f.placeholder}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            )
            break
          case 'select':
            control = (
              <select {...common} className="select" value={String(v ?? '')} onChange={(e) => onChange(f.key, e.target.value)}>
                {!f.required && !(f.options ?? []).some((o) => o.value === '') && <option value="">— اختاري —</option>}
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )
            break
          case 'attachments':
            control = (
              <AttachmentsInput
                id={id}
                value={(v as Attachment[]) ?? []}
                accept={f.accept}
                onChange={(list) => onChange(f.key, list)}
                onUploaded={onUploaded}
              />
            )
            break
          default:
            control = (
              <input
                {...common}
                className="input"
                type={f.type === 'number' ? 'text' : f.type}
                inputMode={f.type === 'number' ? 'decimal' : undefined}
                dir={f.type === 'url' ? 'ltr' : undefined}
                value={String(v ?? '')}
                placeholder={f.placeholder ?? (f.type === 'url' ? 'https://' : undefined)}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            )
        }
        return (
          <FieldShell key={f.key} id={id} label={f.label} required={f.required} hint={f.hint} error={err} full={full}>
            {control}
          </FieldShell>
        )
      })}
    </div>
  )
}

/** رفع ملفات فعلي إلى مخزن المتصفح المحلي */
export function AttachmentsInput({
  id,
  value,
  onChange,
  accept,
  onUploaded,
}: {
  id: string
  value: Attachment[]
  onChange: (v: Attachment[]) => void
  accept?: string
  onUploaded?: (a: Attachment) => void
}) {
  const { toast } = useFeedback()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const added: Attachment[] = []
    for (const file of Array.from(files)) {
      try {
        const meta = await saveFile(file)
        added.push(meta)
        onUploaded?.(meta)
      } catch (e) {
        toast(`تعذر حفظ «${file.name}»: ${(e as Error).message}`, 'error')
      }
    }
    setBusy(false)
    if (added.length) onChange([...value, ...added])
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      {value.length > 0 && (
        <AttachmentList items={value} onRemove={(a) => onChange(value.filter((x) => x.id !== a.id))} />
      )}
      <div className="dropzone">
        <AttachRegular aria-hidden />
        <span style={{ flex: 1 }}>{busy ? 'جارٍ الحفظ…' : cloudEnabled ? 'تُحفظ الملفات في التخزين الخاص للمعرض، ولا تُنزَّل إلا للمصرّح لهم.' : 'تُحفظ الملفات في متصفح هذا الجهاز فقط.'}</span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          onChange={(e) => void onFiles(e.target.files)}
        />
        <button type="button" className="btn small" onClick={() => inputRef.current?.click()} disabled={busy}>
          اختيار ملفات
        </button>
      </div>
    </div>
  )
}

export function AttachmentList({ items, onRemove }: { items: Attachment[]; onRemove?: (a: Attachment) => void }) {
  const { toast } = useFeedback()
  const missing = () => toast(cloudEnabled ? 'الملف غير موجود في قاعدة البيانات، أو تعذر تنزيله. تحققي من الاتصال.' : 'الملف غير موجود في متصفح هذا الجهاز. ربما أُضيف من جهاز آخر أو حُذفت بيانات المتصفح.', 'error')
  return (
    <ul className="attachments" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {items.map((a) => (
        <li key={a.id} className="attachment">
          <AttachRegular aria-hidden />
          <span className="name" title={a.name}>
            <bdi>{a.name}</bdi>
          </span>
          <span className="caption nowrap">{formatSize(a.size)}</span>
          <button
            type="button"
            className="btn subtle small icon"
            aria-label={`فتح ${a.name}`}
            title="فتح ومعاينة"
            onClick={async () => ((await openStoredFile(a.id).catch(() => false)) ? undefined : missing())}
          >
            <OpenRegular />
          </button>
          <button
            type="button"
            className="btn subtle small icon"
            aria-label={`تنزيل ${a.name}`}
            title="تنزيل"
            onClick={async () => ((await downloadStoredFile(a.id).catch(() => false)) ? undefined : missing())}
          >
            <ArrowDownloadRegular />
          </button>
          {onRemove && (
            <button
              type="button"
              className="btn subtle small icon danger edit-only"
              aria-label={`إزالة ${a.name}`}
              title="إزالة"
              onClick={() => onRemove(a)}
            >
              <DeleteRegular />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

/** اختيار شواهد مسجلة لربطها بسجل */
export function EvidencePicker({
  evidence,
  selected,
  onChange,
  label = 'الشواهد المرتبطة',
}: {
  evidence: Evidence[]
  selected: string[]
  onChange: (ids: string[]) => void
  label?: string
}) {
  const [q, setQ] = useState('')
  const uid = useId()
  const list = useMemo(
    () =>
      evidence
        .filter((e) => selected.includes(e.id) || matches(q, e.title, e.description))
        .sort((a, b) => Number(selected.includes(b.id)) - Number(selected.includes(a.id))),
    [evidence, q, selected],
  )
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <fieldset className="field full" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label" style={{ fontWeight: 600, marginBottom: 4 }}>
        {label} <span className="caption">({selected.length} محدد)</span>
      </legend>
      {evidence.length === 0 ? (
        <div className="hint">لا توجد شواهد مسجلة بعد. أضيفيها من صفحة «الشواهد والأدلة» ثم اربطيها هنا.</div>
      ) : (
        <>
          <div className="search-input">
            <SearchRegular aria-hidden />
            <input
              className="input"
              id={`${uid}-q`}
              aria-label="بحث في الشواهد"
              placeholder="ابحثي بعنوان الشاهد"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="surface" style={{ maxHeight: 220, overflowY: 'auto', marginTop: 6 }}>
            {list.length === 0 && <div className="caption" style={{ padding: 12 }}>لا نتائج مطابقة.</div>}
            {list.map((e) => (
              <label key={e.id} className="check" style={{ padding: '8px 12px', borderBottom: '1px solid var(--stroke3)' }}>
                <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} />
                <span>
                  {e.title}
                  <span className="caption" style={{ display: 'block' }}>
                    {formatDate(e.executedOn)}
                    {e.files.length === 0 && !e.url ? ' · بلا ملف أو رابط' : ''}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="hint">ربط الشاهد لا يعني أنه يثبت استيفاء المؤشر؛ وثّقي ما يثبته داخل بطاقة الشاهد.</div>
        </>
      )}
    </fieldset>
  )
}
