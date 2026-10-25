import { useState } from 'react'
import { AddRegular, BeakerRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { Practice } from '../data/types'
import { labelOf, practiceCategories } from '../data/options'
import { docStateLabels, docStateTone, practiceDoc, type DocState } from '../data/selectors'
import { Badge, EmptyState, PageHeader, Progress, Section, Value } from '../components/ui'
import { RecordCollection, useCrud, ViewToggle, type EditorConfig } from '../components/records'
import { ClearFilters, SearchBox, SelectFilter } from '../components/filters'
import type { FieldDef } from '../components/form'
import { matches } from '../lib/util'

const fields: FieldDef[] = [
  { key: 'h1', label: 'تعريف الممارسة', type: 'heading' },
  { key: 'title', label: 'عنوان الممارسة', type: 'text', required: true, full: true },
  { key: 'category', label: 'الفئة', type: 'select', options: practiceCategories, required: true },
  { key: 'subject', label: 'المادة', type: 'text' },
  { key: 'stage', label: 'المرحلة الدراسية', type: 'text' },
  { key: 'objective', label: 'الهدف التعليمي', type: 'textarea' },
  { key: 'need', label: 'المشكلة أو الحاجة التعليمية', type: 'textarea' },
  { key: 'strategy', label: 'الاستراتيجية', type: 'text' },
  { key: 'tool', label: 'الأداة المستخدمة', type: 'text' },
  { key: 'h2', label: 'التنفيذ', type: 'heading' },
  { key: 'implementation', label: 'وصف التنفيذ', type: 'textarea', rows: 4 },
  { key: 'teacherRole', label: 'دور المعلمة', type: 'textarea' },
  { key: 'studentRole', label: 'دور الطالبات', type: 'textarea' },
  { key: 'outcome', label: 'ناتج التعلم', type: 'textarea' },
  { key: 'assessment', label: 'أداة التقويم', type: 'textarea', rows: 2 },
  { key: 'h3', label: 'النتائج والتحسين', type: 'heading' },
  { key: 'results', label: 'النتائج الفعلية', type: 'textarea', hint: 'تُملأ بعد التنفيذ بنتائج مقيسة فعلًا.' },
  { key: 'improvement', label: 'فرص التحسين', type: 'textarea' },
  { key: 'isTemplate', label: 'هذا السجل نموذج لم يُنفذ بعد', type: 'checkbox', full: true, hint: 'أزيلي التحديد بعد تنفيذ الدرس وتوثيقه.' },
]

const config: EditorConfig<Practice> = { title: 'ممارسة تعليمية', fields, linkKind: 'practice', linkLabel: 'الشواهد' }

const docStates = (['none', 'partial', 'complete'] as DocState[]).map((v) => ({ value: v, label: docStateLabels[v] }))

export default function TeachingPage() {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [state, setState] = useState('')
  const [view, setView] = useState<'table' | 'list'>('table')
  const crud = useCrud<Practice>('practices', config, (p) => p.title)

  const items = data.practices
    .map((p) => ({ p, doc: practiceDoc(data, p) }))
    .filter(({ p, doc }) => matches(q, p.title, p.subject, p.stage, p.tool, p.strategy) && (!cat || p.category === cat) && (!state || doc.state === state))
  const docOf = new Map(items.map((x) => [x.p.id, x.doc]))

  const blank = (): Practice => ({
    ...makeBase(),
    title: '',
    category: 'applied',
    subject: '',
    stage: '',
    objective: '',
    need: '',
    strategy: '',
    tool: '',
    implementation: '',
    teacherRole: '',
    studentRole: '',
    outcome: '',
    assessment: '',
    results: '',
    improvement: '',
    isTemplate: false,
  })

  const fromStemTemplate = (): Practice => ({
    ...blank(),
    title: 'تطبيقات الذكاء الاصطناعي',
    category: 'stem',
    strategy: 'منهجية STEM (التصميم الهندسي)',
    isTemplate: true,
  })

  const docBadge = (p: Practice) => {
    const d = docOf.get(p.id) ?? practiceDoc(data, p)
    return (
      <span className="row" style={{ gap: 4 }}>
        {p.isTemplate && <Badge tone="brand">نموذج — لم يُنفذ</Badge>}
        <Badge tone={docStateTone[d.state]}>{docStateLabels[d.state]}</Badge>
      </span>
    )
  }

  return (
    <>
      <PageHeader
        title="التعليم والتعلم"
        lead="معرض الممارسات التعليمية المبتكرة، موثقة بأهدافها وتنفيذها ونتائجها الفعلية."
        actions={
          <>
            <button className="btn" onClick={() => crud.openNew(fromStemTemplate())}>
              <BeakerRegular /> درس STEM من النموذج
            </button>
            <button className="btn primary edit-only" onClick={() => crud.openNew(blank())}>
              <AddRegular /> إضافة ممارسة
            </button>
          </>
        }
      />
      <Section title="الممارسات" sub={`${items.length} من ${data.practices.length}`} actions={<ViewToggle view={view} onChange={setView} />} flush>
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="العنوان أو المادة أو الأداة" />
          <SelectFilter label="الفئة" value={cat} onChange={setCat} options={practiceCategories} />
          <SelectFilter label="حالة التوثيق" value={state} onChange={setState} options={docStates} />
          <ClearFilters
            active={Boolean(q || cat || state)}
            onClear={() => {
              setQ('')
              setCat('')
              setState('')
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
            { label: 'الفئة', render: (p) => labelOf(practiceCategories, p.category) },
            { label: 'المادة والمرحلة', render: (p) => <Value v={[p.subject, p.stage].filter(Boolean).join(' · ')} empty="—" /> },
            { label: 'الأداة', render: (p) => <Value v={p.tool} empty="—" /> },
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
            { label: 'الحالة', render: docBadge },
          ]}
          meta={(p) => (
            <>
              <span>{labelOf(practiceCategories, p.category)}</span>
              {docBadge(p)}
            </>
          )}
          empty={
            data.practices.length === 0 ? (
              <EmptyState
                title="لا توجد ممارسات بعد"
                action={
                  <button className="btn primary edit-only" onClick={() => crud.openNew(blank())}>
                    <AddRegular /> إضافة ممارسة
                  </button>
                }
              >
                وثّقي أول ممارسة تعليمية، أو ابدئي من نموذج درس «تطبيقات الذكاء الاصطناعي» بمنهجية STEM.
              </EmptyState>
            ) : (
              <EmptyState title="لا توجد ممارسات مطابقة للتصفية" />
            )
          }
        />
      </Section>
      {crud.node}
    </>
  )
}

