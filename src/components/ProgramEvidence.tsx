// شواهد البرامج: اختيار البرنامج ونوع الشاهد ورفع 4 إلى 6 صور، والوصف يُملأ تلقائيًا.
// تُحفظ في مجموعة الشواهد نفسها (evidence) مع programId وprogramKind، فتشملها النسخ الاحتياطية والحذف والتقارير.
import { useEffect, useRef, useState } from 'react'
import {
  AddRegular,
  ChevronLeftRegular,
  ChevronRightRegular,
  DeleteRegular,
  DismissRegular,
  DocumentPdfRegular,
  EditRegular,
  ImageRegular,
} from '@fluentui/react-icons'
import { useStore } from '../data/store'
import type { Attachment, Evidence } from '../data/types'
import { kindOf, MAX_IMAGES, MIN_IMAGES, programById, programs, type ProgramDef } from '../data/programs'
import { deleteFile, saveFile } from '../lib/fileStore'
import { shrinkImage } from '../lib/imageShrink'
import { Drawer, Modal, useFeedback } from './feedback'
import { AttachmentList, FieldShell } from './form'
import { href } from '../lib/router'
import { blankEvidence, useImageUrl } from './EvidenceGallery'

const POLICY_ID = 'policy'
const isImage = (a: Attachment) => a.type.startsWith('image/')
export const imagesOf = (e: Evidence) => e.files.filter(isImage)
/** وصف الشاهد: الوصف الجاهز لنوعه، وإلا المحفوظ في السجل */
export const programEvidenceText = (e: Evidence) => kindOf(e.programId, e.programKind)?.description ?? e.description
const countLabel = (n: number) => (n === 0 ? 'لا شواهد بعد' : n === 1 ? 'شاهد واحد' : n === 2 ? 'شاهدان' : n <= 10 ? `${n} شواهد` : `${n} شاهدًا`)

function Thumb({ file, alt }: { file?: Attachment; alt: string }) {
  const url = useImageUrl(file?.id)
  if (url) return <img src={url} alt={alt} loading="lazy" decoding="async" />
  return (
    <span className="pe-noimg" aria-hidden>
      <ImageRegular />
    </span>
  )
}

