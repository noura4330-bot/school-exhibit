import { useState } from 'react'
import { AddRegular, EditRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { Activity, InitiativeProfile, Task } from '../data/types'
import { activityStatuses, initiativeStatuses, labelOf, siteDomains } from '../data/options'
import { EmptyState, StatusBadge, Value } from '../components/ui'
import {
  AxisTable,
  ChallengePairs,
  groupIndicators,
  lines,
  More,
  parseStages,
  PlanPath,
  ReportDoc,
  RoleList,
  SecHead,
} from '../components/InitiativeSections'
import { Drawer, useFeedback } from '../components/feedback'
import { FormFields, validateFields, type Errors, type FieldDef } from '../components/form'
import { RecordCollection, useCrud, ViewToggle, type EditorConfig } from '../components/records'
import { taskConfig } from '../components/taskConfig'
import { IniProfile } from '../components/IniProfile'
import { ActivityCard, ImpactAxisCards, TaskCard } from '../components/IniCards'
import { computeKpis, evidenceFor } from '../data/selectors'
import { href } from '../lib/router'
import { formatDate, todayIso } from '../lib/util'

const groups: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'التعريف',
    fields: [
      { key: 'name', label: 'اسم المبادرة', type: 'text', required: true, full: true },
      { key: 'domain', label: 'المجال', type: 'text' },
      { key: 'status', label: 'حالة الخطة', type: 'select', options: initiativeStatuses, required: true },
      { key: 'lead', label: 'مسؤولة المبادرة', type: 'text' },
      { key: 'vision', label: 'الرؤية', type: 'textarea' },
      { key: 'mission', label: 'الرسالة', type: 'textarea', rows: 2 },
      { key: 'values', label: 'القيم والمبادئ', type: 'textarea', hint: 'قيمة في كل سطر، ويمكن أن تبدأ باسمها ثم نقطتين ثم شرح موجز.' },
      { key: 'rationale', label: 'مبررات المبادرة', type: 'textarea' },
      { key: 'problem', label: 'المشكلة التعليمية أو التطويرية التي تعالجها', type: 'textarea' },
      { key: 'gap', label: 'الفجوة التي تعالجها المبادرة', type: 'textarea', rows: 2 },
      { key: 'generalGoal', label: 'الهدف العام', type: 'textarea' },
      { key: 'executionGoals', label: 'الأهداف التنفيذية', type: 'textarea', hint: 'هدف في كل سطر، ويمكن أن يبدأ بعنوان مختصر ثم نقطتين، مثل «وعي الطالبات: …».' },
      { key: 'expectedResults', label: 'النتائج المنشودة', type: 'textarea', hint: 'نتيجة في كل سطر. تبقى متوقعة حتى تُقاس.' },
      { key: 'targetGroups', label: 'الفئات المستهدفة', type: 'textarea', rows: 2 },
    ],
  },
  {
    title: 'النطاق والمخرجات المتوقعة',
    fields: [
      { key: 'scope', label: 'نطاق التطبيق', type: 'textarea', rows: 2 },
      { key: 'targetPractices', label: 'الممارسات المستهدفة', type: 'textarea', hint: 'ممارسة في كل سطر.' },
      { key: 'expectedOutputs', label: 'المخرجات المتوقعة', type: 'textarea', hint: 'مخرج في كل سطر. لا تُعرض بوصفها إنجازات.' },
      { key: 'intendedImpact', label: 'الأثر التعليمي المنشود', type: 'textarea', rows: 2 },
    ],
  },
  {
    title: 'التخطيط والتنفيذ',
    fields: [
      { key: 'duration', label: 'مدة التنفيذ', type: 'text' },
      { key: 'supporters', label: 'الجهات الداعمة', type: 'text', hint: 'سجّلي فقط الجهات الداعمة فعلًا.' },
      { key: 'responsibilities', label: 'المسؤوليات', type: 'textarea' },
      { key: 'resources', label: 'الموارد', type: 'textarea' },
      { key: 'timeline', label: 'الجدول الزمني', type: 'textarea', hint: 'سطر تمهيدي اختياري، ثم مرحلة في كل سطر بصيغة «المرحلة 1 — العنوان: الوصف».' },
    ],
  },
  {
    title: 'القياس والنتائج',
    fields: [
      { key: 'kpis', label: 'مؤشرات الأداء', type: 'textarea' },
      { key: 'measurementPlan', label: 'خطة قياس الأثر', type: 'textarea', hint: 'خطوة في كل سطر، بصيغة «العنوان: الوصف».' },
      { key: 'baseline', label: 'خط الأساس', type: 'textarea', rows: 2 },
      { key: 'target', label: 'المستهدف', type: 'textarea', rows: 2 },
      { key: 'actualResults', label: 'النتائج الفعلية', type: 'textarea', hint: 'سجّلي النتائج المقيسة فعلًا فقط، مع مصدرها.' },
    ],
  },
  {
    title: 'التقويم والتحسين',
    fields: [
      { key: 'challenges', label: 'التحديات', type: 'textarea' },
      { key: 'improvements', label: 'الإجراءات التحسينية', type: 'textarea' },
      { key: 'achievementReport', label: 'تقرير الإنجاز', type: 'textarea', rows: 5 },
      { key: 'journey', label: 'وصف رحلة التحول المدرسي (يظهر في الرئيسية)', type: 'textarea', rows: 4 },
    ],
  },
]

