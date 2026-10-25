// عرض تحريري لتعريف المبادرة: رأس كحلي، ثم الرؤية والهدف العام، ثم مسار الأهداف التنفيذية، ثم بيانات التنفيذ.
// يقرأ من ملف المبادرة مباشرة، فأي تعديل في الملف يظهر هنا دون تغيير في الشيفرة.
import type { CSSProperties, ReactNode } from 'react'
import type { InitiativeProfile } from '../data/types'
import { StatusBadge, Value } from './ui'
import { initiativeStatuses } from '../data/options'
import { goalParts } from './InitiativeSections'

/** يحوّل نص الأهداف إلى عناصر: سطر لكل هدف، مع إزالة الترقيم أو الرموز المكتوبة يدويًا */
export function splitGoals(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-–•*·]|\(?[0-9٠-٩]+[).\-–]|[0-9٠-٩]+\s*[-–])\s*/, '').trim())
    .filter(Boolean)
}

/** رمز الرؤية: أفق وقوس صاعد نحو نقطة */
function VisionGlyph() {
  return (
    <svg className="ip-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M6 34 H42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 34 A14 14 0 0 1 38 34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.45" />
      <path d="M16 34 A8 8 0 0 1 32 34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.7" />
      <circle cx="35" cy="13" r="3.5" style={{ fill: 'var(--color-accent)' }} />
    </svg>
  )
}

/** رمز الهدف: حلقات متحدة المركز ونقطة في المنتصف */
function GoalGlyph() {
  return (
    <svg className="ip-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
      <circle cx="24" cy="24" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.7" />
      <circle cx="24" cy="24" r="4" style={{ fill: 'var(--color-accent)' }} />
    </svg>
  )
}

export function InitiativeShowcase({
  ini,
  context,
  actions,
  details,
  facts,
  compact,
}: {
  ini: InitiativeProfile
  /** سطر إضافي تحت الحالة (مثل تاريخ آخر تعديل) */
  context?: ReactNode
  actions?: ReactNode
  /** حقول إضافية تُعرض قبل بيانات التنفيذ (مثل المبررات في صفحة الملف) */
  details?: ReactNode
  /** إخفاء شريط بيانات التنفيذ إذا عُرض في مكان آخر */
  facts?: boolean
  /** عرض مختصر: الاسم والرؤية والهدف العام فقط (التفاصيل في ملف المبادرة) */
  compact?: boolean
}) {
  const goals = splitGoals(ini.executionGoals)
  return (
    <section className={`ip bleed${compact ? ' ip-compact' : ''}`} aria-labelledby="ip-title">
      <header className="ip-head">
        <div className="ip-head-text">
          <h2 id="ip-title" className="eyebrow">
            تعريف المبادرة
          </h2>
          <p className="ip-name">{ini.name || <span className="empty-value">لم يُسجل اسم المبادرة بعد</span>}</p>
          <div className="ip-meta">
            <StatusBadge options={initiativeStatuses} value={ini.status} />
            <span className="ip-lead">
              <span>المسؤولة:</span>
              <Value v={ini.lead} />
            </span>
            {context && <span className="caption">{context}</span>}
          </div>
        </div>
        {actions && <div className="actions no-print">{actions}</div>}
      </header>

      <div className="ip-pair">
        <div className="ip-vision">
          <div className="ip-label">
            <VisionGlyph />
            <h3>الرؤية</h3>
          </div>
          <p className="ip-statement">
            <Value v={ini.vision} />
          </p>
        </div>
        <div className="ip-goal">
          <div className="ip-label">
            <GoalGlyph />
            <h3>الهدف العام</h3>
          </div>
          <p className="ip-statement">
            <Value v={ini.generalGoal} />
          </p>
        </div>
      </div>

      {!compact && (
      <div className="ip-goals">
        <div className="ip-goals-head">
          <h3 className="section-title">الأهداف التنفيذية</h3>
          {goals.length > 0 && <span className="caption">{goals.length} أهداف</span>}
        </div>
        {goals.length ? (
          <ol className="ip-path" style={{ "--rows": Math.ceil(goals.length / 2) } as CSSProperties}>
            {goals.map((g, i) => (
              <li key={i}>
                <span className="ip-num" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="ip-goal-text">
                  {goalParts(g)[0] ? (
                    <>
                      <strong>{goalParts(g)[0]}</strong> {goalParts(g)[1]}
                    </>
                  ) : (
                    g
                  )}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-value">لم تُسجل الأهداف التنفيذية بعد. أضيفيها من ملف المبادرة، هدفًا في كل سطر.</p>
        )}
      </div>
      )}

      {details}

      {facts !== false && !compact && (
        <dl className="ip-facts">
          <div>
            <dt>الفئات المستهدفة</dt>
            <dd>
              <Value v={ini.targetGroups} />
            </dd>
          </div>
          <div>
            <dt>مدة التنفيذ</dt>
            <dd>
              <Value v={ini.duration} />
            </dd>
          </div>
          <div>
            <dt>الجهات الداعمة</dt>
            <dd>
              <Value v={ini.supporters} empty="لا توجد جهات داعمة مسجلة" />
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}
