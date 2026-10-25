import { useState } from 'react'
import { AddRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { Workshop } from '../data/types'
import { docStateLabels, docStateTone, workshopDoc, type DocState } from '../data/selectors'
import { Badge, EmptyState, Message, PageHeader, Progress, Section, Value } from '../components/ui'
import { RecordCollection, useCrud, ViewToggle, type EditorConfig } from '../components/records'
import { ClearFilters, DateRange, SearchBox, SelectFilter, uniqueOptions } from '../components/filters'
import type { FieldDef } from '../components/form'
import { formatDate, inRange, matches } from '../lib/util'

const fields: FieldDef[] = [
  { key: 'h1', label: 'بيانات الورشة', type: 'heading' },
  { key: 'title', label: 'عنوان الورشة', type: 'text', required: true, full: true },
  { key: 'topic', label: 'الموضوع', type: 'text', hint: 'يُستخدم في التصفية، مثل: الذكاء الاصطناعي التوليدي.' },
  { key: 'date', label: 'التاريخ', type: 'date' },
  { key: 'presenter', label: 'المنفذة', type: 'text' },
  { key: 'audience', label: 'الفئة المستهدفة', type: 'text' },
  { key: 'participants', label: 'عدد المشاركات', type: 'number', hint: 'العدد الفعلي من سجل الحضور.' },
  { key: 'description', label: 'وصف الورشة', type: 'textarea' },
  { key: 'objectives', label: 'أهداف الورشة', type: 'textarea' },
  { key: 'h2', label: 'الملفات', type: 'heading' },
  { key: 'presentation', label: 'ملف العرض', type: 'attachments', accept: '.ppt,.pptx,.pdf,.key,.odp' },
  { key: 'attendance', label: 'سجل الحضور', type: 'attachments', hint: 'قد يحتوي بيانات شخصية؛ لا يُنشر خارج المدرسة.' },
  { key: 'photos', label: 'صور التنفيذ', type: 'attachments', accept: 'image/*' },
  { key: 'h3', label: 'الأثر والنتائج', type: 'heading' },
  { key: 'skills', label: 'المهارات المكتسبة', type: 'textarea' },
  { key: 'application', label: 'التطبيق الناتج عن التدريب', type: 'textarea' },
  { key: 'measureTool', label: 'أداة قياس الاستفادة', type: 'textarea', rows: 2 },
  { key: 'results', label: 'النتائج', type: 'textarea', hint: 'سجّلي النتائج الفعلية من أداة القياس فقط.' },
  { key: 'finalReport', label: 'التقرير الختامي', type: 'textarea', rows: 4 },
]

const config: EditorConfig<Workshop> = { title: 'ورشة', fields, linkKind: 'workshop', linkLabel: 'الشواهد' }

const docStates: { value: DocState; label: string }[] = (['none', 'partial', 'complete'] as DocState[]).map((v) => ({
  value: v,
  label: docStateLabels[v],
}))

export default function ProfessionalPage() {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const [topic, setTopic] = useState('')
  const [state, setState] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [view, setView] = useState<'table' | 'list'>('table')
  const crud = useCrud<Workshop>('workshops', config, (w) => w.title)

  const items = data.workshops
    .map((w) => ({ w, doc: workshopDoc(data, w) }))
    .filter(
      ({ w, doc }) =>
        matches(q, w.title, w.description, w.presenter) &&
        (!topic || w.topic.trim() === topic) &&
        (!state || doc.state === state) &&
        inRange(w.date, from, to),
    )
    .sort((a, b) => (b.w.date || '').localeCompare(a.w.date || ''))

  const newItem = (): Workshop => ({
    ...makeBase(),
    title: '',
    description: '',
    objectives: '',
    date: '',
    presenter: '',
    topic: '',
    audience: 'المعلمات',
    participants: '',
    presentation: [],
    attendance: [],
    photos: [],
    skills: '',
    application: '',
    measureTool: '',
    results: '',
    finalReport: '',
  })

  const docOf = new Map(items.map((x) => [x.w.id, x.doc]))
  const docBadge = (w: Workshop) => {
    const d = docOf.get(w.id) ?? workshopDoc(data, w)
    return <Badge tone={docStateTone[d.state]}>{docStateLabels[d.state]}</Badge>
  }

  return (
    <>
      <PageHeader
        title="التطوير المهني"
        lead="توثيق ورش المعلمات: الحضور، والتطبيق الناتج عن التدريب، وقياس الاستفادة."
        actions={
          <button className="btn primary" onClick={() => crud.openNew(newItem())}>
            <AddRegular /> إضافة ورشة
          </button>
        }
      />
      <Message tone="info">
        تكون الورشة «موثقة» تلقائيًا عند اكتمال حقولها الأساسية وربطها بشاهد واحد على الأقل.
      </Message>
      <Section title="سجل الورش" sub={`${items.length} من ${data.workshops.length}`} actions={<ViewToggle view={view} onChange={setView} />} flush>
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="عنوان الورشة أو المنفذة" />
          <SelectFilter label="الموضوع" value={topic} onChange={setTopic} options={uniqueOptions(data.workshops.map((w) => w.topic))} />
          <SelectFilter label="حالة التوثيق" value={state} onChange={setState} options={docStates} />
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <ClearFilters
            active={Boolean(q || topic || state || from || to)}
            onClear={() => {
              setQ('')
              setTopic('')
              setState('')
              setFrom('')
              setTo('')
            }}
          />
        </div>
        <RecordCollection
          view={view}
          items={items.map((x) => x.w)}
          getTitle={(w) => w.title}
          onOpen={crud.openView}
          onEdit={crud.openEdit}
          onDelete={(w) => void crud.askDelete(w)}
          columns={[
            { label: 'التاريخ', render: (w) => formatDate(w.date), className: 'nowrap' },
            { label: 'الموضوع', render: (w) => <Value v={w.topic} empty="—" /> },
            { label: 'المنفذة', render: (w) => <Value v={w.presenter} empty="—" /> },
            { label: 'المشاركات', render: (w) => <Value v={w.participants} empty="—" /> },
            {
              label: 'اكتمال الحقول',
              render: (w) => {
                const d = docOf.get(w.id)!
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
            { label: 'حالة التوثيق', render: docBadge },
          ]}
          meta={(w) => (
            <>
              <span>{formatDate(w.date)}</span>
              {docBadge(w)}
            </>
          )}
          empty={
            data.workshops.length === 0 ? (
              <EmptyState
                title="لم تُسجل ورش بعد"
                action={
                  <button className="btn primary" onClick={() => crud.openNew(newItem())}>
                    <AddRegular /> إضافة ورشة
                  </button>
                }
              >
                ابدئي بتسجيل أول ورشة منفذة، وأرفقي ملف العرض وسجل الحضور، ثم اربطيها بشواهدها.
              </EmptyState>
            ) : (
              <EmptyState title="لا توجد ورش مطابقة للتصفية" />
            )
          }
        />
      </Section>
      {crud.node}
    </>
  )
}
