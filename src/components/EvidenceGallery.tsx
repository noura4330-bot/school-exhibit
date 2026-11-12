// معرض الشواهد المبسّط: كل شاهد صورة ووصف تحتها فقط (طلب مديرة النظام 2026-11-12).
// يُستعمل في صفحة الشواهد وفي ملف المبادرة. الحقول الأخرى في السجل تبقى كما هي ولا تُعرض.
import { useEffect, useRef, useState } from 'react'
import { AddRegular, DeleteRegular, EditRegular, ImageRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { Attachment, Evidence } from '../data/types'
import { deleteFile, getFile, saveFile } from '../lib/fileStore'
import { Drawer, useFeedback } from './feedback'
import { FieldShell } from './form'

export const blankEvidence = (): Evidence => ({
  ...makeBase(),
  title: '',
  description: '',
  type: 'image',
  executedOn: '',
  source: '',
  domain: '',
  links: [],
  reviewStatus: 'not_reviewed',
  owner: '',
  notes: '',
  url: '',
  files: [],
  sensitivity: 'internal',
  category: 'execution',
  proves: '',
  howLinked: '',
  visibleProof: '',
  needsCompletion: '',
  hasPersonalData: '',
})

const isImage = (a: Attachment) => a.type.startsWith('image/')
export const evidenceImage = (e: Evidence) => e.files.find(isImage)
/** الوصف المعروض: الوصف إن وُجد، وإلا العنوان (للشواهد القديمة) */
export const evidenceText = (e: Evidence) => e.description.trim() || e.title

/** عنوان مختصر يُشتق من الوصف، لأن بقية الموقع (التقارير والربط) تعرض الشاهد بعنوانه */
const titleFrom = (text: string) => {
  const first = text.trim().split('\n')[0].trim()
  return first.length > 60 ? `${first.slice(0, 60).trim()}…` : first
}

export function useImageUrl(fileId?: string) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    setUrl(null)
    if (!fileId) return
    let made: string | null = null
    let live = true
    getFile(fileId)
      .then((f) => {
        if (live && f && f.type.startsWith('image/')) {
          made = URL.createObjectURL(f.blob)
          setUrl(made)
        }
      })
      .catch(() => undefined)
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [fileId])
  return url
}

function EvidenceImage({ e, large }: { e: Evidence; large?: boolean }) {
  const img = evidenceImage(e)
  const url = useImageUrl(img?.id)
  if (url) return <img src={url} alt={evidenceText(e)} loading={large ? undefined : 'lazy'} decoding="async" />
  return (
    <div className="ev-noimg" aria-hidden>
      <ImageRegular />
      <span>{img ? 'جارٍ تحميل الصورة…' : 'لا توجد صورة'}</span>
    </div>
  )
}

