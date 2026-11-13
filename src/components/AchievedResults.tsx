// «النتائج المتحققة» في ملف المبادرة (طلب مديرة النظام 2026-11-13): تُستخرج تلقائيًا من الشواهد الموثقة
// ومؤشرات قياس الأثر المسجلة لكل برنامج، فتتحدث عند إضافة شاهد أو تسجيل نتيجة. لا يُعرض رقم دون بيانات مسجلة،
// ولا يُعد المستهدف نتيجة، ويُميَّز التدريب والحضور عن التطبيق العملي.
import { useStore } from '../data/store'
import type { ProgramMeasure } from '../data/types'
import { programs } from '../data/programs'
import { href } from '../lib/router'
import { measurePct } from './ProgramMeasures'

const countWord = (n: number, one: string, two: string, few: string, many: string) =>
  n === 1 ? `${one} واحد` : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`
const evidenceWord = (n: number) => countWord(n, 'شاهد', 'شاهدان', 'شواهد', 'شاهدًا')
const imagesWord = (n: number) => (n === 1 ? 'صورة واحدة' : n === 2 ? 'صورتان' : n <= 10 ? `${n} صور` : `${n} صورة`)

/** نوع النتيجة من اسم المؤشر: تطبيق عملي، أو تدريب وحضور، أو مؤشر عام */
const measureType = (m: ProgramMeasure) =>
  /التطبيق العملي|سلّمن|نفّذن/.test(m.title) ? 'تطبيق عملي' : /المتدربات|تدريب|حضر/.test(m.title) ? 'تدريب وحضور' : 'مؤشر'

export function AchievedResults() {
  const { data } = useStore()
  const groups = programs.map((p) => {
    const ev = data.evidence.filter((e) => e.programId === p.id)
    const kinds = p.kinds
      .map((k) => {
        const list = ev.filter((e) => e.programKind === k.id)
        return { label: k.label, n: list.length, imgs: list.reduce((s, e) => s + e.files.filter((f) => f.type.startsWith('image/')).length, 0) }
      })
      .filter((k) => k.n > 0)
    const ms = data.programMeasures.filter((m) => m.programId === p.id && m.actual.trim())
    return { p, ev, kinds, ms }
  })
  const evTotal = groups.reduce((s, g) => s + g.ev.length, 0)
  const withEv = groups.filter((g) => g.ev.length).length
  const msTotal = groups.reduce((s, g) => s + g.ms.length, 0)
  const manual = data.initiative.actualResults?.trim()

  return (
    <div className="ar">
      <p className="ar-sum">
        {evTotal || msTotal ? (
          <>
            وُثّق حتى الآن {evTotal ? evidenceWord(evTotal) : 'لا شواهد'} في {withEv} من {programs.length} برنامجًا، وسُجلت نتائج فعلية في {msTotal} من مؤشرات قياس الأثر.
          </>
        ) : (
          'لم تُسجل شواهد ولا نتائج فعلية بعد.'
        )}
      </p>
      <ol className="ar-list">
        {groups.map(({ p, kinds, ms }, n) => (
          <li key={p.id} className={`ar-item${kinds.length || ms.length ? '' : ' is-empty'}`}>
            <h5>
              <span className="ar-n" aria-hidden>
                {String(n + 1).padStart(2, '0')}
              </span>
              {p.name}
            </h5>
            {kinds.length || ms.length ? (
              <ul>
                {ms.map((m) => {
                  const pct = measurePct(m)
                  const actual = m.actual.replace(/\s*\([\d٠-٩.]+\s*[%٪]\)\s*$/, '')
                  return (
                    <li key={m.id}>
                      <span className="ar-kind">{measureType(m)}</span>
                      سُجّل في مؤشر «{m.title}»: {actual}
                      {m.target.trim() && !/[%٪]/.test(actual) ? ` من ${m.target.trim()}` : ''}
                      {pct !== null && !/[%٪]/.test(actual) ? ` (${pct}%)` : ''}.
                    </li>
                  )
                })}
                {kinds.map((k) => (
                  <li key={k.label}>
                    <span className="ar-kind ev">شواهد</span>
                    وُثّق {evidenceWord(k.n)} في «{k.label}»{k.imgs ? ` (${imagesWord(k.imgs)})` : ''}.
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-value">لم تُسجل نتائج موثقة بعد.</p>
            )}
          </li>
        ))}
      </ol>
      {manual && (
        <div className="ar-manual">
          <h5>نتائج أخرى مسجلة</h5>
          <p className="pre-line">{manual}</p>
        </div>
      )}
      <p className="caption ar-note">
        تتحدث هذه النتائج تلقائيًا من <a href={href('evidence')}>الشواهد</a> و<a href={href('impact')}>مؤشرات قياس الأثر</a>. لا يُعد المستهدف نتيجة، ولا تعني أعداد التدريب إتقان جميع المشاركات.
      </p>
    </div>
  )
}
