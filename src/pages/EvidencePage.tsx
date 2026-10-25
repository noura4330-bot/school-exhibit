import { useEffect, useMemo, useRef, useState } from 'react'
import { AddRegular, DeleteRegular, EditRegular, FolderOpenRegular, SearchRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { Evidence, Ref } from '../data/types'
import {
  evidenceTypes,
  fileCategories,
  labelOf,
  reviewStatuses,
  sensitivityLevels,
  siteDomains,
  yesNo,
} from '../data/options'
import {
  duplicateGroups,
  evidenceCompleteness,
  hasSource,
  linkableRefs,
  refKindLabels,
  refRoutes,
  refTitle,
} from '../data/selectors'
import { Badge, DescList, EmptyState, ExtLink, Message, PageHeader, Progress, Section, StatusBadge, Value } from '../components/ui'
import { Drawer, useFeedback } from '../components/feedback'
import { AttachmentList, FormFields, validateFields, type Errors, type FieldDef } from '../components/form'
import { ViewToggle } from '../components/records'
import { ClearFilters, DateRange, SearchBox, SelectFilter } from '../components/filters'
import { deleteFile, getFile } from '../lib/fileStore'
import { href, navigate } from '../lib/router'
import { formatDate, inRange, matches, todayIso } from '../lib/util'

const fields: FieldDef[] = [
  { key: 'h1', label: 'بطاقة الشاهد', type: 'heading' },
  { key: 'title', label: 'عنوان الشاهد', type: 'text', required: true, full: true },
  { key: 'description', label: 'وصف الشاهد', type: 'textarea', rows: 2 },
  { key: 'type', label: 'نوع الشاهد', type: 'select', options: evidenceTypes, required: true },
  { key: 'category', label: 'تصنيف الملف', type: 'select', options: fileCategories, required: true },
  {
    key: 'executedOn',
    label: 'تاريخ التنفيذ',
    type: 'date',
    validate: (v) => (typeof v === 'string' && v > todayIso() ? 'تاريخ التنفيذ لا يكون في المستقبل.' : null),
  },
  { key: 'source', label: 'مصدر الشاهد', type: 'text', hint: 'مثل: سجل المدرسة، منصة مدرستي، Microsoft Forms.' },
  { key: 'domain', label: 'المجال المرتبط به', type: 'select', options: siteDomains },
  { key: 'owner', label: 'المسؤول عنه', type: 'text' },
  { key: 'reviewStatus', label: 'حالة المراجعة', type: 'select', options: reviewStatuses, required: true },
  { key: 'sensitivity', label: 'مستوى حساسية المعلومات', type: 'select', options: sensitivityLevels, required: true },
  { key: 'h2', label: 'الملف أو الرابط', type: 'heading' },
  { key: 'files', label: 'رفع ملف', type: 'attachments', hint: 'يُحفظ الملف في متصفح هذا الجهاز فقط، وقد لا يكون متاحًا على الأجهزة الأخرى.' },
  { key: 'url', label: 'رابط الملف أو مساره', type: 'url', full: true, hint: 'مثل رابط OneDrive أو SharePoint. تأكدي أن صلاحية الرابط ليست عامة إن كان المحتوى داخليًا.' },
  { key: 'h3', label: 'ماذا يثبت هذا الشاهد؟', type: 'heading' },
  { key: 'proves', label: 'ما الذي يثبته الشاهد؟', type: 'textarea', rows: 2 },
  { key: 'howLinked', label: 'كيف يرتبط بالمؤشر؟', type: 'textarea', rows: 2, hint: 'مطلوب عند ربط الشاهد بأكثر من مؤشر.' },
  { key: 'visibleProof', label: 'ما الدليل الظاهر داخله؟', type: 'textarea', rows: 2, hint: 'مثل: توقيع الاعتماد في الصفحة 2، أو جدول النتائج.' },
  { key: 'needsCompletion', label: 'هل يحتاج إلى استكمال؟', type: 'select', options: yesNo },
  { key: 'hasPersonalData', label: 'هل يحتوي على بيانات شخصية ينبغي حمايتها؟', type: 'select', options: yesNo },
  { key: 'notes', label: 'ملاحظات', type: 'textarea', rows: 2 },
]

const blank = (): Evidence => ({
  ...makeBase(),
  title: '',
  description: '',
  type: 'pdf',
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

const sameRef = (a: Ref, b: Ref) => a.kind === b.kind && a.id === b.id

function LinkPicker({ value, onChange, error }: { value: Ref[]; onChange: (v: Ref[]) => void; error?: string }) {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const all = linkableRefs(data)
  const shown = all.filter((x) => value.some((v) => sameRef(v, x.ref)) || matches(q, x.title, x.group))
  const groups = Array.from(new Set(shown.map((x) => x.group)))
  const toggle = (r: Ref) => onChange(value.some((v) => sameRef(v, r)) ? value.filter((v) => !sameRef(v, r)) : [...value, r])
  return (
    <fieldset className="field full" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 600, marginBottom: 4 }}>
        المؤشرات والأنشطة المرتبطة <span className="caption">({value.length} محدد)</span>
      </legend>
      {all.length === 0 ? (
        <div className="hint">لا توجد مؤشرات أو أنشطة مسجلة بعد لربطها.</div>
      ) : (
        <>
          <div className="search-input">
            <SearchRegular aria-hidden />
            <input className="input" aria-label="بحث في المؤشرات والأنشطة" placeholder="ابحثي بالعنوان" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="surface" style={{ maxHeight: 260, overflowY: 'auto', marginTop: 6 }}>
            {groups.map((g) => (
              <div key={g}>
                <div className="caption" style={{ padding: '6px 12px', background: 'var(--bg3)', fontWeight: 600 }}>
                  {g}
                </div>
                {shown
                  .filter((x) => x.group === g)
                  .map((x) => (
                    <label key={`${x.ref.kind}-${x.ref.id}`} className="check" style={{ padding: '6px 12px', borderBottom: '1px solid var(--stroke3)' }}>
                      <input type="checkbox" checked={value.some((v) => sameRef(v, x.ref))} onChange={() => toggle(x.ref)} />
                      <span>{x.title}</span>
                    </label>
                  ))}
              </div>
            ))}
            {shown.length === 0 && <div className="caption" style={{ padding: 12 }}>لا نتائج مطابقة.</div>}
          </div>
        </>
      )}
      {error && <div className="error">{error}</div>}
      <div className="hint">رابط الملف وحده لا يُعد دليلًا على استيفاء المؤشر. وثّقي ما يثبته الشاهد وكيف يرتبط بالمؤشر.</div>
    </fieldset>
  )
}

function EvidenceEditor({ initial, isNew, onClose }: { initial: Evidence; isNew: boolean; onClose: () => void }) {
  const { upsert } = useStore()
  const { toast, confirm } = useFeedback()
  const [draft, setDraft] = useState<Evidence>(initial)
  const [errors, setErrors] = useState<Errors>({})
  const uploaded = useRef<string[]>([])
  const dirty = useRef(false)

  const set = (k: string, v: unknown) => {
    dirty.current = true
    setDraft((d) => ({ ...d, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }))
  }

  const validate = (): Errors => {
    const errs = validateFields(fields, draft as unknown as Record<string, unknown>)
    const indicatorLinks = draft.links.filter((l) => l.kind === 'indicator' || l.kind === 'impact')
    if (indicatorLinks.length > 1 && !draft.howLinked.trim())
      errs.howLinked = 'الشاهد مرتبط بأكثر من مؤشر؛ اكتبي مبرر الربط بوضوح.'
    if (draft.hasPersonalData === 'yes' && draft.sensitivity === 'public')
      errs.sensitivity = 'شاهد يحتوي بيانات شخصية لا يُصنف «عامًا».'
    return errs
  }

  const cancel = async () => {
    if (dirty.current) {
      const ok = await confirm({ title: 'تجاهل التعديلات؟', body: 'لم تُحفظ التعديلات على هذا الشاهد.', confirmLabel: 'تجاهل التعديلات', danger: true })
      if (!ok) return
    }
    await Promise.all(uploaded.current.map((id) => deleteFile(id).catch(() => undefined)))
    onClose()
  }

  const save = async () => {
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      toast('تعذر الحفظ. راجعي الحقول المظللة.', 'error')
      setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0)
      return
    }
    const keep = new Set(draft.files.map((f) => f.id))
    const removed = initial.files.filter((f) => !keep.has(f.id))
    upsert('evidence', draft)
    await Promise.all(removed.map((f) => deleteFile(f.id).catch(() => undefined)))
    toast(isNew ? 'تمت إضافة الشاهد.' : 'تم حفظ بيانات الشاهد.')
    onClose()
  }

  return (
    <Drawer
      title={isNew ? 'إضافة شاهد' : 'تعديل بيانات الشاهد'}
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
      <div className="stack">
        <FormFields
          fields={fields}
          value={draft as unknown as Record<string, unknown>}
          onChange={set}
          errors={errors}
          onUploaded={(a) => uploaded.current.push(a.id)}
        />
        <div className="form-grid">
          <h3 className="form-section-title">الربط</h3>
          <LinkPicker value={draft.links} onChange={(v) => set('links', v)} error={errors.links} />
        </div>
      </div>
    </Drawer>
  )
}

