// ملف المبادرة في ستة تبويبات على هيئة بطاقات، ومحتوى التبويب المحدد في مساحة واحدة أسفلها.
// المحتوى من حقول الملف المسجلة فقط؛ الحقل الفارغ يُذكر في سطر «لم يُسجل بعد» ولا يُملأ بتخمين.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { EditRegular } from '@fluentui/react-icons'
import type { InitiativeProfile, Settings } from '../data/types'
import { initiativeStatuses } from '../data/options'
import { StatusBadge, Value } from './ui'
import { firstClause, goalParts, lines, splitLead, stripMarker } from './InitiativeSections'
import { formatDateTime } from '../lib/util'

const tabs = [
  { key: 'about', title: 'التعريف بالمبادرة' },
  { key: 'vision', title: 'الرؤية والرسالة' },
  { key: 'goals', title: 'الأهداف' },
  { key: 'why', title: 'المبررات والمشكلة' },
  { key: 'roles', title: 'الفئات المستهدفة والأدوار' },
  { key: 'scope', title: 'النطاق والمخرجات المتوقعة' },
] as const
type TabKey = (typeof tabs)[number]['key']

const STORE_KEY = 'ini-profile-tab'
const readTab = (): TabKey => {
  try {
    const v = localStorage.getItem(STORE_KEY)
    return tabs.some((t) => t.key === v) ? (v as TabKey) : 'about'
  } catch {
    return 'about'
  }
}

const has = (v?: string) => !!v?.trim()

/** سطر يجمع الحقول غير المسجلة في التبويب، مع زر لإكمالها */
function Missing({ items, onEdit }: { items: [string, string | undefined][]; onEdit: () => void }) {
  const miss = items.filter(([, v]) => !has(v)).map(([l]) => l)
  if (!miss.length) return null
  return (
    <p className="ipf-missing">
      <span>لم يُسجل بعد: {miss.join('، ')}.</span>
      <button type="button" className="link-btn no-print" onClick={onEdit}>
        <EditRegular aria-hidden /> إكمال من «تعديل الملف»
      </button>
    </p>
  )
}

/** وحدة محتوى ظاهرة دائمًا: رقم وعنوان فرعي ثم النص */
function Block({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="ipf-block">
      <h4>
        <span className="ipf-block-n" aria-hidden>
          {n}
        </span>
        {title}
      </h4>
      <div className="ipf-block-body">{children}</div>
    </section>
  )
}

/** رأس منطقة المحتوى: رقم القسم وعنوانه */
const PanelHead = ({ i }: { i: number }) => (
  <header className="ipf-panel-head">
    <span className="ipf-panel-n">{String(i + 1).padStart(2, '0')}</span>
    <h3>{tabs[i].title}</h3>
  </header>
)

const List = ({ text }: { text: string }) => (
  <ul className="ipf-list">
    {lines(text).map((l, i) => (
      <li key={i}>{stripMarker(l)}</li>
    ))}
  </ul>
)

/** أدوار الفئات من حقل «المسؤوليات»، كل سطر «الفئة: الدور» */
function roleOf(text: string, test: RegExp): string {
  const l = lines(text).map(stripMarker).find((x) => test.test(splitLead(x)[0] ?? ''))
  return l ? splitLead(l)[1] : ''
}

