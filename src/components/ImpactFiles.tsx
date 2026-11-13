// المرفقات الداعمة لقياس الأثر (طلب مديرة النظام 2026-11-13): ملفات ترفعها المديرة مع وصف لكل ملف،
// ويشاهدها الزوار فقط. مستقلة عن الشواهد ولا ترتبط بها.
import { useRef, useState } from 'react'
import { AddRegular, AttachRegular, DeleteRegular, EditRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { Attachment, ImpactFile } from '../data/types'
import { deleteFile, saveFile } from '../lib/fileStore'
import { formatSize } from '../lib/util'
import { Drawer, useFeedback } from './feedback'
import { AttachmentList, FieldShell } from './form'
import { Section } from './ui'

const blank = (): ImpactFile => ({ ...makeBase(), description: '', files: [] })

function ImpactFileEditor({ initial, isNew, onClose }: { initial: ImpactFile; isNew: boolean; onClose: () => void }) {
  const { upsert } = useStore()
  const { toast, confirm } = useFeedback()
  const [file, setFile] = useState<Attachment | undefined>(initial.files[0])
  const [text, setText] = useState(initial.description)
  const [errors, setErrors] = useState<{ file?: string; text?: string }>({})
  const [busy, setBusy] = useState(false)
  const uploaded = useRef<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const dirty = file?.id !== initial.files[0]?.id || text !== initial.description

  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try {
      const meta = await saveFile(f)
      uploaded.current.push(meta.id)
      setFile(meta)
      setErrors((x) => ({ ...x, file: undefined }))
    } catch (err) {
      toast(`تعذر حفظ الملف: ${(err as Error).message}`, 'error')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const cancel = async () => {
    if (dirty) {
      const ok = await confirm({ title: 'تجاهل التعديلات؟', body: 'لم يُحفظ هذا المرفق.', confirmLabel: 'تجاهل التعديلات', danger: true })
      if (!ok) return
    }
    await Promise.all(uploaded.current.map((id) => deleteFile(id).catch(() => undefined)))
    onClose()
  }

  const save = async () => {
    const errs: typeof errors = {}
    if (!file) errs.file = 'أضيفي الملف.'
    if (!text.trim()) errs.text = 'اكتبي وصف المرفق.'
    if (errs.file || errs.text) return setErrors(errs)
    upsert('impactFiles', { ...initial, description: text.trim(), files: [file!] })
    const drop = uploaded.current.filter((id) => id !== file!.id)
    const old = initial.files[0]
    if (old && old.id !== file!.id) drop.push(old.id)
    await Promise.all(drop.map((id) => deleteFile(id).catch(() => undefined)))
    toast(isNew ? 'تمت إضافة المرفق.' : 'تم حفظ المرفق.')
    onClose()
  }

  return (
    <Drawer
      title={isNew ? 'إضافة مرفق داعم' : 'تعديل المرفق'}
      onClose={() => void cancel()}
      footer={
        <>
          <button className="btn" onClick={() => void cancel()}>
            إلغاء
          </button>
          <button className="btn primary edit-only" onClick={() => void save()} disabled={busy}>
            حفظ
          </button>
        </>
      }
    >
      <div className="stack">
        <FieldShell id="if-file" label="الملف" required error={errors.file} full>
          <div className="if-pick">
            <AttachRegular aria-hidden />
            <span className="if-name">
              {busy ? 'جارٍ رفع الملف…' : file ? <><bdi>{file.name}</bdi> <span className="caption">({formatSize(file.size)})</span></> : 'لم يُختر ملف بعد'}
            </span>
            <input
              ref={inputRef}
              id="if-file"
              type="file"
              className="sr-only"
              aria-invalid={errors.file ? true : undefined}
              onChange={(ev) => void pick(ev.target.files?.[0])}
            />
            <button type="button" className="btn small" onClick={() => inputRef.current?.click()} disabled={busy}>
              {file ? 'تغيير الملف' : 'اختيار ملف'}
            </button>
          </div>
        </FieldShell>
        <FieldShell id="if-text" label="وصف المرفق" required error={errors.text} full>
          <textarea
            id="if-text"
            className="input"
            rows={3}
            value={text}
            aria-invalid={errors.text ? true : undefined}
            onChange={(ev) => {
              setText(ev.target.value)
              if (errors.text) setErrors((x) => ({ ...x, text: undefined }))
            }}
          />
        </FieldShell>
      </div>
    </Drawer>
  )
}

export function ImpactFiles() {
  const { data, remove } = useStore()
  const { confirm, toast } = useFeedback()
  const [editing, setEditing] = useState<{ x: ImpactFile; isNew: boolean } | null>(null)
  const items = [...(data.impactFiles ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const askDelete = async (x: ImpactFile) => {
    const ok = await confirm({ title: 'حذف المرفق؟', body: 'سيُحذف الملف ووصفه. لا يمكن التراجع إلا من نسخة احتياطية.', confirmLabel: 'حذف المرفق', danger: true })
    if (!ok) return
    await remove('impactFiles', x.id)
    toast('تم حذف المرفق.')
  }

  return (
    <Section
      title="المرفقات الداعمة لقياس الأثر"
      sub="ملفات تدعم نتائج المؤشرات، مع وصف لكل ملف."
      actions={
        <button className="btn primary edit-only" onClick={() => setEditing({ x: blank(), isNew: true })}>
          <AddRegular /> إضافة مرفق
        </button>
      }
    >
      {items.length === 0 ? (
        <p className="muted">لم تُضف مرفقات بعد.</p>
      ) : (
        <ol className="if-list">
          {items.map((x) => (
            <li key={x.id} className="if-item">
              <p className="if-desc pre-line">{x.description}</p>
              <AttachmentList items={x.files} />
              <div className="if-tools edit-only">
                <button className="btn subtle small icon" aria-label={`تعديل المرفق: ${x.description}`} title="تعديل" onClick={() => setEditing({ x, isNew: false })}>
                  <EditRegular />
                </button>
                <button className="btn subtle small icon danger" aria-label={`حذف المرفق: ${x.description}`} title="حذف" onClick={() => void askDelete(x)}>
                  <DeleteRegular />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {editing && <ImpactFileEditor initial={editing.x} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </Section>
  )
}
