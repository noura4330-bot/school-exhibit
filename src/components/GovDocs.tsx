// وثائق الحوكمة: الوثيقة المرجعية الموحدة، وربط العناصر بأقسامها، ومراحل اعتمادها ونشرها وتطبيقها.
// ثلاثة أمور منفصلة: الوثيقة نفسها، وتغطية كل عنصر في نصها، وشواهد الاعتماد والتطبيق. الربط وحده لا يعني الاستيفاء.
import { useId } from 'react'
import { DocumentRegular, EditRegular, OpenRegular } from '@fluentui/react-icons'
import type { ApprovalStage, AppData, GovernanceDoc, PolicyDocRef, PolicyItem, StageStatus } from '../data/types'
import { approvalStages, coverageLevels, govDocStatuses, stageStatuses } from '../data/options'
import { evidenceFor } from '../data/selectors'
import { useStore } from '../data/store'
import { formatDate, formatNumber } from '../lib/util'
import type { EditorConfig } from './records'
import { AttachmentList, type Errors, type FieldDef } from './form'
import { Badge, ExtLink, StatusBadge, Value } from './ui'

const sectionNo = (doc: GovernanceDoc, sid: string) => doc.sections.findIndex((s) => s.id === sid) + 1

export const linkedElements = (data: AppData, doc: GovernanceDoc) => data.policies.filter((p) => p.docRef?.docId === doc.id)

/** نص قصير لأقسام العنصر: «القسم 2، 8» */
export function sectionLabel(doc: GovernanceDoc | undefined, ref: PolicyDocRef | undefined): string {
  if (!doc || !ref) return ''
  const nums = ref.sectionIds.map((s) => sectionNo(doc, s)).filter((n) => n > 0).sort((a, b) => a - b)
  return nums.length ? `${nums.length > 1 ? 'الأقسام' : 'القسم'} ${nums.map(formatNumber).join('، ')}` : ''
}

function DocFile({ doc, companions }: { doc: GovernanceDoc; companions?: boolean }) {
  const extra = companions && doc.companionFiles?.length ? (
    <div className="gd-companion">
      <span className="caption">ملف مرافق (تقرير تحقق ومطابقة، لا يُعد اعتمادًا ولا جزءًا من السياسة):</span>
      <AttachmentList items={doc.companionFiles} />
    </div>
  ) : null
  if (!doc.files.length && !doc.url)
    return (
      <>
        <p className="gd-missing">
          لم يُرفع ملف الوثيقة بعد. ارفعي ملف PDF مرة واحدة من «تحديث الوثيقة»، فيظهر في كل العناصر المرتبطة.
        </p>
        {extra}
      </>
    )
  return (
    <div className="stack" style={{ gap: 8 }}>
      {doc.files.length > 0 && <AttachmentList items={doc.files} />}
      {doc.url && (
        <ExtLink url={doc.url}>
          <OpenRegular aria-hidden /> فتح رابط الوثيقة
        </ExtLink>
      )}
      {extra}
    </div>
  )
}

/** مراحل الاعتماد الست. لا تكتمل مرحلة تلقائيًا، والمراحل التي تتطلب دليلًا لا تكتمل دون شاهد مرتبط */
export function StageTrack({ doc }: { doc: GovernanceDoc }) {
  return (
    <ol className="gd-stages" aria-label="مراحل اعتماد الوثيقة ونشرها وتطبيقها">
      {approvalStages.map((s, i) => {
        const st = doc.stages[s.key]
        return (
          <li key={s.key} className={`st-${st.status}`}>
            <span className="gd-step" aria-hidden>
              {formatNumber(i + 1)}
            </span>
            <span className="gd-stage-name">{s.label}</span>
            <StatusBadge options={stageStatuses} value={st.status} />
            {st.date && <span className="caption">{formatDate(st.date)}</span>}
          </li>
        )
      })}
    </ol>
  )
}

