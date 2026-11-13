import { useState } from 'react'
import { EditRegular } from '@fluentui/react-icons'
import { useStore } from '../data/store'
import type { Activity, InitiativeProfile } from '../data/types'
import { activityStatuses, initiativeStatuses } from '../data/options'
import { StatusBadge, Value } from '../components/ui'
import { parseStages, SecHead, stageProgress, type Stage } from '../components/InitiativeSections'
import { Drawer, useFeedback } from '../components/feedback'
import { FormFields, validateFields, type Errors, type FieldDef } from '../components/form'
import { AchievedResults } from '../components/AchievedResults'
import { Block, IniProfile, openProfileTab, type TabKey } from '../components/IniProfile'
import { ProgramsBoard } from '../components/ProgramEvidence'
import { ProgramImpactOverview } from '../components/ProgramMeasures'
import { evidenceFor } from '../data/selectors'

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
      { key: 'targetPractices', label: 'الممارسات المستهدفة', type: 'textarea', hint: 'ممارسة في كل سطر، بترتيب البرامج (السطر 1 للبرنامج 01 وهكذا).' },
      { key: 'expectedOutputs', label: 'المخرجات المتوقعة', type: 'textarea', hint: 'مخرج في كل سطر بترتيب البرامج، بصيغة وصفية أو مستقبلية. لا تُعرض بوصفها إنجازات.' },
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
      { key: 'actualResults', label: 'النتائج الفعلية', type: 'textarea', hint: 'اختياري: نتائج مقيسة فعلًا خارج الشواهد والمؤشرات، مع مصدرها. النتائج المتحققة لكل برنامج تُحسب تلقائيًا.' },
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
          <button className="btn primary edit-only" onClick={save}>
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

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

/** تبويب «خطة التنفيذ»: كل مرحلة في بطاقة، مع حالتها وأنشطتها، ثم الموارد */
function PlanTab({ ini, stages, intro }: { ini: InitiativeProfile; stages: Stage[]; intro: string | null }) {
  const { data } = useStore()
  const documented = (a: Activity) => evidenceFor(data, { kind: 'activity', id: a.id }).length > 0
  return (
    <>
      {intro && <p className="ipf-lead">{intro}</p>}
      {stages.length ? (
        <div className="ipf-blocks">
          {stages.map((st, i) => {
            const pg = stageProgress(st.activities, documented)
            return (
              <Block key={i} n={String(i + 1).padStart(2, '0')} title={st.title}>
                {st.desc && <p>{st.desc}</p>}
                {st.activities.length > 0 && (
                  <ul className="ipf-acts">
                    {st.activities.map((a) => (
                      <li key={a.id}>
                        <span>{a.title}</span>
                        <StatusBadge options={activityStatuses} value={a.status} />
                      </li>
                    ))}
                  </ul>
                )}
                {pg.total > 0 && (
                  <p className="caption">
                    أنشطة منفذة وموثقة: {pg.done} من {pg.total}
                  </p>
                )}
              </Block>
            )
          })}
        </div>
      ) : (
        <p className="empty-value">لم يُسجل الجدول الزمني بعد.</p>
      )}
      <div className="ipf-pair" style={{ marginTop: 16 }}>
        <div>
          <h4>الموارد</h4>
          <p className="pre-line">
            <Value v={ini.resources} />
          </p>
        </div>
        <div>
          <h4>مدة التنفيذ</h4>
          <p>
            <Value v={ini.duration} />
          </p>
        </div>
      </div>
    </>
  )
}

export default function InitiativePage() {
  const { data } = useStore()
  const ini = data.initiative
  const s = data.settings
  const [editing, setEditing] = useState(false)
  const { intro, stages } = parseStages(ini, data.activities)
  const openTab = (k: TabKey) => {
    openProfileTab(k)
    jump('ini-about')
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
              <button className="btn primary" onClick={() => openTab('about')}>
                تعريف المبادرة
              </button>
              <button className="btn" onClick={() => openTab('plan')}>
                خطة التنفيذ
              </button>
              <button className="btn" onClick={() => openTab('impact')}>
                مؤشرات الأثر
              </button>
              <span className="ini-jump-more">
                <button className="link-btn" onClick={() => jump('ini-evidence')}>
                  الشواهد
                </button>
                <button className="link-btn edit-only" onClick={() => setEditing(true)}>
                  <EditRegular aria-hidden /> تعديل الملف
                </button>
              </span>
            </nav>
          </div>
        </div>
      </section>

      {/* ===== 01 ملف المبادرة: ثمانية تبويبات ===== */}
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
            <button className="btn small edit-only" onClick={() => setEditing(true)}>
              <EditRegular /> تعديل الملف
            </button>
          }
        />
        <IniProfile
          ini={ini}
          settings={s}
          purpose={PURPOSE}
          onEdit={() => setEditing(true)}
          plan={<PlanTab ini={ini} stages={stages} intro={intro} />}
          impact={<ProgramImpactOverview />}
          results={<AchievedResults />}
        />
      </section>

      {/* ===== 02 البرامج وشواهدها ===== */}
      <section className="ini-sec" id="ini-evidence" aria-labelledby="ini-evidence-title">
        <SecHead n="02" id="ini-evidence" title="برامج المبادرة وشواهدها" sub="شواهد كل برنامج بصورها ووصفها، متتابعة حسب البرامج." />
        <ProgramsBoard expanded />
      </section>

      {editing && <ProfileEditor onClose={() => setEditing(false)} />}
    </>
  )
}