function ImagePreview({ fileId }: { fileId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let made: string | null = null
    getFile(fileId)
      .then((f) => {
        if (f && f.type.startsWith('image/')) {
          made = URL.createObjectURL(f.blob)
          setUrl(made)
        }
      })
      .catch(() => undefined)
    return () => {
      if (made) URL.revokeObjectURL(made)
    }
  }, [fileId])
  return url ? <img src={url} alt="معاينة الشاهد" loading="lazy" decoding="async" /> : null
}

function EvidenceView({
  e,
  duplicates,
  onEdit,
  onDelete,
  onClose,
}: {
  e: Evidence
  duplicates: Evidence[]
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const { data } = useStore()
  const c = evidenceCompleteness(e)
  return (
    <Drawer
      title={e.title}
      onClose={onClose}
      footer={
        <>
          <button className="btn danger" onClick={onDelete}>
            <DeleteRegular /> حذف
          </button>
          <span className="spacer" />
          <button className="btn primary" onClick={onEdit}>
            <EditRegular /> تعديل البيانات
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="row">
          <StatusBadge options={reviewStatuses} value={e.reviewStatus} />
          <StatusBadge options={sensitivityLevels} value={e.sensitivity} />
          <Badge>{labelOf(fileCategories, e.category)}</Badge>
        </div>
        {e.sensitivity !== 'public' && (
          <Message tone={e.sensitivity === 'sensitive' ? 'danger' : 'warning'}>
            {e.sensitivity === 'sensitive'
              ? 'هذا الشاهد يحتوي معلومات حساسة. لا تنشريه ولا تشاركي رابطه خارج نطاق المراجعة المخولة.'
              : 'شاهد داخلي للمدرسة. راجعي قبل نشره خارجيًا.'}
          </Message>
        )}
        {c.missing.length > 0 && (
          <Message tone="warning" title={`اكتمال البيانات ${c.pct}%`}>
            ينقصه: {c.missing.join('، ')}.
          </Message>
        )}
        {duplicates.length > 0 && (
          <Message tone="warning" title="شاهد مكرر محتمل">
            يشبه: {duplicates.map((d) => d.title).join('، ')} (تطابق في العنوان أو الرابط أو الملف).
          </Message>
        )}
        <div>
          <h3 style={{ marginBottom: 8 }}>الملفات والروابط</h3>
          {e.files.length > 0 && (
            <>
              <div className="thumbs" style={{ marginBottom: 8 }}>
                {e.files.filter((f) => f.type.startsWith('image/')).map((f) => (
                  <ImagePreview key={f.id} fileId={f.id} />
                ))}
              </div>
              <AttachmentList items={e.files} />
              <p className="caption" style={{ marginTop: 4 }}>
                الملفات محفوظة في متصفح هذا الجهاز فقط.
              </p>
            </>
          )}
          {e.url && (
            <p>
              <ExtLink url={e.url} />
            </p>
          )}
          {!hasSource(e) && <Value v="" empty="لا يوجد ملف أو رابط لهذا الشاهد." />}
        </div>
        <DescList
          items={[
            { label: 'الوصف', value: <Value v={e.description} /> },
            { label: 'النوع', value: labelOf(evidenceTypes, e.type) },
            { label: 'تاريخ التنفيذ', value: formatDate(e.executedOn) },
            { label: 'تاريخ الإضافة', value: formatDate(e.createdAt) },
            { label: 'المصدر', value: <Value v={e.source} /> },
            { label: 'المجال', value: <Value v={e.domain ? labelOf(siteDomains, e.domain) : ''} /> },
            { label: 'المسؤول عنه', value: <Value v={e.owner} /> },
            { label: 'ما الذي يثبته', value: <Value v={e.proves} /> },
            { label: 'كيف يرتبط بالمؤشر', value: <Value v={e.howLinked} /> },
            { label: 'الدليل الظاهر داخله', value: <Value v={e.visibleProof} /> },
            { label: 'يحتاج إلى استكمال', value: labelOf(yesNo, e.needsCompletion) },
            { label: 'يحتوي بيانات شخصية', value: labelOf(yesNo, e.hasPersonalData) },
            { label: 'ملاحظات', value: <Value v={e.notes} /> },
          ]}
        />
        <div>
          <h3 style={{ marginBottom: 8 }}>المؤشرات والأنشطة المرتبطة</h3>
          {e.links.length === 0 ? (
            <Value v="" empty="غير مرتبط بأي مؤشر أو نشاط." />
          ) : (
            <ul className="list surface">
              {e.links.map((l) => (
                <li key={`${l.kind}-${l.id}`}>
                  <Badge>{refKindLabels[l.kind]}</Badge>
                  <div className="item-main">
                    <a href={href(refRoutes[l.kind])}>{refTitle(data, l) ?? 'عنصر محذوف'}</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  )
}

export default function EvidencePage({ focusId }: { focusId: string }) {
  const { data, remove } = useStore()
  const { confirm, toast } = useFeedback()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [domain, setDomain] = useState('')
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [quality, setQuality] = useState<'' | 'incomplete' | 'duplicate'>('')
  const [view, setView] = useState<'table' | 'list'>('table')
  const [editing, setEditing] = useState<{ e: Evidence; isNew: boolean } | null>(null)

  const groups = useMemo(() => duplicateGroups(data.evidence), [data.evidence])
  const dupOf = (id: string) => groups.filter((g) => g.some((x) => x.id === id)).flat().filter((x) => x.id !== id)
  const viewing = focusId && focusId !== 'new' ? data.evidence.find((e) => e.id === focusId) ?? null : null
  // ‎#/evidence/new يفتح نموذج إضافة شاهد مباشرة (مثل زر «إضافة شاهد» في الرئيسية)
  const [opened, setOpened] = useState(false)
  if (focusId === 'new' && !opened) {
    setOpened(true)
    setEditing({ e: blank(), isNew: true })
  }

  const items = data.evidence
    .filter((e) => {
      const c = evidenceCompleteness(e)
      return (
        matches(q, e.title, e.description, e.source, e.owner, e.notes) &&
        (!type || e.type === type) &&
        (!domain || e.domain === domain) &&
        (!status || e.reviewStatus === status) &&
        inRange(e.executedOn || e.createdAt.slice(0, 10), from, to) &&
        (quality !== 'incomplete' || c.missing.length > 0 || e.needsCompletion === 'yes') &&
        (quality !== 'duplicate' || dupOf(e.id).length > 0)
      )
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const incompleteCount = data.evidence.filter((e) => evidenceCompleteness(e).missing.length > 0).length

  const askDelete = async (e: Evidence) => {
    const ok = await confirm({
      title: 'حذف الشاهد؟',
      body: `سيُحذف «${e.title}» وملفاته المحفوظة على هذا الجهاز، ويُزال ربطه بالمؤشرات والأنشطة. لا يمكن التراجع إلا من نسخة احتياطية.`,
      confirmLabel: 'حذف الشاهد',
      danger: true,
    })
    if (!ok) return
    await remove('evidence', e.id)
    if (focusId) navigate('evidence')
    toast('تم حذف الشاهد.')
  }

  const linksSummary = (e: Evidence) => {
    const ind = e.links.filter((l) => l.kind === 'indicator' || l.kind === 'impact').length
    const other = e.links.length - ind
    return e.links.length ? `${ind} مؤشر · ${other} نشاط/عنصر` : 'غير مرتبط بعد'
  }

  return (
    <>
      <PageHeader
        title="الشواهد والأدلة"
        lead="أضيفي الشواهد، واربطيها بالمؤشرات والأنشطة، ووضّحي ما يثبته كل شاهد."
        actions={
          <button className="btn primary" onClick={() => setEditing({ e: blank(), isNew: true })}>
            <AddRegular /> إضافة شاهد
          </button>
        }
      />
      <Message tone="info">
        الشواهد والملفات تُحفظ في متصفح هذا الجهاز فقط. للمشاركة استخدمي روابط OneDrive أو SharePoint، وصدّري نسخة احتياطية بانتظام.
      </Message>

      <Section
        title="سجل الشواهد"
        sub={`${items.length} من ${data.evidence.length} · ${incompleteCount} غير مكتمل · ${groups.length} مجموعة تكرار محتمل`}
        actions={<ViewToggle view={view} onChange={setView} />}
        flush
      >
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="العنوان أو الوصف أو المصدر" />
          <SelectFilter label="النوع" value={type} onChange={setType} options={evidenceTypes} />
          <SelectFilter label="المجال" value={domain} onChange={setDomain} options={siteDomains} />
          <SelectFilter label="حالة المراجعة" value={status} onChange={setStatus} options={reviewStatuses} />
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <SelectFilter
            label="الجودة"
            value={quality}
            onChange={(v) => setQuality(v as typeof quality)}
            options={[
              { value: 'incomplete', label: 'غير المكتملة' },
              { value: 'duplicate', label: 'المكررة المحتملة' },
            ]}
          />
          <ClearFilters
            active={Boolean(q || type || domain || status || from || to || quality)}
            onClear={() => {
              setQ('')
              setType('')
              setDomain('')
              setStatus('')
              setFrom('')
              setTo('')
              setQuality('')
            }}
          />
        </div>

        {items.length === 0 ? (
          data.evidence.length === 0 ? (
            <EmptyState
              icon={<FolderOpenRegular />}
              title="لا توجد شواهد بعد"
              action={
                <button className="btn primary" onClick={() => setEditing({ e: blank(), isNew: true })}>
                  <AddRegular /> إضافة أول شاهد
                </button>
              }
            >
              ارفعي ملفًا أو أضيفي رابطًا، ثم وثّقي ما يثبته الشاهد واربطيه بالمؤشر أو النشاط المناسب.
            </EmptyState>
          ) : (
            <EmptyState title="لا توجد شواهد مطابقة للتصفية" />
          )
        ) : view === 'table' ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">الشاهد</th>
                  <th scope="col">النوع</th>
                  <th scope="col">تاريخ التنفيذ</th>
                  <th scope="col">المجال</th>
                  <th scope="col">الربط</th>
                  <th scope="col">الاكتمال</th>
                  <th scope="col">المراجعة</th>
                  <th scope="col" className="no-print">
                    <span className="sr-only">إجراءات</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const c = evidenceCompleteness(e)
                  const dup = dupOf(e.id).length > 0
                  return (
                    <tr key={e.id} className={!hasSource(e) || e.links.length === 0 ? 'is-pending' : undefined}>
                      <td className="title-cell">
                        <button onClick={() => navigate('evidence', e.id)}>{e.title}</button>
                        <div className="row" style={{ gap: 4, marginTop: 4 }}>
                          {e.sensitivity === 'sensitive' && <Badge tone="danger">حساس</Badge>}
                          {dup && <Badge tone="warning">مكرر محتمل</Badge>}
                          {!hasSource(e) && <Badge>بلا ملف أو رابط</Badge>}
                        </div>
                      </td>
                      <td>{labelOf(evidenceTypes, e.type)}</td>
                      <td className="nowrap">{formatDate(e.executedOn)}</td>
                      <td>{e.domain ? labelOf(siteDomains, e.domain) : '—'}</td>
                      <td className="nowrap caption">{linksSummary(e)}</td>
                      <td style={{ minWidth: 90 }}>
                        <Progress pct={c.pct} tone={c.pct === 100 ? 'success' : 'warning'} />
                        <span className="caption">{c.pct}%</span>
                      </td>
                      <td>
                        <StatusBadge options={reviewStatuses} value={e.reviewStatus} />
                      </td>
                      <td className="actions no-print">
                        <button className="btn subtle small icon" aria-label={`تعديل ${e.title}`} title="تعديل" onClick={() => setEditing({ e, isNew: false })}>
                          <EditRegular />
                        </button>
                        <button className="btn subtle small icon danger" aria-label={`حذف ${e.title}`} title="حذف" onClick={() => void askDelete(e)}>
                          <DeleteRegular />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="list">
            {items.map((e) => (
              <li key={e.id}>
                <div className="item-main">
                  <a className="item-title" href={href('evidence', e.id)}>
                    {e.title}
                  </a>
                  <div className="item-meta">
                    <span>{labelOf(evidenceTypes, e.type)}</span>
                    <span>{formatDate(e.executedOn)}</span>
                    <span>{linksSummary(e)}</span>
                    <StatusBadge options={reviewStatuses} value={e.reviewStatus} />
                    {!hasSource(e) && <Badge>بلا ملف أو رابط</Badge>}
                  </div>
                </div>
                <div className="row no-print" style={{ flexWrap: 'nowrap' }}>
                  <button className="btn subtle small icon" aria-label={`تعديل ${e.title}`} onClick={() => setEditing({ e, isNew: false })}>
                    <EditRegular />
                  </button>
                  <button className="btn subtle small icon danger" aria-label={`حذف ${e.title}`} onClick={() => void askDelete(e)}>
                    <DeleteRegular />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {focusId && focusId !== 'new' && !viewing && !editing && (
        <Message tone="warning">الشاهد المطلوب غير موجود؛ ربما حُذف.</Message>
      )}
      {viewing && !editing && (
        <EvidenceView
          e={viewing}
          duplicates={dupOf(viewing.id)}
          onClose={() => navigate('evidence')}
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
            if (focusId === 'new') navigate('evidence')
          }}
        />
      )}
    </>
  )
}
