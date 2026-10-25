// صفحة العرض العامة للحوكمة: الوثيقة المرجعية، وثلاثة مؤشرات من البيانات الفعلية، ومسار تنفيذ من أربع مراحل، وأربعة محاور.
// التفاصيل الإدارية (العناصر وحالاتها والتقييم الذاتي) في لوحة المتابعة الداخلية #/governance/manage.
// لا يُعرض شيء معتمدًا أو مطبقًا إلا بما تثبته المراحل والشواهد المسجلة.
import type { ReactNode } from 'react'
import { DocumentRegular, OpenRegular } from '@fluentui/react-icons'
import { useStore } from '../data/store'
import type { AppData, GovernanceDoc, PolicyItem } from '../data/types'
import { approvalStages, coverageLevels, govDocStatuses } from '../data/options'
import { level3Options, policyLevel } from '../data/selectors'
import { Badge, EmptyState, Message, PageHeader, Section, StatusBadge } from '../components/ui'
import { useCrud } from '../components/records'
import { AttachmentList } from '../components/form'
import { useFeedback } from '../components/feedback'
import { More } from '../components/InitiativeSections'
import { policyConfig } from './GovernanceAdminPage'
import { DocRefView, GovDocViewBody, govDocConfig } from '../components/GovDocs'
import { openStoredFile } from '../lib/fileStore'
import { formatDate, formatNumber } from '../lib/util'

/* ===== المحاور الأربعة ===== */

interface Axis {
  key: string
  title: string
  desc: string
  /** أقسام ملف السياسة (بمعرفاتها) التي تندرج تحت المحور */
  sections: string[]
  /** عناصر الحوكمة التي تندرج تحته بأسمائها؛ وغيرها يُوزع بحسب أقسامه */
  elements: string[]
}

const axes: Axis[] = [
  {
    key: 'policy',
    title: 'سياسة الاستخدام المسؤول',
    desc: 'المبادئ الحاكمة، والنطاق والفئات المشمولة، وضوابط الاستخدام المقبول وغير المقبول.',
    sections: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p8', 'p19', 's1'],
    elements: ['سياسة الاستخدام المسؤول للذكاء الاصطناعي'],
  },
  {
    key: 'controls',
    title: 'الضوابط والمسؤوليات',
    desc: 'الأدوار والصلاحيات، وحماية الخصوصية والبيانات، والنزاهة الأكاديمية، والتحقق من المخرجات بإشراف بشري، وأمن الحسابات.',
    sections: ['p7', 'p9', 'p10', 'p11', 'p12', 'p13', 'p14', 's2', 's3', 's4', 's5', 's6', 's7', 's9'],
    elements: ['حماية البيانات والخصوصية', 'النزاهة الأكاديمية', 'التحقق من صحة المخرجات', 'الإشراف البشري', 'أمن الحسابات والأجهزة'],
  },
  {
    key: 'practice',
    title: 'التنفيذ والتوعية',
    desc: 'توعية المعلمات والطالبات وتدريبهن، وآلية التنفيذ والمتابعة وقياس الالتزام.',
    sections: ['p15', 'p16', 's8'],
    elements: ['توعية المعلمات', 'توعية الطالبات'],
  },
  {
    key: 'improve',
    title: 'التوثيق والتحسين المستمر',
    desc: 'مؤشرات الأداء، والمراجعة الدورية والتحديث، والنماذج التشغيلية، وإثباتات الاعتماد والتطبيق.',
    sections: ['p17', 'p18', 'p20', 's10'],
    elements: ['إجراءات مراجعة السياسات وتحديثها', 'إثباتات الاعتماد والنشر والتطبيق'],
  },
]

/** محور العنصر: بالاسم أولًا، ثم بالمحور الذي يضم أكثر أقسامه، وإلا المحور الأول */
function axisOf(p: PolicyItem): string {
  const byName = axes.find((a) => a.elements.includes(p.element.trim()))
  if (byName) return byName.key
  const secs = p.docRef?.sectionIds ?? []
  let best = axes[0]
  let hits = 0
  for (const a of axes) {
    const n = secs.filter((s) => a.sections.includes(s)).length
    if (n > hits) [best, hits] = [a, n]
  }
  return best.key
}

