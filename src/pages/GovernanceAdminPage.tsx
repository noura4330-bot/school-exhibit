import { useState } from 'react'
import { AddRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { GovernanceDoc, PolicyItem } from '../data/types'
import { coverageLevels, governanceAssessments, policyStatuses } from '../data/options'
import { evidenceFor, level3Options, policyLevel } from '../data/selectors'
import { EmptyState, Message, PageHeader, Section, StatusBadge, Value } from '../components/ui'
import { RecordCollection, useCrud, ViewToggle, type EditorConfig } from '../components/records'
import type { Errors, FieldDef } from '../components/form'
import { DocRefEditor, DocRefView, GovDocCard, GovDocViewBody, govDocConfig, sectionLabel, validateDocRef } from '../components/GovDocs'
import { formatNumber, todayIso } from '../lib/util'

const fields: FieldDef[] = [
  { key: 'element', label: 'عنصر الحوكمة', type: 'text', required: true, full: true },
  { key: 'docName', label: 'اسم الوثيقة أو المتطلب', type: 'text', full: true },
  { key: 'summary', label: 'وصف مختصر', type: 'textarea' },
  {
    key: 'status',
    label: 'الحالة',
    type: 'select',
    options: policyStatuses,
    required: true,
    hint: 'حالتا «معتمد» و«مطبق» تتطلبان ربط شاهد يثبت ذلك.',
  },
  { key: 'owner', label: 'الجهة المسؤولة', type: 'text' },
  { key: 'createdOn', label: 'تاريخ الإنشاء', type: 'date' },
  {
    key: 'reviewedOn',
    label: 'تاريخ المراجعة',
    type: 'date',
    validate: (v, r) => (v && r.createdOn && String(v) < String(r.createdOn) ? 'تاريخ المراجعة يسبق تاريخ الإنشاء.' : null),
  },
  { key: 'docUrl', label: 'رابط الوثيقة', type: 'url', full: true },
  { key: 'reviewNotes', label: 'ملاحظات المراجعة', type: 'textarea' },
  { key: 'nextAction', label: 'الإجراء التالي', type: 'textarea', rows: 2 },
  {
    key: 'assessment',
    label: 'التقييم الذاتي الأولي',
    type: 'select',
    options: governanceAssessments,
    hint: '«ممارسة قائمة بأدلة» تتطلب ربط شاهد. كتابة السياسة أو الخطة وحدها لا تثبت تطبيقها.',
  },
  { key: 'assessmentNote', label: 'مبرر التقييم', type: 'textarea', rows: 2 },
]

export const policyConfig: EditorConfig<PolicyItem> = {
  title: 'عنصر حوكمة',
  fields,
  linkKind: 'policy',
  linkLabel: 'الشواهد المرتبطة (إثبات الاعتماد أو النشر أو التطبيق)',
  extraValidate: (d, links): Errors => {
    if (d.status === 'approved' && links.length === 0)
      return { _links: 'لا يمكن تسجيل الوثيقة «معتمدة» دون ربط شاهد يثبت الاعتماد (مثل محضر أو خطاب اعتماد).' }
    if (d.status === 'applied' && links.length === 0)
      return { _links: 'لا يمكن وصف الإجراء بأنه «مطبق» دون ربط شاهد يثبت التطبيق.' }
    if (d.assessment === 'evidenced' && links.length === 0)
      return { _links: 'لا يمكن تقييم العنصر «ممارسة قائمة بأدلة» دون ربط شاهد يثبتها.' }
    return validateDocRef(d)
  },
  extra: (draft, set, errors) => <DocRefEditor draft={draft} set={set} errors={errors} />,
}

/** لوحة المتابعة الداخلية للحوكمة: العناصر وحالاتها وشواهدها والتقييم الذاتي. صفحة العرض العامة في GovernancePage */
export default function GovernanceAdminPage() {
  const { data } = useStore()
  const [level, setLevel] = useState('')
  const [view, setView] = useState<'table' | 'list'>('table')
  const openDoc = (d: GovernanceDoc) => {
    crud.close()
    docCrud.openView(d)
  }
  const openElement = (p: PolicyItem) => {
    docCrud.close()
    crud.openView(p)
  }
  const crud = useCrud<PolicyItem>(
    'policies',
    { ...policyConfig, viewIntro: (p) => <DocRefView item={p} onOpenDoc={openDoc} /> },
    (p) => p.docName || p.element,
  )
  const docCrud = useCrud<GovernanceDoc>(
    'govDocs',
    {
      ...govDocConfig,
      viewIntro: () => (
        <Message tone="warning">رفع الوثيقة أو ربطها بالعناصر لا يثبت اعتمادها أو نشرها أو تطبيقها؛ ذلك يثبت بالمراحل وشواهدها.</Message>
      ),
      viewOutro: (d) => <GovDocViewBody doc={d} onOpenElement={openElement} />,
    },
    (d) => d.title,
  )
  const levels = new Map(data.policies.map((p) => [p.id, policyLevel(data, p)]))
  const items = data.policies.filter((p) => !level || levels.get(p.id)!.level === level)
  const counts = level3Options.map((o) => ({ ...o, n: data.policies.filter((p) => levels.get(p.id)!.level === o.value).length }))
  const needsAction = data.policies.filter((p) => levels.get(p.id)!.needsAction).length
  const today = todayIso()

  const newItem = (): PolicyItem => ({
    ...makeBase(),
    element: '',
    docName: '',
    summary: '',
    status: 'not_started',
    createdOn: today,
    reviewedOn: '',
    owner: '',
    docUrl: '',
    reviewNotes: '',
    nextAction: '',
    assessment: '',
    assessmentNote: '',
    docRef: data.govDocs[0] ? { docId: data.govDocs[0].id, sectionIds: [], coverage: '', coverageNote: '', tracksStages: false } : undefined,
  })

  const statusCell = (p: PolicyItem) => {
    const l = levels.get(p.id)!
    return (
      <span className="status-cell">
        <StatusBadge options={level3Options} value={l.level} />
        {l.detail && <span className={`caption${l.needsAction ? ' warn' : ''}`}>{l.detail}</span>}
      </span>
    )
  }

  const docCell = (p: PolicyItem) => {
    const doc = data.govDocs.find((d) => d.id === p.docRef?.docId)
    if (!doc) return <span className="empty-value">غير مرتبط</span>
    const label = sectionLabel(doc, p.docRef)
    return (
      <span className="status-cell">
        <span>{label || (p.docRef!.tracksStages ? 'مراحل الاعتماد' : 'بلا قسم محدد')}</span>
        {label && <StatusBadge options={coverageLevels} value={p.docRef!.coverage} />}
      </span>
    )
  }

  return (
    <>
      <PageHeader
        title="متابعة الحوكمة"
        lead="لوحة داخلية لمسؤولة المبادرة: عناصر الحوكمة وحالاتها وشواهدها، ومراحل اعتماد الوثيقة، والتقييم الذاتي."
        actions={
          <>
            <a className="btn" href="#/governance">
              صفحة العرض
            </a>
            <button className="btn primary edit-only" onClick={() => crud.openNew(newItem())}>
              <AddRegular /> إضافة عنصر
            </button>
          </>
        }
      />

      <Message tone="warning">
        تُعتمد السياسات وفق صلاحيات المدرسة والأنظمة المعمول بها. تسجيل الحالة هنا توثيق داخلي لا يُعد اعتمادًا، والمسودات تحمل وسم
        «غير معتمدة».
      </Message>

      <Section id="govdocs" title="وثائق الحوكمة" sub="الوثيقة المرجعية الموحدة: ملف واحد تُربط أقسامه بالعناصر">
        {data.govDocs.length ? (
          data.govDocs.map((d) => (
            <GovDocCard key={d.id} doc={d} onView={() => docCrud.openView(d)} onEdit={() => docCrud.openEdit(d)} onOpenElement={openElement} />
          ))
        ) : (
          <EmptyState title="لا توجد وثيقة حوكمة مسجلة" />
        )}
      </Section>

      <div className="stat-row" aria-label="ملخص حالة عناصر الحوكمة">
        <div className="stat">
          <span className="stat-value">{formatNumber(data.policies.length)}</span>
          <span className="stat-label">عناصر الحوكمة</span>
        </div>
        {counts.map((c) => (
          <div className={`stat tint-${c.tone ?? 'neutral'}`} key={c.value}>
            <span className="stat-value">{formatNumber(c.n)}</span>
            <span className="stat-label">{c.label}</span>
          </div>
        ))}
        <div className="stat tint-warning">
          <span className="stat-value">{formatNumber(needsAction)}</span>
          <span className="stat-label">تحتاج إجراء</span>
        </div>
      </div>
      <p className="caption" style={{ marginTop: -8 }}>
        «مكتمل» يعني حالة معتمدة أو مطبقة يثبتها شاهد مرتبط. «تحتاج إجراء»: حالة مسجلة دون شاهد يثبتها.
      </p>

      <Section
        title="عناصر الحوكمة"
        sub={`${items.length} من ${data.policies.length}`}
        actions={<ViewToggle view={view} onChange={setView} />}
        flush
      >
        <div className="toolbar">
          <div className="field">
            <label htmlFor="pol-status">الحالة</label>
            <select id="pol-status" className="select" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">كل الحالات</option>
              {level3Options.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <RecordCollection
          view={view}
          items={items}
          getTitle={(p) => p.element}
          onOpen={crud.openView}
          onEdit={crud.openEdit}
          onDelete={(p) => void crud.askDelete(p)}
          columns={[
            { label: 'الحالة', render: statusCell },
            { label: 'الوثيقة المرجعية', render: docCell },
            { label: 'الشواهد', render: (p) => formatNumber(evidenceFor(data, { kind: 'policy', id: p.id }).length), className: 'nowrap' },
            { label: 'الإجراء التالي', render: (p) => <Value v={p.nextAction} empty="—" /> },
          ]}
          meta={(p) => (
            <>
              {statusCell(p)}
              {docCell(p)}
              <span>{evidenceFor(data, { kind: 'policy', id: p.id }).length} شاهد</span>
            </>
          )}
          empty={<EmptyState title="لا توجد عناصر مطابقة للتصفية" />}
        />
      </Section>

      <Section
        title="التقييم الذاتي الأولي للحوكمة"
        sub="تقييم أولي مبني على ما سُجل في المعرض فقط، ولا يحدد مستوى المقياس الرسمي"
        band="dark"
      >
        <div className="assess">
          {governanceAssessments
            .filter((a) => a.value)
            .map((a) => {
              const list = data.policies.filter((p) => (p.assessment ?? '') === a.value)
              return (
                <div key={a.value} className="assess-col">
                  <div className="assess-head">
                    <StatusBadge options={governanceAssessments} value={a.value} />
                    <span className="caption">{formatNumber(list.length)}</span>
                  </div>
                  {list.length ? (
                    <ul>
                      {list.map((p) => (
                        <li key={p.id}>
                          <button type="button" className="link-btn" onClick={() => crud.openView(p)}>
                            {p.element}
                          </button>
                          {p.assessmentNote && <span className="caption">{p.assessmentNote}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-value">
                      {a.value === 'evidenced' ? 'لا توجد ممارسة مثبتة بشاهد مرتبط حتى الآن.' : 'لا توجد عناصر.'}
                    </p>
                  )}
                </div>
              )
            })}
        </div>
        {data.policies.some((p) => !p.assessment) && (
          <p className="caption" style={{ marginTop: 12 }}>
            لم تُقيَّم بعد: {data.policies.filter((p) => !p.assessment).map((p) => p.element).join('، ')}.
          </p>
        )}
      </Section>

      {crud.node}
      {docCrud.node}
    </>
  )
}
