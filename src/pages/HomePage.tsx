import { useStore } from '../data/store'
import { computeKpis, policyLevel } from '../data/selectors'
import type { Task } from '../data/types'
import { useCrud } from '../components/records'
import { taskConfig } from '../components/taskConfig'
import { activityStatuses, evidenceTypes, labelOf, reviewStatuses, siteDomains, taskStatuses } from '../data/options'
import { Badge, Message, Section, StatusBadge } from '../components/ui'
import { InitiativeShowcase } from '../components/InitiativeShowcase'
import { AddRegular } from '@fluentui/react-icons'
import { href } from '../lib/router'
import { identityHeader } from '../components/identity'
import { useHeroDepth } from '../lib/motion'
import { formatDate, formatNumber, todayIso } from '../lib/util'

/** مربع إحصاء: الرقم أولًا ثم التسمية. بلا بيانات يظهر «—» مع عبارة واضحة، ولا يُخترع رقم */
function Stat({ label, value, note, empty, tint }: { label: string; value: number; note: string; empty?: boolean; tint: string }) {
  return (
    <div className={`stat tint-${tint}`}>
      {empty ? (
        <span className="stat-value is-empty">
          <span aria-hidden>—</span>
          <span className="sr-only">لم تُسجل بيانات بعد</span>
        </span>
      ) : (
        <span className="stat-value">{formatNumber(value)}</span>
      )}
      <span className="stat-label">{label}</span>
      <span className="stat-note">{empty ? 'لم تُسجل بيانات بعد' : note}</span>
    </div>
  )
}