/** أقسام الوثيقة في كل محور؛ القسم غير المعروف يُضاف إلى المحور الأول حتى لا يختفي */
function sectionsOf(doc: GovernanceDoc | undefined, axis: Axis) {
  if (!doc) return []
  const known = new Set(axes.flatMap((a) => a.sections))
  return doc.sections
    .map((s, i) => ({ ...s, n: i + 1 }))
    .filter((s) => axis.sections.includes(s.id) || (axis === axes[0] && !known.has(s.id)))
}

/** «لم تُقيَّم» لا تُحسب تغطية جزئية: تُذكر منفصلة */
function coverageOf(items: PolicyItem[]): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  const cov = items.map((p) => p.docRef?.coverage ?? '')
  const open = cov.filter((c) => !c).length
  if (!items.length || open === cov.length) return { label: 'لم تُقيَّم بعد', tone: 'neutral' }
  if (cov.some((c) => c === 'partial' || c === 'none')) return { label: 'مغطى جزئيًا في النص', tone: 'warning' }
  if (!open) return { label: 'مغطى في نص السياسة', tone: 'success' }
  return { label: `مغطى، و${formatNumber(open)} لم يُقيَّم بعد`, tone: 'neutral' }
}

function proofOf(data: AppData, items: PolicyItem[]): { label: string; tone: 'success' | 'brand' | 'neutral' } {
  const done = items.filter((p) => policyLevel(data, p).level === 'done').length
  if (!items.length || done === 0) return { label: 'لم يُثبت بشاهد بعد', tone: 'neutral' }
  if (done === items.length) return { label: 'مثبت بشواهد', tone: 'success' }
  return { label: `مثبت جزئيًا (${formatNumber(done)} من ${formatNumber(items.length)})`, tone: 'brand' }
}

/* ===== مسار التنفيذ: المراحل الست مجمعة في أربع ===== */

const pathSteps: { title: string; keys: (typeof approvalStages)[number]['key'][] }[] = [
  { title: 'إعداد السياسة', keys: ['prepare'] },
  { title: 'المراجعة والاعتماد', keys: ['review', 'approve'] },
  { title: 'التطبيق', keys: ['publish', 'apply'] },
  { title: 'التوثيق والتحسين', keys: ['document'] },
]

function stepState(doc: GovernanceDoc, keys: (typeof approvalStages)[number]['key'][]) {
  const st = keys.map((k) => doc.stages[k])
  const done = st.filter((s) => s.status === 'done')
  const level = done.length === st.length ? 'done' : done.length || st.some((s) => s.status === 'in_progress') ? 'in_progress' : 'not_started'
  const label = level === 'done' ? 'مكتملة' : level === 'in_progress' ? 'جارية' : 'لم تبدأ'
  const date = level === 'done' ? done.map((s) => s.date).filter(Boolean).sort().pop() : ''
  const parts = keys.length > 1 ? keys.map((k, i) => `${approvalStages.find((a) => a.key === k)!.label}: ${st[i].status === 'done' ? 'مكتملة' : st[i].status === 'in_progress' ? 'جارية' : 'لم تبدأ'}`) : []
  return { level, label, date, parts }
}

/* ===== الصفحة ===== */

