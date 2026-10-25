import { useState } from 'react'
import { AddRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { StudentProject } from '../data/types'
import { consentOptions } from '../data/options'
import { docStateLabels, docStateTone, projectDoc, type DocState } from '../data/selectors'
import { Badge, EmptyState, Message, PageHeader, Progress, Section, StatusBadge, Value } from '../components/ui'
import { RecordCollection, useCrud, ViewToggle, type EditorConfig } from '../components/records'
import { ClearFilters, DateRange, SearchBox, SelectFilter, uniqueOptions } from '../components/filters'
import type { FieldDef } from '../components/form'
import { formatDate, inRange, matches } from '../lib/util'

const fields: FieldDef[] = [
  { key: 'h1', label: 'تعريف المشروع', type: 'heading' },
  { key: 'title', label: 'اسم المشروع', type: 'text', required: true, full: true },
  { key: 'field', label: 'المجال', type: 'text', hint: 'مثل: البيئة، الصحة، الطاقة.' },
  { key: 'subject', label: 'المادة', type: 'text' },
  { key: 'date', label: 'التاريخ', type: 'date' },
  { key: 'problem', label: 'وصف المشكلة', type: 'textarea' },
  { key: 'idea', label: 'الفكرة المقترحة', type: 'textarea' },
  { key: 'solution', label: 'الحل', type: 'textarea' },
  { key: 'tools', label: 'الأدوات المستخدمة', type: 'textarea', rows: 2 },
  { key: 'aiRole', label: 'دور الذكاء الاصطناعي (إن وجد)', type: 'textarea', rows: 2 },
  { key: 'h2', label: 'التصميم والتنفيذ', type: 'heading' },
  { key: 'steps', label: 'خطوات التصميم والتنفيذ', type: 'textarea', rows: 4 },
  { key: 'testing', label: 'الاختبار والتحسين', type: 'textarea' },
  { key: 'finalProduct', label: 'الناتج النهائي', type: 'textarea' },
  { key: 'successCriteria', label: 'معايير النجاح', type: 'textarea' },
  { key: 'futureSkills', label: 'مهارات المستقبل المستهدفة', type: 'textarea', rows: 2 },
  { key: 'h3', label: 'الخصوصية والشواهد المصورة', type: 'heading' },
  {
    key: 'consent',
    label: 'حالة موافقات النشر',
    type: 'select',
    options: consentOptions,
    required: true,
    hint: 'لا تُعرض الصور إلا عند اكتمال الموافقات وتوثيقها.',
  },
  {
    key: 'photos',
    label: 'الشواهد المصورة',
    type: 'attachments',
    accept: 'image/*',
    hint: 'تجنبي الصور التي تكشف هوية الطالبات ما لم تتوفر موافقات موثقة.',
  },
  { key: 'h4', label: 'التقويم', type: 'heading' },
  { key: 'evaluation', label: 'تقويم المشروع', type: 'textarea' },
  { key: 'improvementNotes', label: 'ملاحظات التحسين', type: 'textarea' },
]

const config: EditorConfig<StudentProject> = {
  title: 'مشروع طالبات',
  fields,
  linkKind: 'project',
  linkLabel: 'الشواهد',
  intro: () => (
    <Message tone="warning">
      لا يتضمن النموذج حقلًا لأسماء الطالبات عمدًا. لا تُدرجي أسماءهن أو صورهن أو أعمالًا تكشف هوياتهن دون التصاريح والموافقات اللازمة.
    </Message>
  ),
  viewFields: (p) => (p.consent === 'full' ? fields : fields.filter((f) => f.key !== 'photos')),
  viewIntro: (p) =>
    p.consent !== 'full' && p.photos.length > 0 ? (
      <Message tone="warning">أُخفيت {p.photos.length} صورة لعدم اكتمال موافقات النشر.</Message>
    ) : null,
}

const docStates = (['none', 'partial', 'complete'] as DocState[]).map((v) => ({ value: v, label: docStateLabels[v] }))

export default function ProjectsPage() {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const [field, setField] = useState('')
  const [subject, setSubject] = useState('')
  const [state, setState] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [view, setView] = useState<'table' | 'list'>('table')
  const crud = useCrud<StudentProject>('projects', config, (p) => p.title)

  const items = data.projects
    .map((p) => ({ p, doc: projectDoc(data, p) }))
    .filter(
      ({ p, doc }) =>
        matches(q, p.title, p.problem, p.tools) &&
        (!field || p.field.trim() === field) &&
        (!subject || p.subject.trim() === subject) &&
        (!state || doc.state === state) &&
        inRange(p.date, from, to),
    )
    .sort((a, b) => (b.p.date || '').localeCompare(a.p.date || ''))
  const docOf = new Map(items.map((x) => [x.p.id, x.doc]))

  const blank = (): StudentProject => ({
    ...makeBase(),
    title: '',
    field: '',
    subject: '',
    date: '',
    problem: '',
    idea: '',
    solution: '',
    tools: '',
    aiRole: '',
    steps: '',
    testing: '',
    finalProduct: '',
    successCriteria: '',
    futureSkills: '',
    consent: 'unknown',
    photos: [],
    evaluation: '',
    improvementNotes: '',
  })

  return (
    <>
      <PageHeader
        title="مشروعات الطالبات"
        lead="عرض المشروعات الطلابية من المشكلة إلى الناتج النهائي، مع حماية هوية الطالبات."
        actions={
          <button className="btn primary edit-only" onClick={() => crud.openNew(blank())}>
            <AddRegular /> إضافة مشروع
          </button>
        }
      />
      <Message tone="warning" title="حماية هوية الطالبات">
        لا تُنشر أسماء الطالبات أو صورهن أو أعمال تكشف هوياتهن دون موافقات. الصور تُخفى تلقائيًا حتى تُسجل الموافقات مكتملة.
      </Message>
      <Section title="المشروعات" sub={`${items.length} من ${data.projects.length}`} actions={<ViewToggle view={view} onChange={setView} />} flush>
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="اسم المشروع أو المشكلة" />
          <SelectFilter label="المجال" value={field} onChange={setField} options={uniqueOptions(data.projects.map((p) => p.field))} />
          <SelectFilter label="المادة" value={subject} onChange={setSubject} options={uniqueOptions(data.projects.map((p) => p.subject))} />
          <SelectFilter label="حالة التوثيق" value={state} onChange={setState} options={docStates} />
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <ClearFilters
            active={Boolean(q || field || subject || state || from || to)}
            onClear={() => {
              setQ('')
              setField('')
              setSubject('')
              setState('')
              setFrom('')
              setTo('')
            }}
          />
        </div>
        <RecordCollection
          view={view}
          items={items.map((x) => x.p)}
          getTitle={(p) => p.title}
          onOpen={crud.openView}
          onEdit={crud.openEdit}
          onDelete={(p) => void crud.askDelete(p)}
          columns={[
            { label: 'المجال', render: (p) => <Value v={p.field} empty="—" /> },
            { label: 'المادة', render: (p) => <Value v={p.subject} empty="—" /> },
            { label: 'التاريخ', render: (p) => formatDate(p.date), className: 'nowrap' },
            { label: 'الموافقات', render: (p) => <StatusBadge options={consentOptions} value={p.consent} /> },
            {
              label: 'اكتمال الحقول',
              render: (p) => {
                const d = docOf.get(p.id)!
                return (
                  <div style={{ minWidth: 90 }}>
                    <Progress pct={d.pct} tone={d.pct === 100 ? 'success' : 'warning'} />
                    <span className="caption">
                      {d.filled}/{d.total} · {d.evidence} شاهد
                    </span>
                  </div>
                )
              },
            },
            {
              label: 'حالة التوثيق',
              render: (p) => {
                const d = docOf.get(p.id)!
                return <Badge tone={docStateTone[d.state]}>{docStateLabels[d.state]}</Badge>
              },
            },
          ]}
          meta={(p) => (
            <>
              <span>{p.field || 'بلا مجال'}</span>
              <span>{formatDate(p.date)}</span>
              <StatusBadge options={consentOptions} value={p.consent} />
            </>
          )}
          empty={
            data.projects.length === 0 ? (
              <EmptyState
                title="لم تُسجل مشروعات بعد"
                action={
                  <button className="btn primary edit-only" onClick={() => crud.openNew(blank())}>
                    <AddRegular /> إضافة مشروع
                  </button>
                }
              >
                سجّلي مشروعات الطالبات بخطواتها ونتائجها، دون أسماء أو صور تكشف الهوية.
              </EmptyState>
            ) : (
              <EmptyState title="لا توجد مشروعات مطابقة للتصفية" />
            )
          }
        />
      </Section>
      {crud.node}
    </>
  )
}
