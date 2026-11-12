import { useStore } from '../data/store'
import { kindOf, programById, programs } from '../data/programs'
import { imagesOf } from '../components/ProgramEvidence'
import { useImageUrl } from '../components/EvidenceGallery'
import { Message, Progress, Section } from '../components/ui'
import { InitiativeShowcase } from '../components/InitiativeShowcase'
import { AddRegular } from '@fluentui/react-icons'
import { href } from '../lib/router'
import { identityHeader } from '../components/identity'
import { useHeroDepth } from '../lib/motion'
import { formatDate, formatNumber } from '../lib/util'

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

  // الموقع قائم على شواهد البرامج (طلب مديرة النظام 2026-11-12)، فالمؤشرات والمتابعة تُحسب منها فقط
  const progEvidence = data.evidence.filter((e) => programById(e.programId))
  const imageCount = progEvidence.reduce((n, e) => n + imagesOf(e).length, 0)
  const programsWithEvidence = programs.filter((p) => progEvidence.some((e) => e.programId === p.id)).length
  const measured = data.programMeasures.filter((m) => m.actual.trim()).length
  const recent = [...progEvidence].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4)

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
            <p className="lead hp-a2">منصة توثّق شواهد برامج المدرسة في التحول بالذكاء الاصطناعي، وتتابع أثرها.</p>
            <div className="actions no-print hp-a3">
              <a className="btn primary" href={href('evidence')}>
                الشواهد والأدلة
              </a>
              <a className="btn" href={href('initiative')}>
                ملف المبادرة
              </a>
            </div>
          </div>
        </div>
      </header>

      <section className="stats-sec" aria-labelledby="kpi-title">
        <div className="stats-head">
          <h2 id="kpi-title" className="section-title">
            مؤشرات التوثيق
          </h2>
          <p className="sub">تُحسب تلقائيًا من الشواهد المضافة</p>
        </div>
        <div className="stats-4">
          <Stat tint="green" label="الشواهد الموثقة" value={progEvidence.length} empty={progEvidence.length === 0} note="شواهد مضافة للبرامج" />
          <Stat tint="green" label="صور الشواهد" value={imageCount} empty={imageCount === 0} note="صور مرفقة بالشواهد" />
          <Stat tint="gold" label="برامج لها شواهد" value={programsWithEvidence} empty={progEvidence.length === 0} note={`من ${formatNumber(programs.length)} برنامجًا`} />
          <Stat tint="gold" label="مؤشرات أثر مقيسة" value={measured} empty={data.programMeasures.length === 0} note="مؤشرات سُجلت نتيجتها الفعلية" />
        </div>
      </section>

      {program.recognitionStatus === 'recorded' ? (
        <Message tone="success" title="حالة الاعتراف الرسمية مسجلة بدليل">
          سُجلت حالة اعتراف رسمية بتاريخ {formatDate(program.recognitionDate)}.
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

      <div className="home-pair">
        <Section
          title="متابعة توثيق البرامج"
          sub="عناصر الشواهد الموثقة في كل برنامج"
          actions={
            <a className="btn small" href={href('evidence')}>
              كل الشواهد
            </a>
          }
        >
          <ul className="hp-progs">
            {programs.map((p) => {
              const list = progEvidence.filter((e) => e.programId === p.id)
              const covered = p.kinds.filter((k) => list.some((e) => e.programKind === k.id)).length
              const pct = Math.round((covered / p.kinds.length) * 100)
              return (
                <li key={p.id}>
                  <div className="hp-prog-row">
                    <span className="hp-prog-name">{p.name}</span>
                    <span className="caption nowrap">
                      {covered} من {p.kinds.length}
                    </span>
                  </div>
                  <Progress pct={pct} tone={pct === 100 ? 'success' : undefined} />
                </li>
              )
            })}
          </ul>
        </Section>

        <Section
          title="آخر الشواهد"
          actions={
            <a className="btn small primary edit-only" href={href('evidence', 'new')}>
              <AddRegular /> إضافة شاهد
            </a>
          }
        >
          {recent.length === 0 ? (
            <p className="empty-inline">لم تُضف شواهد بعد.</p>
          ) : (
            <ul className="hp-recent">
              {recent.map((e) => (
                <li key={e.id}>
                  <a href={href('evidence', e.id)}>
                    <span className="hp-recent-img">
                      <RecentThumb id={imagesOf(e)[0]?.id} />
                    </span>
                    <span className="hp-recent-text">
                      <strong>{kindOf(e.programId, e.programKind)?.label ?? e.title}</strong>
                      <span className="caption">{programById(e.programId)?.name}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  )
}

function RecentThumb({ id }: { id?: string }) {
  const url = useImageUrl(id)
  return url ? <img src={url} alt="" loading="lazy" decoding="async" /> : null
}