export default function GovernancePage() {
  const { data } = useStore()
  const { toast } = useFeedback()
  const doc = data.govDocs[0]
  const crud = useCrud<PolicyItem>(
    'policies',
    { ...policyConfig, viewIntro: (p) => <DocRefView item={p} onOpenDoc={(d) => docCrud.openView(d)} /> },
    (p) => p.docName || p.element,
  )
  const docCrud = useCrud<GovernanceDoc>(
    'govDocs',
    { ...govDocConfig, viewOutro: (d) => <GovDocViewBody doc={d} onOpenElement={(p) => (docCrud.close(), crud.openView(p))} /> },
    (d) => d.title,
  )

  const approved = !!doc && (doc.status === 'approved' || doc.status === 'published') && doc.stages.approve.status === 'done'
  const openDoc = async () => {
    if (!doc) return
    if (doc.files[0] && (await openStoredFile(doc.files[0].id).catch(() => false))) return
    if (doc.url) return void window.open(doc.url, '_blank', 'noopener')
    if (doc.files[0]) toast('ملف الوثيقة غير موجود في متصفح هذا الجهاز.', 'error')
    docCrud.openView(doc)
  }

  const linked = data.policies.filter((p) => p.docRef?.docId && p.docRef.docId === doc?.id)
  const fullCov = linked.filter((p) => p.docRef!.coverage === 'full').length
  const proven = data.policies.filter((p) => policyLevel(data, p).level === 'done').length
  const companions = doc?.companionFiles ?? []

  return (
    <>
      <PageHeader
        title="الحوكمة والاستخدام المسؤول"
        lead="كيف تنظم المدرسة استخدام الذكاء الاصطناعي: سياسة مرجعية واحدة، وأربعة محاور، وحالة تنفيذ تُثبت بالشواهد."
      />

      {!doc ? (
        <EmptyState title="لا توجد وثيقة حوكمة مسجلة" />
      ) : (
        <>
          <Section id="gov-doc" title="الوثيقة المرجعية">
            <article className={`gv-doc ${approved ? 'is-approved' : 'is-draft'}`} aria-labelledby="gv-doc-title">
              <div className="gv-doc-main">
                <span className="gv-doc-icon" aria-hidden>
                  <DocumentRegular />
                </span>
                <div className="gv-doc-text">
                  <span className="gv-stamp">{approved ? 'وثيقة معتمدة' : 'مسودة غير معتمدة'}</span>
                  <h3 id="gv-doc-title">{doc.title}</h3>
                  <p className="gv-doc-meta">
                    <StatusBadge options={govDocStatuses} value={doc.status} />
                    {doc.version && <span>الإصدار {doc.version}</span>}
                    <span>آخر تحديث {formatDate(doc.updatedAt)}</span>
                  </p>
                  {!approved && (
                    <p className="gv-doc-note">
                      الوثيقة مُعدّة للمراجعة، ولم تُسجل بعد مرحلة اعتمادها من صاحبة الصلاحية. وجودها لا يعني اعتمادها أو تطبيقها.
                    </p>
                  )}
                </div>
                <div className="gv-doc-actions no-print">
                  <button className="btn primary" onClick={() => void openDoc()}>
                    <OpenRegular /> عرض الوثيقة
                  </button>
                  <button className="btn" onClick={() => docCrud.openView(doc)}>
                    التفاصيل وسجل الإصدارات
                  </button>
                </div>
              </div>
              {(doc.files.length > 0 || companions.length > 0) && (
                <More label={`الملفات والتقارير المرافقة (${formatNumber(doc.files.length + companions.length)})`} className="gv-files">
                  {doc.files.length > 0 && <AttachmentList items={doc.files} />}
                  {companions.length > 0 && (
                    <>
                      <p className="caption">تقرير مرافق للتحقق والمطابقة، لا يُعد اعتمادًا ولا جزءًا من السياسة:</p>
                      <AttachmentList items={companions} />
                    </>
                  )}
                </More>
              )}
            </article>

            <dl className="gv-kpis" aria-label="مؤشرات الحوكمة">
              <Kpi label="حالة السياسة" value={govDocStatuses.find((o) => o.value === doc.status)?.label ?? '—'} note={doc.version ? `الإصدار ${doc.version}` : undefined} />
              <Kpi
                label="عناصر مغطاة في نص السياسة"
                value={`${formatNumber(fullCov)} من ${formatNumber(linked.length)}`}
                note="بعد مراجعة نص الملف، لا تعني اعتمادًا"
              />
              <Kpi label="عناصر مطبقة بشواهد" value={`${formatNumber(proven)} من ${formatNumber(data.policies.length)}`} note="اعتماد أو تطبيق يثبته شاهد مرتبط" />
            </dl>
          </Section>

          <Section id="gov-path" title="مسار التنفيذ" sub="الحالة المسجلة فعليًا لكل مرحلة. كل مرحلة بعد الإعداد تتطلب تاريخًا وشاهدًا." band="ivory">
            <ol className="gv-path">
              {pathSteps.map((s, i) => {
                const st = stepState(doc, s.keys)
                return (
                  <li key={s.title} className={`st-${st.level}`}>
                    <span className="gv-node" aria-hidden>
                      {formatNumber(i + 1)}
                    </span>
                    <span className="gv-step-title">{s.title}</span>
                    <span className="gv-step-state">
                      <StatusBadge options={level3Options.map((o) => ({ ...o, label: o.value === st.level ? st.label : o.label }))} value={st.level} />
                      {st.date && <span className="caption">{formatDate(st.date)}</span>}
                    </span>
                    {st.parts.length > 0 && <span className="caption gv-step-parts">{st.parts.join(' · ')}</span>}
                  </li>
                )
              })}
            </ol>
          </Section>

          <Section id="gov-axes" title="محاور الحوكمة" sub="أقسام السياسة العشرون مجمعة في أربعة محاور. تفاصيل كل محور وأقسامه تُفتح عند الحاجة.">
            <ol className="gv-axes">
              {axes.map((a, i) => {
                const items = data.policies.filter((p) => axisOf(p) === a.key)
                const secs = sectionsOf(doc, a)
                const cov = coverageOf(items)
                const proof = proofOf(data, items)
                return (
                  <li key={a.key}>
                    <span className="gv-axis-n" aria-hidden>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="gv-axis-body">
                      <h3>{a.title}</h3>
                      <p>{a.desc}</p>
                      <dl className="gv-axis-state">
                        <div>
                          <dt>في الوثيقة</dt>
                          <dd>
                            <Badge tone={cov.tone}>{cov.label}</Badge>
                          </dd>
                        </div>
                        <div>
                          <dt>التطبيق</dt>
                          <dd>
                            <Badge tone={proof.tone}>{proof.label}</Badge>
                          </dd>
                        </div>
                      </dl>
                      <More label={`الضوابط والأقسام (${formatNumber(items.length)} عناصر · ${formatNumber(secs.length)} أقسام)`}>
                        {items.length > 0 && (
                          <ul className="gv-els">
                            {items.map((p) => (
                              <li key={p.id}>
                                <button type="button" className="link-btn" onClick={() => crud.openView(p)}>
                                  {p.element}
                                </button>
                                <StatusBadge options={coverageLevels} value={p.docRef?.coverage ?? ''} />
                                {p.docRef?.coverageNote && <span className="caption">{p.docRef.coverageNote}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                        {secs.length > 0 && (
                          <ul className="gv-secs">
                            {secs.map((s) => (
                              <li key={s.id}>
                                <span>
                                  {formatNumber(s.n)}. {s.title}
                                </span>
                                {s.text && <span className="caption">{s.text}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </More>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Section>

          <Message tone="info">
            تُعتمد السياسات وفق صلاحيات المدرسة والأنظمة المعمول بها، وما يُسجل هنا توثيق داخلي لا يُعد اعتمادًا. تفاصيل العناصر وحالاتها وشواهدها في{' '}
            <a href="#/governance/manage">لوحة متابعة الحوكمة</a>.
          </Message>
        </>
      )}

      {crud.node}
      {docCrud.node}
    </>
  )
}

function Kpi({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span className="gv-kpi-v">{value}</span>
        {note && <span className="caption">{note}</span>}
      </dd>
    </div>
  )
}