/** خريطة الأقسام العشرة والعناصر المرتبطة بكل قسم، مع إبراز الأقسام غير المرتبطة */
export function SectionMap({ doc, onOpenElement }: { doc: GovernanceDoc; onOpenElement?: (p: PolicyItem) => void }) {
  const { data } = useStore()
  const els = linkedElements(data, doc)
  return (
    <ol className="gd-sections">
      {doc.sections.map((s, i) => {
        const list = els.filter((p) => p.docRef!.sectionIds.includes(s.id))
        return (
          <li key={s.id} className={list.length ? '' : 'unlinked'}>
            <span className="gd-step" aria-hidden>
              {formatNumber(i + 1)}
            </span>
            <div className="gd-sec-main">
              <span className="gd-sec-title">{s.title}</span>
              {s.text && <span className="caption">موضعه في الملف: {s.text}</span>}
              <span className="gd-sec-links">
                {list.length ? (
                  list.map((p) => (
                    <span key={p.id} className="gd-chip">
                      {onOpenElement ? (
                        <button type="button" className="link-btn" onClick={() => onOpenElement(p)}>
                          {p.element}
                        </button>
                      ) : (
                        p.element
                      )}
                      <StatusBadge options={coverageLevels} value={p.docRef!.coverage} />
                    </span>
                  ))
                ) : (
                  <span className="empty-value">لا يرتبط به عنصر بعد</span>
                )}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** بطاقة الوثيقة في قسم «وثائق الحوكمة» */
export function GovDocCard({
  doc,
  onView,
  onEdit,
  onOpenElement,
}: {
  doc: GovernanceDoc
  onView: () => void
  onEdit: () => void
  onOpenElement: (p: PolicyItem) => void
}) {
  const { data } = useStore()
  const els = linkedElements(data, doc)
  const unlinkedEls = data.policies.filter((p) => !p.docRef?.docId || !data.govDocs.some((d) => d.id === p.docRef!.docId))
  const notAssessed = els.filter((p) => !p.docRef!.coverage && p.docRef!.sectionIds.length).length
  const ev = evidenceFor(data, { kind: 'govdoc', id: doc.id }).length
  const titleId = useId()
  return (
    <article className="gd-card" aria-labelledby={titleId}>
      <div className="gd-head">
        <span className="gd-icon" aria-hidden>
          <DocumentRegular />
        </span>
        <div className="gd-title">
          <h3 id={titleId}>{doc.title}</h3>
          {doc.description && <p>{doc.description}</p>}
        </div>
        <div className="row no-print gd-actions">
          <button className="btn" onClick={onView}>
            عرض الوثيقة
          </button>
          <button className="btn primary" onClick={onEdit}>
            <EditRegular /> تحديث الوثيقة
          </button>
        </div>
      </div>

      <dl className="gd-facts">
        <div>
          <dt>الحالة</dt>
          <dd>
            <StatusBadge options={govDocStatuses} value={doc.status} />
          </dd>
        </div>
        <div>
          <dt>الإصدار</dt>
          <dd>
            <Value v={doc.version} empty="لم يُحدد" />
          </dd>
        </div>
        <div>
          <dt>آخر تحديث</dt>
          <dd>{formatDate(doc.updatedAt)}</dd>
        </div>
        <div>
          <dt>العناصر المرتبطة</dt>
          <dd>{formatNumber(els.length)}</dd>
        </div>
        <div>
          <dt>شواهد الاعتماد والتطبيق</dt>
          <dd>{ev ? formatNumber(ev) : <span className="empty-value">لا يوجد</span>}</dd>
        </div>
      </dl>

      <div className="gd-file">
        <h4>ملف الوثيقة</h4>
        <DocFile doc={doc} companions />
      </div>

      <div className="gd-grid">
        <div>
          <h4>الأقسام والعناصر المرتبطة بها</h4>
          <SectionMap doc={doc} onOpenElement={onOpenElement} />
        </div>
        <div>
          <h4>مراحل الاعتماد والنشر والتطبيق</h4>
          <StageTrack doc={doc} />
          <p className="caption" style={{ marginTop: 8 }}>
            وجود الوثيقة أو رفع ملفها لا يثبت اعتمادها أو نشرها أو تطبيقها. كل مرحلة بعد المراجعة تتطلب شاهدًا مرتبطًا وتاريخًا.
          </p>
        </div>
      </div>

      {(notAssessed > 0 || unlinkedEls.length > 0) && (
        <ul className="gd-notes">
          {notAssessed > 0 && (
            <li>
              {formatNumber(notAssessed)} من العناصر المرتبطة لم تُقيَّم تغطيتها بعد مقابل نص الملف، فلا تُعد مغطاة.
            </li>
          )}
          {unlinkedEls.length > 0 && <li>عناصر غير مرتبطة بأي وثيقة: {unlinkedEls.map((p) => p.element).join('، ')}.</li>}
        </ul>
      )}
    </article>
  )
}

/** كتلة «الوثيقة المرجعية» داخل عنصر الحوكمة */
export function DocRefView({ item, onOpenDoc }: { item: PolicyItem; onOpenDoc: (d: GovernanceDoc) => void }) {
  const { data } = useStore()
  const doc = data.govDocs.find((d) => d.id === item.docRef?.docId)
  return (
    <section className="gd-ref" aria-label="الوثيقة المرجعية">
      <h3>الوثيقة المرجعية</h3>
      {!doc ? (
        <p className="empty-value">هذا العنصر غير مرتبط بوثيقة حوكمة. اربطيه من «تعديل».</p>
      ) : (
        <>
          <button type="button" className="link-btn gd-ref-title" onClick={() => onOpenDoc(doc)}>
            {doc.title}
          </button>
          <div className="row" style={{ gap: 6 }}>
            <StatusBadge options={govDocStatuses} value={doc.status} />
            {doc.version && <Badge>الإصدار {doc.version}</Badge>}
          </div>
          {item.docRef!.sectionIds.length > 0 && (
            <ul className="gd-ref-secs">
              {item.docRef!.sectionIds.map((sid) => {
                const s = doc.sections.find((x) => x.id === sid)
                return s ? (
                  <li key={sid}>
                    {sectionLabel(doc, { ...item.docRef!, sectionIds: [sid] })}: {s.title}
                  </li>
                ) : null
              })}
            </ul>
          )}
          <div className="row" style={{ gap: 6 }}>
            <span className="caption">التغطية في النص:</span>
            <StatusBadge options={coverageLevels} value={item.docRef!.coverage} />
            {item.docRef!.coverageNote && <span className="caption">{item.docRef!.coverageNote}</span>}
          </div>
          {item.docRef!.tracksStages && <StageTrack doc={doc} />}
          <DocFile doc={doc} />
          <p className="caption">الربط بالوثيقة لا يعني أن العنصر مستوفى؛ الاستيفاء يثبت بالتغطية في النص وبشواهد الاعتماد والتطبيق.</p>
        </>
      )}
    </section>
  )
}

/** حقول ربط العنصر بالوثيقة داخل نموذج التعديل */
export function DocRefEditor({ draft, set, errors }: { draft: PolicyItem; set: (k: string, v: unknown) => void; errors: Errors }) {
  const { data } = useStore()
  const uid = useId()
  const ref: PolicyDocRef = draft.docRef ?? { docId: '', sectionIds: [], coverage: '', coverageNote: '', tracksStages: false }
  const doc = data.govDocs.find((d) => d.id === ref.docId)
  const put = (patch: Partial<PolicyDocRef>) => set('docRef', { ...ref, ...patch })
  return (
    <div className="form-grid">
      <h3 className="form-section-title">الوثيقة المرجعية</h3>
      <div className="field full">
        <label htmlFor={`${uid}-doc`}>الوثيقة</label>
        <select
          id={`${uid}-doc`}
          className="select"
          value={ref.docId}
          onChange={(e) => put({ docId: e.target.value, sectionIds: e.target.value === ref.docId ? ref.sectionIds : [] })}
        >
          <option value="">غير مرتبط بوثيقة</option>
          {data.govDocs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <div className="hint">يُرفع ملف الوثيقة مرة واحدة في «وثائق الحوكمة»، ويظهر هنا تلقائيًا.</div>
      </div>
      {doc && (
        <>
          <fieldset className="field full gd-checks">
            <legend>الأقسام التي ترتبط بهذا العنصر</legend>
            {doc.sections.map((s, i) => (
              <label key={s.id} className="check">
                <input
                  type="checkbox"
                  checked={ref.sectionIds.includes(s.id)}
                  onChange={(e) =>
                    put({ sectionIds: e.target.checked ? [...ref.sectionIds, s.id] : ref.sectionIds.filter((x) => x !== s.id) })
                  }
                />
                <span>
                  {formatNumber(i + 1)}. {s.title}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor={`${uid}-cov`}>التغطية في نص الملف</label>
            <select id={`${uid}-cov`} className="select" value={ref.coverage} onChange={(e) => put({ coverage: e.target.value as PolicyDocRef['coverage'] })}>
              {coverageLevels.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="hint">تُحدد بعد قراءة نص الملف، لا بمجرد الربط.</div>
          </div>
          <div className="field">
            <label htmlFor={`${uid}-note`}>ملاحظة التغطية</label>
            <input id={`${uid}-note`} className="input" value={ref.coverageNote} onChange={(e) => put({ coverageNote: e.target.value })} />
          </div>
          <div className="field full">
            <label className="check" style={{ fontWeight: 'normal' }}>
              <input type="checkbox" checked={ref.tracksStages} onChange={(e) => put({ tracksStages: e.target.checked })} />
              <span>يعرض هذا العنصر مراحل اعتماد الوثيقة ونشرها وتطبيقها</span>
            </label>
          </div>
        </>
      )}
      {errors._docref && <div className="error full">{errors._docref}</div>}
    </div>
  )
}

export function validateDocRef(p: PolicyItem): Errors {
  const r = p.docRef
  if (r && r.docId && (r.coverage === 'full' || r.coverage === 'partial') && !r.sectionIds.length)
    return { _docref: 'حددي القسم الذي يغطي العنصر قبل تسجيل التغطية.' }
  return {}
}

/** محرر مراحل الاعتماد ومواضع الأقسام داخل نموذج الوثيقة */
function DocExtra({ draft, set, errors }: { draft: GovernanceDoc; set: (k: string, v: unknown) => void; errors: Errors }) {
  const uid = useId()
  const putStage = (k: ApprovalStage, patch: Partial<GovernanceDoc['stages'][ApprovalStage]>) =>
    set('stages', { ...draft.stages, [k]: { ...draft.stages[k], ...patch } })
  return (
    <>
      <div className="form-grid">
        <h3 className="form-section-title">مواضع الأقسام في الملف (اختياري)</h3>
        <p className="hint full">عناوين الأقسام للربط فقط، ولا يُكتب محتوى السياسة هنا. يمكن تسجيل رقم البند أو الصفحة في الملف.</p>
        {draft.sections.map((s, i) => (
          <div key={s.id} className="field">
            <label htmlFor={`${uid}-${s.id}`}>
              {formatNumber(i + 1)}. {s.title}
            </label>
            <input
              id={`${uid}-${s.id}`}
              className="input"
              placeholder="مثل: البند 3، صفحة 4"
              value={s.text}
              onChange={(e) => set('sections', draft.sections.map((x) => (x.id === s.id ? { ...x, text: e.target.value } : x)))}
            />
          </div>
        ))}
      </div>
      <div className="form-grid">
        <h3 className="form-section-title">مراحل الاعتماد والنشر والتطبيق</h3>
        <p className="hint full">لا تكتمل مرحلة تلقائيًا. المراحل من الثالثة إلى السادسة تتطلب تاريخًا وشاهدًا مرتبطًا بالوثيقة (محضر، تعميم، صور تطبيق…).</p>
        {approvalStages.map((s, i) => {
          const st = draft.stages[s.key]
          const err = errors[`stage_${s.key}`]
          return (
            <fieldset key={s.key} className="field full gd-stage-edit">
              <legend>
                {formatNumber(i + 1)}. {s.label}
              </legend>
              <div className="gd-stage-row">
                <select
                  aria-label={`حالة: ${s.label}`}
                  className="select"
                  value={st.status}
                  aria-invalid={err ? true : undefined}
                  onChange={(e) => putStage(s.key, { status: e.target.value as StageStatus })}
                >
                  {stageStatuses.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input aria-label={`تاريخ: ${s.label}`} className="input" type="date" value={st.date} onChange={(e) => putStage(s.key, { date: e.target.value })} />
                <input aria-label={`ملاحظة: ${s.label}`} className="input" placeholder="ملاحظة" value={st.note} onChange={(e) => putStage(s.key, { note: e.target.value })} />
              </div>
              {err && <div className="error">{err}</div>}
            </fieldset>
          )
        })}
      </div>
    </>
  )
}

const docFields: FieldDef[] = [
  { key: 'title', label: 'اسم الوثيقة', type: 'text', required: true, full: true },
  { key: 'description', label: 'وصف مختصر', type: 'textarea', rows: 2 },
  {
    key: 'status',
    label: 'الحالة',
    type: 'select',
    options: govDocStatuses,
    required: true,
    hint: '«معتمدة» تتطلب إكمال مرحلة الاعتماد بشاهد، و«معتمدة ومنشورة» تتطلب كذلك إكمال مرحلة النشر.',
  },
  { key: 'version', label: 'رقم الإصدار', type: 'text', hint: 'كما هو مكتوب في الملف. اتركيه فارغًا إن لم يُحدد.' },
  { key: 'versionNote', label: 'ملاحظة الإصدار', type: 'textarea', rows: 2 },
  {
    key: 'files',
    label: 'ملف الوثيقة (PDF)',
    type: 'attachments',
    accept: '.pdf,application/pdf',
    hint: 'ملف واحد فقط. عند صدور نسخة محدثة احذفي الملف القديم وارفعي الجديد هنا، فيتحدث في كل العناصر المرتبطة ويُحفظ اسم السابق في سجل الإصدارات.',
    validate: (v) => (Array.isArray(v) && v.length > 1 ? 'للوثيقة ملف واحد فقط. احذفي النسخة القديمة قبل حفظ الجديدة.' : null),
  },
  { key: 'url', label: 'رابط الوثيقة (اختياري)', type: 'url', full: true },
]

export const govDocConfig: EditorConfig<GovernanceDoc> = {
  title: 'وثيقة حوكمة',
  fields: docFields,
  linkKind: 'govdoc',
  linkLabel: 'شواهد الاعتماد والنشر والتطبيق (يمكن ربط الشاهد نفسه بعناصر أخرى)',
  noDelete: true,
  extra: (draft, set, errors) => <DocExtra draft={draft} set={set} errors={errors} />,
  extraValidate: (d, links): Errors => {
    const errs: Errors = {}
    for (const s of approvalStages) {
      const st = d.stages[s.key]
      if (st.status !== 'done' || !s.needsEvidence) continue
      if (!st.date) errs[`stage_${s.key}`] = 'سجلي تاريخ إكمال هذه المرحلة.'
      else if (!links.length) errs[`stage_${s.key}`] = 'لا تكتمل هذه المرحلة دون شاهد مرتبط بالوثيقة يثبتها.'
    }
    if ((d.status === 'approved' || d.status === 'published') && d.stages.approve.status !== 'done')
      errs.status = 'لا تُسجل الوثيقة «معتمدة» قبل إكمال مرحلة «اعتمادها من صاحبة الصلاحية» بشاهد.'
    else if (d.status === 'published' && d.stages.publish.status !== 'done')
      errs.status = 'لا تُسجل الوثيقة «منشورة» قبل إكمال مرحلة النشر بشاهد.'
    if (Object.keys(errs).some((k) => k.startsWith('stage_')) && !errs._links) errs._links = 'مراحل مكتملة تحتاج إلى شاهد مرتبط أو تاريخ.'
    return errs
  },
  beforeSave: (d, init) => {
    const fileChanged = (init.files[0]?.id ?? '') !== (d.files[0]?.id ?? '')
    const hadContent = init.files.length > 0 || !!init.version
    if (!hadContent || (!fileChanged && init.version === d.version)) return d
    const prev = { version: init.version, date: init.updatedAt.slice(0, 10), note: init.versionNote, fileName: init.files[0]?.name ?? '' }
    return { ...d, history: [prev, ...d.history] }
  },
  viewFields: () => docFields.filter((f) => f.key !== 'title'),
}

/** محتوى عرض الوثيقة: الأقسام والمراحل وسجل الإصدارات */
export function GovDocViewBody({ doc, onOpenElement }: { doc: GovernanceDoc; onOpenElement?: (p: PolicyItem) => void }) {
  return (
    <div className="stack">
      {doc.companionFiles?.length ? (
        <div>
          <h3 style={{ marginBottom: 8 }}>ملف مرافق</h3>
          <p className="caption">تقرير تحقق ومطابقة مرافق للوثيقة، لا يُعد اعتمادًا ولا جزءًا من السياسة.</p>
          <AttachmentList items={doc.companionFiles} />
        </div>
      ) : null}
      <div>
        <h3 style={{ marginBottom: 8 }}>الأقسام والعناصر المرتبطة</h3>
        <SectionMap doc={doc} onOpenElement={onOpenElement} />
      </div>
      <div>
        <h3 style={{ marginBottom: 8 }}>مراحل الاعتماد والنشر والتطبيق</h3>
        <StageTrack doc={doc} />
      </div>
      <div>
        <h3 style={{ marginBottom: 8 }}>سجل الإصدارات</h3>
        {doc.history.length ? (
          <ul className="list surface">
            {doc.history.map((h, i) => (
              <li key={i}>
                <div className="item-main">
                  <span className="item-title">{h.version ? `الإصدار ${h.version}` : 'إصدار سابق'}</span>
                  <div className="item-meta">
                    <span>حتى {formatDate(h.date)}</span>
                    {h.fileName && <span>{h.fileName}</span>}
                    {h.note && <span>{h.note}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Value v="" empty="لا توجد إصدارات سابقة مسجلة." />
        )}
      </div>
    </div>
  )
}