const allFields: FieldDef[] = groups.flatMap((g) => [{ key: `h-${g.title}`, label: g.title, type: 'heading' as const }, ...g.fields])

const activityFields: FieldDef[] = [
  { key: 'title', label: 'عنوان النشاط', type: 'text', required: true, full: true },
  { key: 'description', label: 'وصف النشاط', type: 'textarea' },
  { key: 'domain', label: 'المجال', type: 'select', options: siteDomains },
  {
    key: 'status',
    label: 'الحالة',
    type: 'select',
    options: activityStatuses,
    required: true,
  },
  {
    key: 'date',
    label: 'تاريخ البداية (أو تاريخ التنفيذ)',
    type: 'date',
    validate: (v, r) => {
      if (r.status === 'implemented' && !v) return 'حددي تاريخ التنفيذ للنشاط المنفذ.'
      if (r.status === 'implemented' && typeof v === 'string' && v > todayIso()) return 'لا يمكن أن يكون تاريخ التنفيذ في المستقبل.'
      return null
    },
  },
  {
    key: 'endDate',
    label: 'تاريخ النهاية',
    type: 'date',
    validate: (v, r) => (typeof v === 'string' && v && r.date && v < String(r.date) ? 'تاريخ النهاية يسبق تاريخ البداية.' : null),
  },
  { key: 'responsible', label: 'المسؤول', type: 'text' },
  {
    key: 'stage',
    label: 'مرحلة الخطة',
    type: 'select',
    options: [
      { value: '1', label: 'المرحلة 1 — التأسيس والحوكمة' },
      { value: '2', label: 'المرحلة 2 — بناء قدرات المعلمات' },
      { value: '3', label: 'المرحلة 3 — التطبيق في الممارسات التعليمية' },
      { value: '4', label: 'المرحلة 4 — تمكين الطالبات والمشروعات التعليمية' },
      { value: '5', label: 'المرحلة 5 — توثيق الشواهد وقياس الأثر والتحسين' },
    ],
  },
  { key: 'output', label: 'المخرج المتوقع', type: 'textarea', rows: 2 },
  { key: 'notes', label: 'ملاحظات', type: 'textarea', rows: 2 },
]

const activityConfig: EditorConfig<Activity> = {
  title: 'نشاط',
  fields: activityFields,
  linkKind: 'activity',
  linkLabel: 'شواهد النشاط',
  // حقل المرحلة يُحفظ رقمًا
  beforeSave: (d) => ({ ...d, stage: d.stage ? Number(d.stage) : undefined }),
}

const activityDates = (a: Activity) => (a.endDate && a.endDate !== a.date ? `${formatDate(a.date)} – ${formatDate(a.endDate)}` : formatDate(a.date))