/** تكبير الصور مع التنقل بينها بالأسهم */
export function Lightbox({ images, start, caption, onClose }: { images: Attachment[]; start: number; caption: string; onClose: () => void }) {
  const [i, setI] = useState(start)
  const url = useImageUrl(images[i]?.id)
  const many = images.length > 1
  // في الواجهة العربية: السهم الأيسر للتالي والأيمن للسابق
  const next = () => setI((x) => (x + 1) % images.length)
  const prev = () => setI((x) => (x - 1 + images.length) % images.length)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!many) return
      if (e.key === 'ArrowLeft') next()
      if (e.key === 'ArrowRight') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal onClose={onClose} labelledBy="lightbox-title" center>
      <div className="lightbox">
        <div className="lightbox-head">
          <h2 id="lightbox-title" className="lightbox-title">
            {caption}
          </h2>
          {many && (
            <span className="caption nowrap">
              {i + 1} من {images.length}
            </span>
          )}
          <button className="btn subtle icon" aria-label="إغلاق" onClick={onClose} data-autofocus>
            <DismissRegular />
          </button>
        </div>
        <div className="lightbox-stage">
          {url ? <img src={url} alt={`${caption}: الصورة ${i + 1}`} /> : <span className="caption">جارٍ تحميل الصورة…</span>}
          {many && (
            <>
              <button className="btn icon lightbox-nav prev" aria-label="الصورة السابقة" onClick={prev}>
                <ChevronRightRegular />
              </button>
              <button className="btn icon lightbox-nav next" aria-label="الصورة التالية" onClick={next}>
                <ChevronLeftRegular />
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

export function ProgramEvidenceEditor({ initial, isNew, onClose }: { initial: Evidence; isNew: boolean; onClose: (savedProgramId?: string) => void }) {
  const { upsert } = useStore()
  const { toast, confirm } = useFeedback()
  const [programId, setProgramId] = useState(initial.programId ?? '')
  const [kindId, setKindId] = useState(initial.programKind ?? '')
  const [images, setImages] = useState<Attachment[]>(imagesOf(initial))
  const [errors, setErrors] = useState<{ program?: string; kind?: string; images?: string }>({})
  const [busy, setBusy] = useState(0)
  const uploaded = useRef<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const program = programById(programId)
  const kind = kindOf(programId, kindId)
  const dirty = programId !== (initial.programId ?? '') || kindId !== (initial.programKind ?? '') || images.map((x) => x.id).join() !== imagesOf(initial).map((x) => x.id).join()

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return
    const files = Array.from(list).filter((f) => f.type.startsWith('image/'))
    if (files.length < list.length) toast('تُقبل ملفات الصور فقط، وتُرك غيرها.', 'error')
    const room = MAX_IMAGES - images.length
    if (files.length > room) toast(`الحد الأعلى ${MAX_IMAGES} صور للشاهد؛ أُضيفت ${Math.max(room, 0)} فقط.`, 'error')
    const take = files.slice(0, Math.max(room, 0))
    if (inputRef.current) inputRef.current.value = ''
    if (!take.length) return
    setBusy((b) => b + take.length)
    for (const f of take) {
      try {
        const meta = await saveFile(await shrinkImage(f))
        uploaded.current.push(meta.id)
        setImages((cur) => [...cur, meta])
        setErrors((x) => ({ ...x, images: undefined }))
      } catch (err) {
        toast(`تعذر رفع «${f.name}»: ${(err as Error).message}`, 'error')
      } finally {
        setBusy((b) => b - 1)
      }
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
    if (!program) errs.program = 'اختاري البرنامج.'
    if (!kind) errs.kind = 'اختاري نوع الشاهد.'
    if (images.length < MIN_IMAGES || images.length > MAX_IMAGES)
      errs.images = `ارفعي من ${MIN_IMAGES} إلى ${MAX_IMAGES} صور للشاهد (المرفوع الآن ${images.length}).`
    if (errs.program || errs.kind || errs.images) {
      setErrors(errs)
      return
    }
    const keep = new Set(images.map((x) => x.id))
    const others = initial.files.filter((f) => !isImage(f))
    upsert('evidence', {
      ...initial,
      programId,
      programKind: kindId,
      title: `${program!.name}: ${kind!.label}`,
      description: kind!.description,
      type: 'image',
      files: [...images, ...others],
    })
    const drop = [...uploaded.current.filter((id) => !keep.has(id)), ...imagesOf(initial).filter((f) => !keep.has(f.id)).map((f) => f.id)]
    await Promise.all(drop.map((id) => deleteFile(id).catch(() => undefined)))
    toast(isNew ? 'تم حفظ الشاهد.' : 'تم حفظ التعديلات.')
    onClose(programId)
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
          <button className="btn primary edit-only" onClick={() => void save()} disabled={busy > 0}>
            حفظ الشاهد
          </button>
        </>
      }
    >
      <div className="stack">
        <FieldShell id="pe-program" label="البرنامج" required error={errors.program} full>
          <select
            id="pe-program"
            className="select"
            value={programId}
            aria-invalid={errors.program ? true : undefined}
            onChange={(e) => {
              setProgramId(e.target.value)
              setKindId('')
              setErrors((x) => ({ ...x, program: undefined }))
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
        <FieldShell id="pe-kind" label="نوع الشاهد" required error={errors.kind} full>
          <select
            id="pe-kind"
            className="select"
            value={kindId}
            disabled={!program}
            aria-invalid={errors.kind ? true : undefined}
            onChange={(e) => {
              setKindId(e.target.value)
              setErrors((x) => ({ ...x, kind: undefined }))
            }}
          >
            <option value="">{program ? 'اختاري نوع الشاهد' : 'اختاري البرنامج أولًا'}</option>
            {program?.kinds.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </FieldShell>
        <div className="field full">
          <span className="pe-label">وصف الشاهد</span>
          <p className="pe-desc" aria-live="polite">
            {kind ? kind.description : <span className="muted">يظهر الوصف تلقائيًا عند اختيار نوع الشاهد.</span>}
          </p>
        </div>
        <FieldShell id="pe-images" label={`صور الشاهد (من ${MIN_IMAGES} إلى ${MAX_IMAGES})`} required error={errors.images} full>
          <div className="pe-upload">
            {images.length > 0 && (
              <ul className="pe-thumbs">
                {images.map((a, n) => (
                  <li key={a.id}>
                    <Thumb file={a} alt={`الصورة ${n + 1}`} />
                    <button
                      type="button"
                      className="btn subtle small icon danger pe-remove"
                      aria-label={`إزالة الصورة ${n + 1}`}
                      onClick={() => setImages((cur) => cur.filter((x) => x.id !== a.id))}
                    >
                      <DeleteRegular />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="row">
              <input
                ref={inputRef}
                id="pe-images"
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => void addFiles(e.target.files)}
              />
              <button type="button" className="btn" onClick={() => inputRef.current?.click()} disabled={busy > 0 || images.length >= MAX_IMAGES}>
                <AddRegular /> {images.length ? 'إضافة صور' : 'اختيار الصور'}
              </button>
              <span className="caption" aria-live="polite">
                {busy > 0 ? 'جارٍ رفع الصور…' : `${images.length} من ${MAX_IMAGES}`}
              </span>
            </div>
          </div>
        </FieldShell>
      </div>
    </Drawer>
  )
}

function EvidenceItem({ e, onEdit, onDelete }: { e: Evidence; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const imgs = imagesOf(e)
  const kind = kindOf(e.programId, e.programKind)
  const label = kind?.label ?? e.title
  return (
    <li className="pe-item" id={`ev-${e.id}`}>
      <div className="pe-item-head">
        <h4>{label}</h4>
        <div className="row edit-only" style={{ flexWrap: 'nowrap', gap: 4 }}>
          <button className="btn subtle small icon" aria-label={`تعديل الشاهد: ${label}`} title="تعديل" onClick={onEdit}>
            <EditRegular />
          </button>
          <button className="btn subtle small icon danger" aria-label={`حذف الشاهد: ${label}`} title="حذف" onClick={onDelete}>
            <DeleteRegular />
          </button>
        </div>
      </div>
      <p className="pe-item-desc">{programEvidenceText(e)}</p>
      {imgs.length > 0 ? (
        <ul className="pe-gallery">
          {imgs.map((a, n) => (
            <li key={a.id}>
              <button className="pe-shot" onClick={() => setOpen(n)} aria-label={`تكبير الصورة ${n + 1} من ${imgs.length}`}>
                <Thumb file={a} alt={`${label}: الصورة ${n + 1}`} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="caption">لا توجد صور لهذا الشاهد.</p>
      )}
      {open !== null && <Lightbox images={imgs} start={open} caption={label} onClose={() => setOpen(null)} />}
    </li>
  )
}

function ProgramCard({ p, n, count, cover, active, onOpen }: { p: ProgramDef; n: number; count: number; cover?: Attachment; active: boolean; onOpen: () => void }) {
  return (
    <li>
      <button className={`pe-card${active ? ' active' : ''}`} onClick={onOpen} aria-expanded={active} aria-controls="pe-panel">
        <span className="pe-cover">
          {cover ? <Thumb file={cover} alt="" /> : <span className="pe-n" aria-hidden>{String(n + 1).padStart(2, '0')}</span>}
        </span>
        <span className="pe-card-body">
          <span className="pe-card-name">{p.name}</span>
          <span className="pe-card-sum">{p.summary}</span>
          <span className={`pe-count${count ? ' has' : ''}`}>{countLabel(count)}</span>
        </span>
      </button>
    </li>
  )
}

/** بطاقات البرامج، وعند فتح أحدها تظهر شواهده وصوره تحته */
export function ProgramsBoard({ focusId, onDone }: { focusId?: string; onDone?: () => void }) {
  const { data, remove } = useStore()
  const { confirm, toast } = useFeedback()
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ e: Evidence; isNew: boolean } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // ‎#/evidence/new يفتح نموذج الإضافة، و‎#/evidence/<id> يفتح برنامج الشاهد
  const [handled, setHandled] = useState<string | undefined>(undefined)
  if (focusId !== handled) {
    setHandled(focusId)
    if (!focusId) {
      // لا شيء: عودة إلى الصفحة دون شاهد محدد
    } else if (focusId === 'new') setEditing({ e: blankEvidence(), isNew: true })
    else {
      const ev = data.evidence.find((x) => x.id === focusId)
      if (ev?.programId) setOpenId(ev.programId)
    }
  }

  const byProgram = (id: string) =>
    data.evidence.filter((e) => e.programId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const open = programs.find((p) => p.id === openId)
  // ملف السياسة وتقرير التحقق من وثيقة الحوكمة نفسها، فيبقى مصدرهما واحدًا ويتحدثان معًا
  const policyDoc = data.govDocs[0]
  const policyFiles = policyDoc ? [...policyDoc.files, ...(policyDoc.companionFiles ?? [])] : []
  const openList = open ? byProgram(open.id) : []

  useEffect(() => {
    if (openId) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [openId])

  const startNew = (programId = '') => setEditing({ e: { ...blankEvidence(), programId, programKind: '' }, isNew: true })

  const askDelete = async (e: Evidence) => {
    const ok = await confirm({
      title: 'حذف الشاهد؟',
      body: 'سيُحذف الشاهد وصوره. لا يمكن التراجع إلا من نسخة احتياطية.',
      confirmLabel: 'حذف الشاهد',
      danger: true,
    })
    if (!ok) return
    await remove('evidence', e.id)
    toast('تم حذف الشاهد.')
  }

  return (
    <div className="pe-board">
      <div className="row ev-actions edit-only">
        <button className="btn primary" onClick={() => startNew(openId ?? '')}>
          <AddRegular /> إضافة شاهد
        </button>
      </div>
      <ul className="pe-cards">
        {programs.map((p, n) => {
          const list = byProgram(p.id)
          const cover = list.map((e) => imagesOf(e)[0]).find(Boolean)
          return (
            <ProgramCard key={p.id} p={p} n={n} count={list.length} cover={cover} active={openId === p.id} onOpen={() => setOpenId(openId === p.id ? null : p.id)} />
          )
        })}
        <li>
          <button
            className={`pe-card${openId === POLICY_ID ? ' active' : ''}`}
            onClick={() => setOpenId(openId === POLICY_ID ? null : POLICY_ID)}
            aria-expanded={openId === POLICY_ID}
            aria-controls="pe-panel"
          >
            <span className="pe-cover pe-cover-doc">
              <DocumentPdfRegular aria-hidden />
            </span>
            <span className="pe-card-body">
              <span className="pe-card-name">سياسة الاستخدام والحوكمة</span>
              <span className="pe-card-sum">وثيقة سياسة الاستخدام المسؤول للذكاء الاصطناعي وحوكمته في المدرسة، ملفًا قابلًا للفتح والتنزيل.</span>
              <span className={`pe-count${policyFiles.length ? ' has' : ''}`}>{policyFiles.length ? `${policyFiles.length === 1 ? 'ملف واحد' : policyFiles.length === 2 ? 'ملفان' : `${policyFiles.length} ملفات`} PDF` : 'لا ملف بعد'}</span>
            </span>
          </button>
        </li>
      </ul>

      {openId === POLICY_ID && (
        <div className="pe-panel" id="pe-panel" ref={panelRef} role="region" aria-labelledby="pe-panel-title">
          <div className="pe-panel-head">
            <div>
              <h3 id="pe-panel-title">سياسة الاستخدام والحوكمة</h3>
              <p className="pe-panel-sum">{policyDoc?.title ?? 'وثيقة السياسة'}</p>
            </div>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <a className="btn edit-only" href={href('governance', 'manage')}>
                <EditRegular /> تحديث ملف السياسة
              </a>
              <button className="btn subtle icon" aria-label="إغلاق" onClick={() => setOpenId(null)}>
                <DismissRegular />
              </button>
            </div>
          </div>
          {policyFiles.length ? (
            <div className="pe-doc">
              <AttachmentList items={policyFiles} />
              <p className="caption">اضغطي زر الفتح لعرض الملف، أو زر التنزيل لحفظه على جهازك.</p>
            </div>
          ) : (
            <p className="muted pe-empty">لم يُرفع ملف السياسة بعد.</p>
          )}
        </div>
      )}

      {open && (
        <div className="pe-panel" id="pe-panel" ref={panelRef} role="region" aria-labelledby="pe-panel-title">
          <div className="pe-panel-head">
            <div>
              <h3 id="pe-panel-title">{open.name}</h3>
              <p className="pe-panel-sum">{open.summary}</p>
            </div>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <button className="btn primary edit-only" onClick={() => startNew(open.id)}>
                <AddRegular /> إضافة شاهد
              </button>
              <button className="btn subtle icon" aria-label="إغلاق البرنامج" onClick={() => setOpenId(null)}>
                <DismissRegular />
              </button>
            </div>
          </div>
          {openList.length === 0 ? (
            <p className="muted pe-empty">لم تُضف شواهد لهذا البرنامج بعد.</p>
          ) : (
            open.kinds
              .map((k) => ({ k, items: openList.filter((e) => e.programKind === k.id) }))
              .concat([{ k: { id: '', label: 'شواهد أخرى', description: '' }, items: openList.filter((e) => !open.kinds.some((k) => k.id === e.programKind)) }])
              .filter((g) => g.items.length)
              .map((g) => (
                <section key={g.k.id || 'other'} className="pe-group">
                  <ul className="pe-items">
                    {g.items.map((e) => (
                      <EvidenceItem key={e.id} e={e} onEdit={() => setEditing({ e, isNew: false })} onDelete={() => void askDelete(e)} />
                    ))}
                  </ul>
                </section>
              ))
          )}
        </div>
      )}

      {editing && (
        <ProgramEvidenceEditor
          initial={editing.e}
          isNew={editing.isNew}
          onClose={(saved) => {
            setEditing(null)
            if (saved) setOpenId(saved)
            onDone?.()
          }}
        />
      )}
    </div>
  )
}