export function IniProfile({ ini, settings, purpose, onEdit }: { ini: InitiativeProfile; settings: Settings; purpose: string; onEdit: () => void }) {
  const [tab, setTab] = useState<TabKey>(readTab)
  const btns = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, tab)
    } catch {
      /* التبويب المحفوظ ميزة اختيارية */
    }
  }, [tab])
  const go = (k: TabKey) => setTab(k)
  const onKey = (e: KeyboardEvent, i: number) => {
    // في RTL: السهم الأيسر يتقدم والأيمن يرجع
    const d = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const j = (i + d + tabs.length) % tabs.length
    setTab(tabs[j].key)
    btns.current[j]?.focus()
  }

  const goals = lines(ini.executionGoals).map(goalParts)
  const resp = ini.responsibilities ?? ''
  const roles: [string, string][] = [
    ['المعلمات', roleOf(resp, /المعلمات/)],
    ['الطالبات', roleOf(resp, /الطالبات/)],
    ['قيادة المدرسة', roleOf(resp, /قيادة/)],
    ['مسؤولة المبادرة', roleOf(resp, /مسؤولة/)],
  ]
  const otherRoles = lines(resp)
    .map(stripMarker)
    .filter((l) => !/المعلمات|الطالبات|قيادة|مسؤولة/.test(splitLead(l)[0] ?? ''))

  return (
    <div className="ipf">
      <div className="ipf-tabs no-print" role="tablist" aria-label="أقسام ملف المبادرة">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              btns.current[i] = el
            }}
            type="button"
            role="tab"
            id={`ipf-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`ipf-panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className={tab === t.key ? 'active' : ''}
            onClick={() => go(t.key)}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="ipf-tab-n">{String(i + 1).padStart(2, '0')}</span>
            <span className="ipf-tab-t">{t.title}</span>
          </button>
        ))}
      </div>

      {/* 01 التعريف بالمبادرة */}
      <div className="ipf-panel" role="tabpanel" id="ipf-panel-about" aria-labelledby="ipf-tab-about" hidden={tab !== 'about'}>
        <PanelHead i={0} />
        <p className="ipf-lead">{purpose}</p>
        <dl className="ipf-facts">
          <div>
            <dt>مجال المبادرة</dt>
            <dd>
              <Value v={ini.domain} />
            </dd>
          </div>
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
            <dt>الجهة المنفذة</dt>
            <dd>
              {settings.schoolName}
              <span className="caption">
                {settings.department}، محافظة {settings.governorate}
              </span>
            </dd>
          </div>
          <div>
            <dt>مسؤولة المبادرة</dt>
            <dd>
              <Value v={ini.lead} />
            </dd>
          </div>
          <div>
            <dt>حالة المبادرة</dt>
            <dd>
              <StatusBadge options={initiativeStatuses} value={ini.status} />
              <span className="caption">آخر تعديل: {formatDateTime(ini.updatedAt)}</span>
            </dd>
          </div>
        </dl>
        <div className="ipf-pair">
          <div>
            <h4>المشكلة والمبررات باختصار</h4>
            <p>
              <Value v={firstClause(ini.problem || ini.rationale)} />
            </p>
            <button type="button" className="link-btn no-print" onClick={() => go('why')}>
              التفاصيل في «المبررات والمشكلة»
            </button>
          </div>
          <div>
            <h4>المسؤوليات</h4>
            <p>
              {roles
                .filter(([, r]) => r)
                .map(([g]) => g)
                .join('، ') || <Value v="" />}
            </p>
            <button type="button" className="link-btn no-print" onClick={() => go('roles')}>
              أدوار كل فئة في «الفئات المستهدفة والأدوار»
            </button>
          </div>
        </div>
      </div>

      {/* 02 الرؤية والرسالة */}
      <div className="ipf-panel" role="tabpanel" id="ipf-panel-vision" aria-labelledby="ipf-tab-vision" hidden={tab !== 'vision'}>
        <PanelHead i={1} />
        <div className="ipf-vm">
          <figure className="ipf-statement">
            <figcaption>الرؤية</figcaption>
            <blockquote>
              <Value v={ini.vision} />
            </blockquote>
          </figure>
          <figure className={`ipf-statement${has(ini.mission) ? '' : ' is-empty'}`}>
            <figcaption>الرسالة</figcaption>
            <blockquote>{has(ini.mission) ? ini.mission : <span className="empty-value">لم تُسجل الرسالة بعد.</span>}</blockquote>
          </figure>
        </div>
        <div className="ipf-values">
          <h4>القيم والمبادئ</h4>
          {has(ini.values) ? (
            <ul>
              {lines(ini.values!).map((v, i) => {
                const [t, d] = splitLead(stripMarker(v), /[:：]/, 30)
                return (
                  <li key={i}>
                    <strong>{t ?? d}</strong>
                    {t && <span>{d}</span>}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="empty-value">لم تُسجل القيم والمبادئ بعد.</p>
          )}
        </div>
        <Missing items={[['الرسالة', ini.mission], ['القيم والمبادئ', ini.values]]} onEdit={onEdit} />
      </div>

      {/* 03 الأهداف */}
      <div className="ipf-panel" role="tabpanel" id="ipf-panel-goals" aria-labelledby="ipf-tab-goals" hidden={tab !== 'goals'}>
        <PanelHead i={2} />
        <div className="ipf-goal">
          <span>الهدف العام</span>
          <p>
            <Value v={ini.generalGoal} />
          </p>
        </div>
        <h4 className="ipf-h4">الأهداف التنفيذية</h4>
        {goals.length ? (
          <ol className="ipf-goals">
            {goals.map(([title, desc], i) => (
              <li key={i}>
                <span className="ipf-goals-n" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  {title && <strong>{title}</strong>}
                  <p>{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-value">لم تُسجل الأهداف التنفيذية بعد.</p>
        )}
        <h4 className="ipf-h4">النتائج المنشودة</h4>
        {has(ini.expectedResults) ? <List text={ini.expectedResults!} /> : <p className="empty-value">لم تُسجل النتائج المنشودة بعد.</p>}
        <Missing items={[['النتائج المنشودة', ini.expectedResults]]} onEdit={onEdit} />
      </div>

      {/* 04 المبررات والمشكلة */}
      <div className="ipf-panel" role="tabpanel" id="ipf-panel-why" aria-labelledby="ipf-tab-why" hidden={tab !== 'why'}>
        <PanelHead i={3} />
        <div className="ipf-blocks">
          <Block n="01" title="التحديات الحالية">
            {lines(ini.challenges).length ? <List text={ini.challenges} /> : <p className="empty-value">لم تُسجل التحديات بعد.</p>}
          </Block>
          <Block n="02" title="الحاجة التعليمية">
            <p className="pre-line">
              <Value v={ini.problem} />
            </p>
          </Block>
          <Block n="03" title="الفجوة التي تعالجها المبادرة">
            {has(ini.gap) ? <p className="pre-line">{ini.gap}</p> : <p className="empty-value">لم تُسجل الفجوة بعد.</p>}
          </Block>
          <Block n="04" title="أهمية توظيف الذكاء الاصطناعي والتحول الرقمي">
            <p className="pre-line">
              <Value v={ini.rationale} />
            </p>
          </Block>
        </div>
        <Missing items={[['الفجوة', ini.gap]]} onEdit={onEdit} />
      </div>

      {/* 05 الفئات المستهدفة والأدوار */}
      <div className="ipf-panel" role="tabpanel" id="ipf-panel-roles" aria-labelledby="ipf-tab-roles" hidden={tab !== 'roles'}>
        <PanelHead i={4} />
        <div className="ipf-note">
          <span>الفئات المستهدفة</span>
          <p>
            <Value v={ini.targetGroups} />
          </p>
        </div>
        <h4 className="ipf-h4">أدوار كل فئة</h4>
        <dl className="ipf-roles">
          {roles.map(([g, r]) => (
            <div key={g}>
              <dt>{g}</dt>
              <dd>{r || <span className="empty-value">لم يُحدد دورها بعد.</span>}</dd>
            </div>
          ))}
          {otherRoles.map((l, i) => {
            const [g, r] = splitLead(l)
            return (
              <div key={`o${i}`}>
                <dt>{g ?? 'أخرى'}</dt>
                <dd>{r}</dd>
              </div>
            )
          })}
          <div>
            <dt>الجهات الداعمة</dt>
            <dd>
              <Value v={ini.supporters} empty="لا توجد جهات داعمة مسجلة" />
            </dd>
          </div>
        </dl>
      </div>

      {/* 06 النطاق والمخرجات المتوقعة */}
      <div className="ipf-panel" role="tabpanel" id="ipf-panel-scope" aria-labelledby="ipf-tab-scope" hidden={tab !== 'scope'}>
        <PanelHead i={5} />
        <div className="ipf-pair">
          <div>
            <h4>نطاق التطبيق</h4>
            {has(ini.scope) ? (
              <p className="pre-line">{ini.scope}</p>
            ) : (
              <p>
                {settings.schoolName}. <Value v={ini.targetGroups} /> <Value v={ini.duration} />
              </p>
            )}
          </div>
          <div>
            <h4>الممارسات المستهدفة</h4>
            {has(ini.targetPractices) ? <List text={ini.targetPractices!} /> : <p className="empty-value">لم تُسجل بعد.</p>}
          </div>
        </div>
        <div className="ipf-outcomes">
          <section className="ipf-expected" aria-label="المتوقع">
            <span className="ipf-tag">متوقع · لم يتحقق بعد</span>
            <h4>المخرجات المتوقعة</h4>
            {has(ini.expectedOutputs) ? <List text={ini.expectedOutputs!} /> : <p className="empty-value">لم تُسجل بعد.</p>}
            <h4>الأثر التعليمي المنشود</h4>
            {has(ini.intendedImpact) ? <p className="pre-line">{ini.intendedImpact}</p> : <p className="empty-value">لم يُسجل بعد.</p>}
          </section>
          <section className={`ipf-achieved${has(ini.actualResults) ? '' : ' is-empty'}`} aria-label="المتحقق">
            <span className="ipf-tag">متحقق فعلًا</span>
            <h4>النتائج المتحققة</h4>
            {has(ini.actualResults) ? <p className="pre-line">{ini.actualResults}</p> : <p className="empty-value">لم تُسجل نتائج متحققة بعد. تُسجل بعد القياس مع مصدرها.</p>}
          </section>
        </div>
        <Missing
          items={[
            ['الممارسات المستهدفة', ini.targetPractices],
            ['المخرجات المتوقعة', ini.expectedOutputs],
            ['الأثر التعليمي المنشود', ini.intendedImpact],
          ]}
          onEdit={onEdit}
        />
      </div>
    </div>
  )
}