function ProfileEditor({ onClose }: { onClose: () => void }) {
  const { data, setInitiative } = useStore()
  const { toast } = useFeedback()
  const [draft, setDraft] = useState<InitiativeProfile>(data.initiative)
  const [errors, setErrors] = useState<Errors>({})
  const save = () => {
    const errs = validateFields(allFields, draft as unknown as Record<string, unknown>)
    if (Object.keys(errs).length) {
      setErrors(errs)
      toast('تعذر الحفظ. راجعي الحقول المطلوبة.', 'error')
      return
    }
    setInitiative(draft)
    toast('تم حفظ ملف المبادرة.')
    onClose()
  }
  return (
    <Drawer
      title="تعديل ملف المبادرة"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn primary" onClick={save}>
            حفظ
          </button>
        </>
      }
    >
      <FormFields
        fields={allFields}
        value={draft as unknown as Record<string, unknown>}
        errors={errors}
        onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
      />
    </Drawer>
  )
}


/** وصف مختصر لغرض المبادرة، مأخوذ من المشكلة التي تعالجها */
const PURPOSE = 'إطار مدرسي منظم لتوظيف الذكاء الاصطناعي في التعليم والتعلم، يطوّر مهارات المعلمات والطالبات، ويوثّق الممارسات ويقيس أثرها.'