export function EvidenceEditor({ initial, isNew, onClose }: { initial: Evidence; isNew: boolean; onClose: () => void }) {
  const { upsert } = useStore()
  const { toast, confirm } = useFeedback()
  const [image, setImage] = useState<Attachment | undefined>(evidenceImage(initial))
  const [text, setText] = useState(initial.description || (evidenceImage(initial) ? '' : initial.title))
  const [errors, setErrors] = useState<{ image?: string; text?: string }>({})
  const [busy, setBusy] = useState(false)
  const uploaded = useRef<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const preview = useImageUrl(image?.id)
  const dirty = image?.id !== evidenceImage(initial)?.id || text !== (initial.description || '')

  const pick = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors((x) => ({ ...x, image: 'اختاري ملف صورة (JPG أو PNG مثلًا).' }))
      return
    }
    setBusy(true)
    try {
      const meta = await saveFile(file)
      uploaded.current.push(meta.id)
      setImage(meta)
      setErrors((x) => ({ ...x, image: undefined }))
    } catch (err) {
      toast(`تعذر حفظ الصورة: ${(err as Error).message}`, 'error')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const cancel = async () => {
    if (dirty) {
      const ok = await confirm({ title: 'تجاهل التعديلات؟', body: 'لم يُحفظ هذا الشاهد.', confirmLabel: 'تجاهل التعديلات', danger: true })
      if (!ok) return
    }
    await Promise.all(uploaded.current.map((id) => deleteFile(id).catch(() => undefined)))
    onClose()
  }

  const save = async () => {
    const errs: typeof errors = {}
    if (!image) errs.image = 'أضيفي صورة الشاهد.'
    if (!text.trim()) errs.text = 'اكتبي وصف الشاهد.'
    if (errs.image || errs.text) {
      setErrors(errs)
      return
    }
    const oldImage = evidenceImage(initial)
    // تُستبدل الصورة القديمة فقط، وتبقى أي ملفات أخرى كانت مرفقة بالشاهد سابقًا
    const files = [image!, ...initial.files.filter((f) => f.id !== image!.id && f.id !== oldImage?.id)]
    upsert('evidence', { ...initial, files, description: text.trim(), title: titleFrom(text), type: 'image' })
    // تُحذف الصور التي رُفعت ثم استُبدلت، والصورة القديمة إن تغيرت
    const drop = uploaded.current.filter((id) => id !== image!.id)
    if (oldImage && oldImage.id !== image!.id) drop.push(oldImage.id)
    await Promise.all(drop.map((id) => deleteFile(id).catch(() => undefined)))
    toast(isNew ? 'تمت إضافة الشاهد.' : 'تم حفظ الشاهد.')
    onClose()
  }

  return (
    <Drawer
      title={isNew ? 'إضافة شاهد' : 'تعديل الشاهد'}
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
        <FieldShell id="ev-image" label="صورة الشاهد" required error={errors.image} full>
          <div className="ev-pick">
            {preview ? <img src={preview} alt="صورة الشاهد المختارة" /> : <div className="ev-noimg"><ImageRegular aria-hidden /><span>{busy ? 'جارٍ رفع الصورة…' : 'لم تُختر صورة بعد'}</span></div>}
            <input
              ref={inputRef}
              id="ev-image"
              type="file"
              accept="image/*"
              className="sr-only"
              aria-invalid={errors.image ? true : undefined}
              onChange={(ev) => void pick(ev.target.files?.[0])}
            />
            <button type="button" className="btn" onClick={() => inputRef.current?.click()} disabled={busy}>
              {image ? 'تغيير الصورة' : 'اختيار صورة'}
            </button>
          </div>
        </FieldShell>
        <FieldShell id="ev-text" label="وصف الشاهد" required error={errors.text} full>
          <textarea
            id="ev-text"
            className="input"
            rows={4}
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

/** عرض الشاهد مكبّرًا: الصورة ثم الوصف */
export function EvidenceLightbox({ e, onClose, onEdit, onDelete }: { e: Evidence; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <Drawer
      title="الشاهد"
      onClose={onClose}
      footer={
        <>
          <button className="btn danger edit-only" onClick={onDelete}>
            <DeleteRegular /> حذف
          </button>
          <span className="spacer" />
          <button className="btn primary edit-only" onClick={onEdit}>
            <EditRegular /> تعديل
          </button>
        </>
      }
    >
      <figure className="ev-large">
        <EvidenceImage e={e} large />
        <figcaption className="pre-line">{evidenceText(e)}</figcaption>
      </figure>
    </Drawer>
  )
}

/** شبكة الشواهد مع الإضافة والتعديل والحذف لمديرة النظام. limit لعرض جزء منها فقط */
export function EvidenceGallery({
  focusId,
  onFocus,
  limit,
  only,
  noAdd,
}: {
  focusId?: string
  onFocus?: (id: string | null) => void
  limit?: number
  only?: (e: Evidence) => boolean
  noAdd?: boolean
}) {
  const { data, remove } = useStore()
  const { confirm, toast } = useFeedback()
  const [editing, setEditing] = useState<{ e: Evidence; isNew: boolean } | null>(null)
  const [localView, setLocalView] = useState<string | null>(null)
  const viewId = onFocus ? focusId : localView
  const setView = onFocus ?? setLocalView

  const [opened, setOpened] = useState(false)
  if (focusId === 'new' && !opened) {
    setOpened(true)
    setEditing({ e: blankEvidence(), isNew: true })
  }

  const all = data.evidence.filter((e) => !only || only(e)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const items = limit ? all.slice(0, limit) : all
  const viewing = viewId && viewId !== 'new' ? data.evidence.find((e) => e.id === viewId) ?? null : null

  const askDelete = async (e: Evidence) => {
    const ok = await confirm({
      title: 'حذف الشاهد؟',
      body: 'ستُحذف صورة الشاهد ووصفه. لا يمكن التراجع إلا من نسخة احتياطية.',
      confirmLabel: 'حذف الشاهد',
      danger: true,
    })
    if (!ok) return
    await remove('evidence', e.id)
    setView(null)
    toast('تم حذف الشاهد.')
  }

  return (
    <>
      {!noAdd && (
        <div className="row ev-actions edit-only">
          <button className="btn primary" onClick={() => setEditing({ e: blankEvidence(), isNew: true })}>
            <AddRegular /> إضافة شاهد
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="muted">لم تُضف شواهد بعد.</p>
      ) : (
        <ul className="ev-grid">
          {items.map((e) => (
            <li key={e.id} className="ev-card">
              <button className="ev-open" onClick={() => setView(e.id)} aria-label={`عرض الشاهد: ${evidenceText(e)}`}>
                <EvidenceImage e={e} />
              </button>
              <p className="ev-text pre-line">{evidenceText(e)}</p>
              <div className="ev-tools edit-only">
                <button className="btn subtle small icon" aria-label={`تعديل الشاهد: ${e.title}`} title="تعديل" onClick={() => setEditing({ e, isNew: false })}>
                  <EditRegular />
                </button>
                <button className="btn subtle small icon danger" aria-label={`حذف الشاهد: ${e.title}`} title="حذف" onClick={() => void askDelete(e)}>
                  <DeleteRegular />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {viewing && !editing && (
        <EvidenceLightbox
          e={viewing}
          onClose={() => setView(null)}
          onEdit={() => setEditing({ e: viewing, isNew: false })}
          onDelete={() => void askDelete(viewing)}
        />
      )}
      {editing && (
        <EvidenceEditor
          initial={editing.e}
          isNew={editing.isNew}
          onClose={() => {
            setEditing(null)
            if (focusId === 'new') setView(null)
          }}
        />
      )}
    </>
  )
}