export default function HomePage() {
  const { data } = useStore()
  const { settings: s, initiative: ini, program } = data
  const heroRef = useHeroDepth<HTMLElement>()
  const k = computeKpis(data)
  const today = todayIso()

  // المنفذ أولًا (الأحدث فالأقدم)، ثم المخطط بحسب موعده
  const recentActivities = [...data.activities]
    .sort((a, b) =>
      a.status === 'implemented' || b.status === 'implemented'
        ? Number(b.status === 'implemented') - Number(a.status === 'implemented') || (b.date || '').localeCompare(a.date || '')
        : (a.date || '9999').localeCompare(b.date || '9999'),
    )
    .slice(0, 5)
  const recentEvidence = [...data.evidence].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  const taskCrud = useCrud<Task>('tasks', taskConfig, (t) => t.title)
  const openCount = data.tasks.filter((t) => t.status !== 'done').length
  const openTasks = data.tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
    .slice(0, 5)

  const govDone = data.policies.filter((p) => policyLevel(data, p).level === 'done').length
  const journey = [
    {
      title: 'التخطيط والحوكمة',
      text: 'خطة المبادرة وسياسات الاستخدام المسؤول للذكاء الاصطناعي.',
      stat: `${govDone} من ${data.policies.length} عناصر حوكمة مكتملة بشاهد`,
      count: govDone,
      route: 'governance',
    },
    {
      title: 'بناء قدرات المعلمات',
      text: 'ورش تدريبية موثقة بالحضور والتطبيق وقياس الاستفادة.',
      stat: `${data.workshops.length} ورشة مسجلة`,
      count: data.workshops.length,
      route: 'professional',
    },
    {
      title: 'التطبيق في الصفوف',
      text: 'ممارسات تعليمية مبتكرة موثقة بخطواتها ونتائجها الفعلية.',
      stat: `${data.practices.filter((p) => !p.isTemplate).length} ممارسة مسجلة`,
      count: data.practices.filter((p) => !p.isTemplate).length,
      route: 'teaching',
    },
    {
      title: 'مشروعات الطالبات',
      text: 'حلول لمشكلات حقيقية مع حماية هوية الطالبات.',
      stat: `${data.projects.length} مشروع مسجل`,
      count: data.projects.length,
      route: 'projects',
    },
    {
      title: 'قياس الأثر والاستعداد',
      text: 'خط أساس ومستهدف ونتيجة فعلية، وربط الشواهد بمؤشرات المقياس.',
      stat: `${data.impact.length} مؤشر أثر، ${data.indicators.length} مؤشر جاهزية`,
      count: data.impact.length + data.indicators.length,
      route: 'readiness',
    },
  ]

  return (
    <>
      <header className="hero hp bleed" ref={heroRef}>
        {/* الصورة البانورامية مرتكزة يمينًا (الكرة واليد)، وحجاب لوني يغطي نصوص الصورة كي يظهر الاسم الصحيح نصًا */}
        <div className="hp-art">
          <div className="hp-pic">
            <img src={identityHeader} width={1280} height={426} alt="يد آلية تحمل الكرة الأرضية، من هوية معرض التمكين المدرسي" fetchPriority="high" />
          </div>
        </div>
        <div className="hp-tech" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={`hp-sq hp-sq-${i}`} />
          ))}
        </div>
        <div className="hp-inner">
          <div className="hero-text hp-text">
            {/* الأسماء في الترويسة الموحدة أعلى الصفحة؛ العنوان هنا لقارئات الشاشة فقط */}
            <h1 className="sr-only">{s.exhibitName}</h1>
            <p className="hp-tag hp-a1">الابتكار · التقنية · المستقبل</p>
            <p className="lead hp-a2">منصة توثّق خطة المدرسة للتحول بالذكاء الاصطناعي، وشواهدها، وأثرها.</p>
            <div className="actions no-print hp-a3">
              <a className="btn primary" href={href('evidence')}>
                الشواهد والأدلة
              </a>
              <a className="btn" href={href('readiness')}>
                لوحة الجاهزية
              </a>
            </div>
          </div>
        </div>
      </header>

      <section className="stats-sec" aria-labelledby="kpi-title">
        <div className="stats-head">
          <h2 id="kpi-title" className="section-title">
            مؤشرات المبادرة
          </h2>
          <p className="sub">تُحسب تلقائيًا من البيانات المسجلة في المعرض</p>
        </div>
        <div className="stats-6">
          <Stat tint="green" label="الأنشطة المنفذة" value={k.activitiesDone} empty={data.activities.length === 0} note="أنشطة بحالة «منفذ»" />
          <Stat tint="green" label="الشواهد الموثقة" value={k.evidenceDocumented} empty={data.evidence.length === 0} note="شواهد لها ملف أو رابط" />
          <Stat tint="gold" label="المؤشرات المكتملة" value={k.indicatorsComplete} empty={k.indicatorsTotal === 0} note="مكتملة داخليًا من مؤشرات المقياس" />
          <Stat tint="green" label="ورش منفذة" value={k.workshopsDone} empty={data.workshops.length === 0} note="ورش بتاريخ تنفيذ ماضٍ" />
          <Stat
            tint="green"
            label="ممارسات ومشروعات موثقة"
            value={k.documentedProjects}
            empty={data.practices.filter((p) => !p.isTemplate).length + data.projects.length === 0}
            note="مكتملة الحقول ولها شاهد"
          />
          <Stat tint="gold" label="مؤشرات تحتاج استكمالًا" value={k.indicatorsPending} empty={k.indicatorsTotal === 0} note="كل ما لم يكتمل داخليًا" />
        </div>
      </section>

      {program.recognitionStatus === 'recorded' ? (
        <Message tone="success" title="حالة الاعتراف الرسمية مسجلة بدليل">
          سُجلت حالة اعتراف رسمية بتاريخ {formatDate(program.recognitionDate)}. راجعي الدليل في لوحة الجاهزية.
        </Message>
      ) : (
        <Message tone="info">
          أداة داخلية للتوثيق والاستعداد لمتطلبات Microsoft Elevate Showcase School، ولا تعني حصول المدرسة على اعتراف من Microsoft أو ضمانه.
        </Message>
      )}

      <InitiativeShowcase
        ini={ini}
        compact
        actions={
          <a className="btn" href={href('initiative')}>
            ملف المبادرة الكامل
          </a>
        }
      />

      <section className="band bleed journey on-dark" aria-labelledby="journey-title">
        <div className="band-head">
          <h2 id="journey-title">رحلة التحول المدرسي</h2>
          <p className="sub">خمس مراحل، وما سُجل فعليًا في كل منها</p>
        </div>
        <ol className="steps">
          {journey.map((j, i) => (
            <li key={j.title} className={j.count > 0 ? 'has-records' : undefined}>
              <div className="n">
                <span className="num" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>المرحلة {i + 1}</span>
              </div>
              <h3>
                <a href={href(j.route)}>{j.title}</a>
              </h3>
              <p className="step-text">{j.text}</p>
              <div className="step-stat">{j.stat}</div>
            </li>
          ))}
        </ol>
        {ini.journey && <div className="pre-line journey-note">{ini.journey}</div>}
      </section>

      <div className="home-pair">
        <Section
          title="الأنشطة الأخيرة"
          actions={
            <a className="btn small" href={href('initiative')}>
              كل الأنشطة
            </a>
          }
          flush
        >
          {recentActivities.length === 0 ? (
            <p className="empty-inline">لم تُسجل أنشطة بعد. تُضاف من ملف المبادرة.</p>
          ) : (
            <ul className="list">
              {recentActivities.map((a) => (
                <li key={a.id}>
                  <div className="item-main">
                    <div className="item-title">{a.title}</div>
                    <div className="item-meta">
                      {a.date && <span>{formatDate(a.date)}</span>}
                      {a.domain && <span>{labelOf(siteDomains, a.domain)}</span>}
                    </div>
                  </div>
                  <StatusBadge options={activityStatuses} value={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="الشواهد والأدلة"
          sub={data.evidence.length ? `${formatNumber(data.evidence.length)} شاهد مسجل` : undefined}
          actions={
            <>
              <a className="btn small" href={href('evidence')}>
                كل الشواهد
              </a>
              <a className="btn small primary" href={href('evidence', 'new')}>
                <AddRegular /> إضافة شاهد
              </a>
            </>
          }
          flush
        >
          {recentEvidence.length === 0 ? (
            <p className="empty-inline">لا توجد شواهد بعد. أضيفي أول شاهد واربطيه بنشاط أو مؤشر.</p>
          ) : (
            <ul className="list">
              {recentEvidence.map((e) => (
                <li key={e.id}>
                  <div className="item-main">
                    <a className="item-title" href={href('evidence', e.id)}>
                      {e.title}
                    </a>
                    <div className="item-meta">
                      <span>{labelOf(evidenceTypes, e.type)}</span>
                      {e.executedOn && <span>{formatDate(e.executedOn)}</span>}
                      <span>{e.links.length ? `مرتبط بـ ${formatNumber(e.links.length)}` : 'غير مرتبط بعد'}</span>
                    </div>
                  </div>
                  <StatusBadge options={reviewStatuses} value={e.reviewStatus} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="المهام التي تحتاج إلى متابعة"
        sub={openCount ? `${formatNumber(openCount)} مهمة مفتوحة` : undefined}
        actions={
          <a className="btn small" href={href('initiative')}>
            كل المهام
          </a>
        }
        flush
      >
        {openTasks.length === 0 ? (
          <p className="empty-inline">لا توجد مهام مفتوحة.</p>
        ) : (
          <ul className="list task-mini">
            {openTasks.map((t) => (
              <li key={t.id}>
                <button type="button" className="task-mini-btn" onClick={() => taskCrud.openView(t)}>
                  <span className="item-title">{t.title}</span>
                  <span className="task-mini-meta">
                    <StatusBadge options={taskStatuses} value={t.status} />
                    <span className="nowrap caption">{t.due ? formatDate(t.due) : 'بلا موعد'}</span>
                    {t.due && t.due < today && <Badge tone="danger">متأخرة</Badge>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {taskCrud.node}
    </>
  )
}