/** عدد المهام الظاهرة قبل «عرض الكل»: غير المنجزة أولًا ثم الأقرب موعدًا */
const TASKS_SHOWN = 6

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export default function InitiativePage() {
  const { data, upsert } = useStore()
  const { toast } = useFeedback()
  const ini = data.initiative
  const s = data.settings
  const [editing, setEditing] = useState(false)
  const [view, setView] = useState<'table' | 'list'>('list')
  const [tab, setTab] = useState<'tasks' | 'activities'>('tasks')
  const [area, setArea] = useState('')
  const [q, setQ] = useState('')
  const [allTasks, setAllTasks] = useState(false)
  const crud = useCrud<Activity>('activities', activityConfig, (a) => a.title)
  const taskCrud = useCrud<Task>('tasks', taskConfig, (t) => t.title)

  const newActivity = (): Activity => ({
    ...makeBase(),
    title: '',
    description: '',
    date: '',
    status: 'planned',
    responsible: '',
    domain: '',
    notes: '',
  })
  const newTask = (): Task => ({ ...makeBase(), title: '', area: area || 'initiative', owner: '', due: '', status: 'not_started', notes: '' })

  const { intro, stages } = parseStages(ini, data.activities)
  const { axes, other } = groupIndicators(data)
  const kpis = computeKpis(data)
  const done = data.activities.filter((a) => a.status === 'implemented')
  const pending = data.activities.filter((a) => a.status === 'planned')
  const evidenceTotal = data.evidence.length
  const tasks = data.tasks
    .filter((t) => !area || t.area === area)
    .filter((t) => !q.trim() || `${t.title} ${t.owner} ${t.notes}`.includes(q.trim()))
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.due || '9999').localeCompare(b.due || '9999'))

  const activitiesSorted = [...data.activities].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))

  const setTaskStatus = (t: Task, status: Task['status']) => {
    upsert('tasks', { ...t, status })
    toast(`حُدّثت حالة «${t.title}».`)
  }

  return (
    <>
      {/* ===== الواجهة الافتتاحية ===== */}
      <section className="ini-hero bleed" aria-labelledby="ini-name">
        <div className="ini-hero-grid">
          <div className="ini-hero-text">
            <p className="eyebrow">ملف المبادرة</p>
            <h1 id="ini-name">{ini.name || 'لم يُسجل اسم المبادرة بعد'}</h1>
            <p className="ini-purpose">{PURPOSE}</p>
            <p className="ini-school">
              <strong>{s.schoolName}</strong>
              <span>
                محافظة {s.governorate}، {s.department}
              </span>
            </p>
            <nav className="ini-jump no-print" aria-label="أقسام الصفحة">
              <button className="btn primary" onClick={() => jump('ini-about')}>
                تعريف المبادرة
              </button>
              <button className="btn" onClick={() => jump('ini-plan')}>
                خطة التنفيذ
              </button>
              <button className="btn" onClick={() => jump('ini-impact')}>
                مؤشرات الأثر
              </button>
              <span className="ini-jump-more">
                <button className="link-btn" onClick={() => jump('ini-manage')}>
                  المهام
                </button>
                <button className="link-btn" onClick={() => jump('ini-report')}>
                  التقرير
                </button>
                <button className="link-btn" onClick={() => setEditing(true)}>
                  <EditRegular aria-hidden /> تعديل الملف
                </button>
              </span>
            </nav>
          </div>
        </div>
      </section>

      {/* ===== 01 ملف المبادرة: ستة تبويبات ===== */}
      <section className="ini-sec" id="ini-about" aria-labelledby="ini-about-title">
        <SecHead
          n="01"
          id="ini-about"
          title="ملف المبادرة"
          sub={
            <>
              المسؤولة: <Value v={ini.lead} />
            </>
          }
          actions={
            <button className="btn small" onClick={() => setEditing(true)}>
              <EditRegular /> تعديل الملف
            </button>
          }
        />
        <IniProfile ini={ini} settings={s} purpose={PURPOSE} onEdit={() => setEditing(true)} />
      </section>

      {/* ===== 02 خطة التنفيذ ===== */}
      <section className="ini-sec ini-band bleed on-dark" id="ini-plan" aria-labelledby="ini-plan-title">
        <SecHead n="02" id="ini-plan" title="خطة التنفيذ" sub={intro ?? undefined} />
        <PlanPath stages={stages} activityStatusLabel={(a) => <StatusBadge options={activityStatuses} value={a.status} />}
          isDocumented={(a) => evidenceFor(data, { kind: 'activity', id: a.id }).length > 0}
        />
        <More label="الأدوار والموارد والجهات الداعمة" className="on-band">
          <div className="ini-three">
            <div>
              <h4>المسؤوليات</h4>
              <RoleList text={ini.responsibilities} />
            </div>
            <div>
              <h4>الموارد</h4>
              <p className="pre-line">
                <Value v={ini.resources} />
              </p>
            </div>
            <div>
              <h4>الجهات الداعمة</h4>
              <p className="pre-line">
                <Value v={ini.supporters} empty="لا توجد جهات داعمة مسجلة" />
              </p>
            </div>
          </div>
        </More>
      </section>

      {/* ===== 03 مؤشرات الأثر ===== */}
      <section className="ini-sec" id="ini-impact" aria-labelledby="ini-impact-title">
        <SecHead
          n="03"
          id="ini-impact"
          title="مؤشرات قياس الأثر"
          sub="لا تُعرض نتيجة إلا إذا سُجلت قيمتها الفعلية في صفحة قياس الأثر."
          actions={
            <a className="btn small" href={href('impact')}>
              تحديث القياسات
            </a>
          }
        />
        <dl className="ini-stages3">
          <div className="b">
            <dt>خط الأساس</dt>
            <dd>
              <Value v={lines(ini.baseline)[0]} />
            </dd>
          </div>
          <div className="t">
            <dt>المستهدف</dt>
            <dd>
              <Value v={lines(ini.target)[0]} />
            </dd>
          </div>
          <div className="a">
            <dt>النتيجة الفعلية</dt>
            <dd>
              <Value v={lines(ini.actualResults)[0]} empty="لم تُسجل نتائج فعلية بعد" />
            </dd>
          </div>
        </dl>
        <ImpactAxisCards axes={axes} />
        {other.length > 0 && (
          <More label={`مؤشرات أخرى (${other.length})`}>
            <AxisTable items={other} />
          </More>
        )}
        <More label="تفاصيل خط الأساس والمستهدف وخطة القياس">
          <div className="ini-three">
            <div>
              <h4>خط الأساس</h4>
              <p className="pre-line">
                <Value v={ini.baseline} />
              </p>
            </div>
            <div>
              <h4>المستهدف</h4>
              <p className="pre-line">
                <Value v={ini.target} />
              </p>
            </div>
            <div>
              <h4>خطة قياس الأثر</h4>
              <RoleList text={ini.measurementPlan ?? ''} />
            </div>
          </div>
        </More>
      </section>

      {/* ===== 04 إدارة التنفيذ ===== */}
      <section className="ini-sec" id="ini-manage" aria-labelledby="ini-manage-title">
        <SecHead
          n="04"
          id="ini-manage"
          title="إدارة التنفيذ"
          sub="المهام التشغيلية وسجل الأنشطة. اضغطي على البطاقة لعرض تفاصيلها."
          actions={
            tab === 'tasks' ? (
              <>
                <input
                  className="input small ini-task-search"
                  type="search"
                  aria-label="بحث في المهام"
                  placeholder="بحث في المهام"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <select className="input small" aria-label="تصفية المهام حسب المجال" value={area} onChange={(e) => setArea(e.target.value)}>
                  <option value="">كل المجالات</option>
                  {siteDomains.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <button className="btn primary small" onClick={() => taskCrud.openNew(newTask())}>
                  <AddRegular /> إضافة مهمة
                </button>
              </>
            ) : (
              <>
                <ViewToggle view={view} onChange={setView} />
                <button className="btn primary small" onClick={() => crud.openNew(newActivity())}>
                  <AddRegular /> إضافة نشاط
                </button>
              </>
            )
          }
        />
        <div className="segmented ini-tabs" role="tablist" aria-label="إدارة التنفيذ">
          <button role="tab" aria-selected={tab === 'tasks'} aria-pressed={tab === 'tasks'} onClick={() => setTab('tasks')}>
            المهام ({data.tasks.length})
          </button>
          <button role="tab" aria-selected={tab === 'activities'} aria-pressed={tab === 'activities'} onClick={() => setTab('activities')}>
            الأنشطة ({data.activities.length})
          </button>
        </div>

        {tab === 'tasks' ? (
          tasks.length ? (
            <div className="ic-wrap">
              <ul className="ic-list ic-tasks">
                {(allTasks ? tasks : tasks.slice(0, TASKS_SHOWN)).map((t) => (
                  <TaskCard
                    key={t.id}
                    t={t}
                    data={data}
                    onStatus={(st) => setTaskStatus(t, st)}
                    onView={() => taskCrud.openView(t)}
                    onEdit={() => taskCrud.openEdit(t)}
                    onDelete={() => void taskCrud.askDelete(t)}
                  />
                ))}
              </ul>
              {tasks.length > TASKS_SHOWN && (
                <div className="ini-more-tasks no-print">
                  <button className="btn subtle small" aria-expanded={allTasks} onClick={() => setAllTasks((v) => !v)}>
                    {allTasks ? 'عرض أقل' : `عرض كل المهام (${tasks.length})`}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title={q.trim() ? 'لا مهام تطابق البحث' : area ? 'لا مهام في هذا المجال' : 'لا توجد مهام'}
              action={
                q.trim() || area ? (
                  <button
                    className="btn"
                    onClick={() => {
                      setQ('')
                      setArea('')
                    }}
                  >
                    مسح التصفية
                  </button>
                ) : (
                  <button className="btn primary" onClick={() => taskCrud.openNew(newTask())}>
                    <AddRegular /> إضافة مهمة
                  </button>
                )
              }
            />
          )
        ) : (
          view === 'list' && data.activities.length ? (
            <div className="ic-wrap">
              <ul className="ic-list ic-acts">
                {activitiesSorted.map((a) => (
                  <ActivityCard
                    key={a.id}
                    a={a}
                    data={data}
                    dates={activityDates(a)}
                    onView={() => crud.openView(a)}
                    onEdit={() => crud.openEdit(a)}
                    onDelete={() => void crud.askDelete(a)}
                  />
                ))}
              </ul>
            </div>
          ) : (
          <div className="section-body flush">
            <RecordCollection
              view={view}
              items={activitiesSorted}
              getTitle={(a) => a.title}
              onOpen={crud.openView}
              onEdit={crud.openEdit}
              onDelete={(a) => void crud.askDelete(a)}
              columns={[
                { label: 'الحالة', render: (a) => <StatusBadge options={activityStatuses} value={a.status} /> },
                { label: 'المجال', render: (a) => (a.domain ? labelOf(siteDomains, a.domain) : '—') },
                { label: 'الموعد', render: activityDates, className: 'nowrap' },
                { label: 'المسؤول', render: (a) => <Value v={a.responsible} empty="—" /> },
                { label: 'الشواهد', render: (a) => evidenceFor(data, { kind: 'activity', id: a.id }).length },
              ]}
              meta={(a) => (
                <>
                  <span>{activityDates(a)}</span>
                  <StatusBadge options={activityStatuses} value={a.status} />
                </>
              )}
              empty={
                <EmptyState
                  title="لم تُسجل أنشطة بعد"
                  action={
                    <button className="btn primary" onClick={() => crud.openNew(newActivity())}>
                      <AddRegular /> إضافة أول نشاط
                    </button>
                  }
                >
                  سجّلي أنشطة المبادرة المخططة والمنفذة، واربطي كل نشاط منفذ بشواهده.
                </EmptyState>
              }
            />
          </div>
          )
        )}
        <p className="caption ini-note">يُحتسب النشاط منفذًا عند تسجيله بحالة «منفذ» مع تاريخه.</p>
      </section>

      {/* ===== 05 ملخص التقرير ===== */}
      <section className="ini-sec ini-band ini-ivory bleed" id="ini-report" aria-labelledby="ini-report-title">
        <SecHead
          n="05"
          id="ini-report"
          title="ملخص الإنجاز"
          sub="مبني على السجلات الفعلية فقط، وما لم يُسجل يظهر بوضوح."
          actions={
            <>
              <a className="btn small" href={href('evidence')}>
                الشواهد
              </a>
              <a className="btn small" href={href('reports')}>
                التقارير
              </a>
            </>
          }
        />
        <dl className="ini-report">
          <div>
            <dt>ما نُفذ</dt>
            <dd>
              {done.length ? (
                <>
                  <strong className="ini-num">{done.length}</strong> {done.length === 1 ? 'نشاط منفذ' : 'أنشطة منفذة'}
                  <ul className="ini-plain">
                    {done.map((a) => (
                      <li key={a.id}>
                        {a.title} <span className="caption">{activityDates(a)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <span className="muted">لم يُسجل تنفيذ أي نشاط بعد.</span>
              )}
              {kpis.workshopsDone > 0 && <p className="caption">ورش منفذة: {kpis.workshopsDone}</p>}
            </dd>
          </div>
          <div>
            <dt>ما لم يُنفذ بعد</dt>
            <dd>
              {pending.length ? (
                <>
                  <strong className="ini-num">{pending.length}</strong> {pending.length === 1 ? 'نشاط مخطط' : 'أنشطة مخططة'}
                  <More label="عرض القائمة" className="tight">
                    <ul className="ini-plain">
                      {pending.map((a) => (
                        <li key={a.id}>{a.title}</li>
                      ))}
                    </ul>
                  </More>
                </>
              ) : (
                <span className="muted">لا أنشطة مخططة معلقة.</span>
              )}
            </dd>
          </div>
          <div>
            <dt>الشواهد المتاحة</dt>
            <dd>
              {evidenceTotal ? (
                <>
                  <strong className="ini-num">{evidenceTotal}</strong> {evidenceTotal === 1 ? 'شاهد مسجل' : 'شواهد مسجلة'}
                  <p className="caption">منها بملف أو رابط: {kpis.evidenceDocumented}</p>
                </>
              ) : (
                <span className="muted">لم تُسجل شواهد بعد.</span>
              )}
            </dd>
          </div>
          <div>
            <dt>النتائج الفعلية</dt>
            <dd>
              {ini.actualResults.trim() ? <p className="pre-line">{ini.actualResults}</p> : <span className="muted">لم تُسجل نتائج فعلية بعد.</span>}
            </dd>
          </div>
          <div className="wide">
            <dt>التحديات وإجراءات التحسين التالية</dt>
            <dd>
              {lines(ini.challenges).length ? (
                <>
                  {lines(ini.challenges).length} تحديات مسجلة، مع إجراءاتها التحسينية.
                  <More label="عرض التحديات والإجراءات" className="tight">
                    <ChallengePairs challenges={ini.challenges} improvements={ini.improvements} />
                  </More>
                </>
              ) : (
                <span className="muted">لم تُسجل تحديات بعد.</span>
              )}
            </dd>
          </div>
        </dl>
        {ini.achievementReport.trim() && (
          <More label="نص تقرير الإنجاز">
            <ReportDoc text={ini.achievementReport} />
          </More>
        )}
      </section>

      {editing && <ProfileEditor onClose={() => setEditing(false)} />}
      {crud.node}
      {taskCrud.node}
    </>
  )
}
