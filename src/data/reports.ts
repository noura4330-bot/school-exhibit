// بناء التقارير من البيانات المسجلة فقط. كل رقم في التقرير محسوب من السجلات الموجودة.
import type { AppData } from './types'
import {
  activityStatuses,
  consentOptions,
  evidenceTypes,
  governanceAssessments,
  indicatorStatuses,
  labelOf,
  pathfinderStatuses,
  policyStatuses,
  practiceCategories,
  reviewStatuses,
  sensitivityLevels,
  showcaseStatuses,
  siteDomains,
  taskStatuses,
} from './options'
import {
  computeAlerts,
  computeKpis,
  docStateLabels,
  evidenceCompleteness,
  evidenceFor,
  minimumCheck,
  practiceDoc,
  projectDoc,
  workshopDoc,
} from './selectors'
import { formatDate, inRange, toNumber } from '../lib/util'

export type ReportType =
  | 'achievement'
  | 'training'
  | 'teaching'
  | 'projects'
  | 'evidence'
  | 'impact'
  | 'gaps'
  | 'readiness'

export const reportTypes: { value: ReportType; label: string }[] = [
  { value: 'achievement', label: 'تقرير إنجاز المبادرة' },
  { value: 'training', label: 'تقرير التدريب والتطوير المهني' },
  { value: 'teaching', label: 'تقرير الأنشطة التعليمية' },
  { value: 'projects', label: 'تقرير مشروعات الطالبات' },
  { value: 'evidence', label: 'تقرير الشواهد' },
  { value: 'impact', label: 'تقرير قياس الأثر' },
  { value: 'gaps', label: 'تقرير النواقص' },
  { value: 'readiness', label: 'تقرير الاستعداد لمتطلبات Microsoft Elevate' },
]

export interface ReportTable {
  title: string
  headers: string[]
  rows: string[][]
}

export interface Report {
  title: string
  summary: string[]
  tables: ReportTable[]
  highlights: string[]
  gaps: string[]
  actions: string[]
  notes: string[]
}

const v = (s: string | undefined | null) => (s && s.trim() ? s.trim() : '—')

export function buildReport(type: ReportType, data: AppData, from: string, to: string): Report {
  const title = reportTypes.find((r) => r.value === type)!.label
  const within = (d: string) => inRange(d, from, to)
  const docSections = (x: AppData['policies'][number]) => {
    const doc = data.govDocs.find((d) => d.id === x.docRef?.docId)
    if (!doc) return 'غير مرتبط'
    const nums = x.docRef!.sectionIds.map((s) => doc.sections.findIndex((c) => c.id === s) + 1).filter((n) => n > 0)
    return nums.length ? nums.sort((a, b) => a - b).join('، ') : x.docRef!.tracksStages ? 'مراحل الاعتماد' : '—'
  }
  const openTasks = (areas: string[]) =>
    data.tasks
      .filter((t) => t.status !== 'done' && (!areas.length || areas.includes(t.area)))
      .map((t) => `${t.title} (${labelOf(taskStatuses, t.status)}${t.due ? `، الموعد ${formatDate(t.due)}` : ''})`)
  const empty: Report = { title, summary: [], tables: [], highlights: [], gaps: [], actions: [], notes: [] }

  switch (type) {
    case 'achievement': {
      const k = computeKpis(data)
      const acts = data.activities.filter((a) => within(a.date))
      const ini = data.initiative
      return {
        ...empty,
        summary: [
          `المبادرة: ${ini.name}.`,
          `الأنشطة المسجلة في الفترة: ${acts.length}، منها ${acts.filter((a) => a.status === 'implemented').length} منفذة.`,
          `ورش التدريب المنفذة (إجمالًا): ${k.workshopsDone}. الشواهد الموثقة بملف أو رابط: ${k.evidenceDocumented}.`,
          `الممارسات والمشروعات الموثقة توثيقًا مكتملًا: ${k.documentedProjects}.`,
          k.indicatorsTotal
            ? `مؤشرات الجاهزية المكتملة داخليًا: ${k.indicatorsComplete} من ${k.indicatorsTotal}.`
            : 'لم تُسجل مؤشرات جاهزية بعد.',
        ],
        tables: [
          {
            title: 'الأنشطة',
            headers: ['النشاط', 'التاريخ', 'المجال', 'الحالة', 'المسؤول', 'عدد الشواهد'],
            rows: acts.map((a) => [
              a.title,
              formatDate(a.date),
              a.domain ? labelOf(siteDomains, a.domain) : '—',
              labelOf(activityStatuses, a.status),
              v(a.responsible),
              String(evidenceFor(data, { kind: 'activity', id: a.id }).length),
            ]),
          },
          {
            title: 'بيانات الخطة',
            headers: ['البند', 'القيمة'],
            rows: [
              ['الهدف العام', v(ini.generalGoal)],
              ['خط الأساس', v(ini.baseline)],
              ['المستهدف', v(ini.target)],
              ['خطة قياس الأثر', v(ini.measurementPlan ?? '')],
              ['النتائج الفعلية', v(ini.actualResults)],
              ['التحديات', v(ini.challenges)],
            ],
          },
        ],
        highlights: acts
          .filter((a) => a.status === 'implemented' && evidenceFor(data, { kind: 'activity', id: a.id }).length > 0)
          .map((a) => `${a.title} (${formatDate(a.date)}) — موثق بشاهد`),
        gaps: acts
          .filter((a) => a.status === 'implemented' && evidenceFor(data, { kind: 'activity', id: a.id }).length === 0)
          .map((a) => `النشاط «${a.title}» منفذ دون شاهد مرتبط.`),
        actions: [...(ini.improvements.trim() ? [ini.improvements.trim()] : []), ...openTasks(['initiative'])],
      }
    }
    case 'training': {
      const ws = data.workshops.filter((w) => within(w.date))
      const docs = ws.map((w) => ({ w, d: workshopDoc(data, w) }))
      const participants = ws.map((w) => toNumber(w.participants)).filter((n): n is number => n !== null)
      return {
        ...empty,
        summary: [
          `عدد الورش المسجلة في الفترة: ${ws.length}.`,
          participants.length
            ? `مجموع المشاركات المسجل في ${participants.length} ورشة: ${participants.reduce((s, n) => s + n, 0)} (قد تتكرر المشاركة الواحدة في أكثر من ورشة).`
            : 'لم تُسجل أعداد المشاركات.',
          `الورش الموثقة توثيقًا مكتملًا: ${docs.filter((x) => x.d.state === 'complete').length}.`,
        ],
        tables: [
          {
            title: 'الورش',
            headers: ['الورشة', 'التاريخ', 'المنفذة', 'المشاركات', 'حالة التوثيق', 'الشواهد'],
            rows: docs.map(({ w, d }) => [w.title, formatDate(w.date), v(w.presenter), v(w.participants), docStateLabels[d.state], String(d.evidence)]),
          },
        ],
        highlights: docs.filter((x) => x.w.results.trim()).map((x) => `${x.w.title}: ${x.w.results.trim()}`),
        gaps: docs.filter((x) => x.d.missing.length).map((x) => `«${x.w.title}» ينقصها: ${x.d.missing.join('، ')}${x.d.evidence ? '' : '، وشاهد مرتبط'}.`),
        actions: openTasks(['professional']),
      }
    }
    case 'teaching': {
      const ps = data.practices.filter((p) => !p.isTemplate && within(p.createdAt.slice(0, 10)))
      const docs = ps.map((p) => ({ p, d: practiceDoc(data, p) }))
      return {
        ...empty,
        summary: [
          `الممارسات التعليمية المسجلة في الفترة: ${ps.length} (لا تشمل النماذج غير المنفذة).`,
          `الموثقة توثيقًا مكتملًا: ${docs.filter((x) => x.d.state === 'complete').length}.`,
        ],
        tables: [
          {
            title: 'الممارسات',
            headers: ['الممارسة', 'الفئة', 'المادة', 'المرحلة', 'حالة التوثيق', 'الشواهد'],
            rows: docs.map(({ p, d }) => [p.title, labelOf(practiceCategories, p.category), v(p.subject), v(p.stage), docStateLabels[d.state], String(d.evidence)]),
          },
        ],
        highlights: docs.filter((x) => x.p.results.trim()).map((x) => `${x.p.title}: ${x.p.results.trim()}`),
        gaps: docs.filter((x) => x.d.missing.length || !x.d.evidence).map((x) => `«${x.p.title}» ينقصها: ${[...x.d.missing, ...(x.d.evidence ? [] : ['شاهد مرتبط'])].join('، ')}.`),
        actions: [...docs.filter((x) => x.p.improvement.trim()).map((x) => `${x.p.title}: ${x.p.improvement.trim()}`), ...openTasks(['teaching'])],
        notes: ['النماذج المعدة مسبقًا (مثل نموذج درس STEM) لا تُحتسب حتى تُنفذ وتوثق.'],
      }
    }
    case 'projects': {
      const ps = data.projects.filter((p) => within(p.date))
      const docs = ps.map((p) => ({ p, d: projectDoc(data, p) }))
      return {
        ...empty,
        summary: [`مشروعات الطالبات المسجلة في الفترة: ${ps.length}.`, `الموثقة توثيقًا مكتملًا: ${docs.filter((x) => x.d.state === 'complete').length}.`],
        tables: [
          {
            title: 'المشروعات',
            headers: ['المشروع', 'المجال', 'المادة', 'التاريخ', 'الموافقات', 'حالة التوثيق'],
            rows: docs.map(({ p, d }) => [p.title, v(p.field), v(p.subject), formatDate(p.date), labelOf(consentOptions, p.consent), docStateLabels[d.state]]),
          },
        ],
        highlights: docs.filter((x) => x.p.finalProduct.trim()).map((x) => `${x.p.title}: ${x.p.finalProduct.trim()}`),
        gaps: [
          ...docs.filter((x) => x.d.missing.length).map((x) => `«${x.p.title}» ينقصه: ${x.d.missing.join('، ')}.`),
          ...docs.filter((x) => x.p.consent !== 'full').map((x) => `«${x.p.title}»: موافقات النشر غير مكتملة، فلا تُعرض صوره.`),
        ],
        actions: openTasks(['projects']),
        notes: ['لا يتضمن التقرير أسماء الطالبات أو صورهن.'],
      }
    }
    case 'evidence': {
      const ev = data.evidence.filter((e) => within(e.executedOn || e.createdAt.slice(0, 10)))
      const comp = ev.map((e) => ({ e, c: evidenceCompleteness(e) }))
      return {
        ...empty,
        summary: [
          `عدد الشواهد في الفترة: ${ev.length}.`,
          `تمت مراجعتها: ${ev.filter((e) => e.reviewStatus === 'reviewed').length}. تحتاج إلى استكمال: ${ev.filter((e) => e.reviewStatus === 'needs_completion' || e.needsCompletion === 'yes').length}.`,
          `غير مرتبطة بأي مؤشر أو نشاط: ${ev.filter((e) => e.links.length === 0).length}.`,
        ],
        tables: [
          {
            title: 'الشواهد',
            headers: ['الشاهد', 'النوع', 'تاريخ التنفيذ', 'المجال', 'المراجعة', 'الحساسية', 'اكتمال البيانات', 'عدد الروابط'],
            rows: comp.map(({ e, c }) => [
              e.title,
              labelOf(evidenceTypes, e.type),
              formatDate(e.executedOn),
              e.domain ? labelOf(siteDomains, e.domain) : '—',
              labelOf(reviewStatuses, e.reviewStatus),
              labelOf(sensitivityLevels, e.sensitivity),
              `${c.pct}%`,
              String(e.links.length),
            ]),
          },
        ],
        highlights: ev.filter((e) => e.reviewStatus === 'reviewed').map((e) => `${e.title}${e.proves ? `: ${e.proves}` : ''}`),
        gaps: comp.filter((x) => x.c.missing.length).map((x) => `«${x.e.title}» ينقصه: ${x.c.missing.join('، ')}.`),
        actions: openTasks([]),
        notes: ['لا تُدرج روابط الشواهد في هذا التقرير حفاظًا على الخصوصية؛ راجعيها من صفحة الشواهد.'],
      }
    }
    case 'impact': {
      const ms = data.impact.filter((m) => within(m.measuredOn || m.createdAt.slice(0, 10)))
      return {
        ...empty,
        summary: [
          `مؤشرات الأثر المسجلة: ${ms.length}.`,
          `مؤشرات لها نتيجة فعلية مسجلة: ${ms.filter((m) => m.actual.trim()).length}.`,
        ],
        tables: [
          {
            title: 'مؤشرات الأثر',
            headers: ['المؤشر', 'خط الأساس', 'المستهدف', 'النتيجة الفعلية', 'تاريخ القياس', 'طريقة القياس', 'المصدر'],
            rows: ms.map((m) => [m.title, v(m.baseline), v(m.target), v(m.actual), formatDate(m.measuredOn), v(m.method), v(m.dataSource)]),
          },
        ],
        highlights: ms
          .filter((m) => {
            const a = toNumber(m.actual)
            const t = toNumber(m.target)
            return a !== null && t !== null && a >= t
          })
          .map((m) => `${m.title}: بلغت النتيجة الفعلية (${m.actual}) المستهدف (${m.target}).`),
        gaps: ms.filter((m) => !m.actual.trim() || !m.baseline.trim()).map((m) => `«${m.title}»: لا توجد بيانات كافية لاحتساب المؤشر (${!m.baseline.trim() ? 'خط الأساس' : ''}${!m.baseline.trim() && !m.actual.trim() ? ' و' : ''}${!m.actual.trim() ? 'النتيجة الفعلية' : ''} غير مسجل).`),
        actions: openTasks(['impact']),
        notes: ms.some((m) => !m.causalDesign) ? ['الفروق المعروضة فروق مرصودة، ولا تُنسب سببيًا إلى المبادرة ما لم يسمح أسلوب القياس بذلك.'] : [],
      }
    }
    case 'gaps': {
      const alerts = computeAlerts(data)
      return {
        ...empty,
        summary: [`عدد التنبيهات الحالية: ${alerts.length}، منها ${alerts.filter((a) => a.tone === 'danger').length} حرجة.`],
        tables: [
          {
            title: 'التنبيهات',
            headers: ['الدرجة', 'الوصف'],
            rows: alerts.map((a) => [a.tone === 'danger' ? 'حرج' : 'ناقص', a.text]),
          },
          {
            title: 'المهام المفتوحة',
            headers: ['المهمة', 'المجال', 'الحالة', 'الموعد'],
            rows: data.tasks.filter((t) => t.status !== 'done').map((t) => [t.title, labelOf(siteDomains, t.area), labelOf(taskStatuses, t.status), formatDate(t.due)]),
          },
        ],
        gaps: alerts.map((a) => a.text),
        actions: openTasks([]),
      }
    }
    case 'readiness': {
      const p = data.program
      const check = minimumCheck(data)
      const total = data.indicators.length
      const withEv = data.indicators.filter((i) => evidenceFor(data, { kind: 'indicator', id: i.id }).length > 0).length
      const complete = data.indicators.filter((i) => i.status === 'internally_complete').length
      const areaName = (id: string) => data.areas.find((a) => a.id === id)?.name ?? '—'
      return {
        ...empty,
        summary: [
          `حالة الانضمام إلى Pathfinder: ${labelOf(pathfinderStatuses, p.pathfinderStatus)}. حالة طلب Showcase: ${labelOf(showcaseStatuses, p.showcaseStatus)}${p.submissionDate ? ` (تاريخ التقديم ${formatDate(p.submissionDate)})` : ''}.`,
          total
            ? `المؤشرات المسجلة: ${total}. المرتبطة بشاهد: ${withEv} (${Math.round((withEv / total) * 100)}%). المكتملة داخليًا: ${complete} (${Math.round((complete / total) * 100)}%).`
            : 'لم تُدخل مؤشرات المقياس الرسمي بعد، فلا يمكن احتساب نسب الجاهزية.',
          `الحد الأدنى وفق دليل التقديم مقارنة بالتقييم الذاتي: Policy and Governance بمستوى ${check.pgLevel ?? 'غير محدد'} (المطلوب 2)، ومجالات أخرى بمستوى 1 فأعلى: ${check.othersMet} (المطلوب 2).`,
          p.recognitionStatus === 'recorded'
            ? `حالة الاعتراف الرسمية: مسجلة بدليل بتاريخ ${formatDate(p.recognitionDate)}.`
            : 'حالة الاعتراف الرسمية: لا يوجد اعتراف رسمي مسجل.',
        ],
        tables: [
          {
            title: 'المجالات',
            headers: ['المجال', 'مستهدف', 'المستوى (تقييم ذاتي)', 'مراجعة داخلية', 'عدد المؤشرات'],
            rows: data.areas.map((a) => [
              a.name,
              a.targeted ? 'نعم' : 'لا',
              v(a.selfLevel),
              a.levelReviewed ? 'تمت' : 'لم تتم',
              String(data.indicators.filter((i) => i.areaId === a.id).length),
            ]),
          },
          {
            title: 'المؤشرات',
            headers: ['المجال', 'الرمز', 'المؤشر', 'الحالة', 'الشواهد', 'مراجعة المصدر'],
            rows: data.indicators.map((i) => [
              areaName(i.areaId),
              v(i.code),
              i.text,
              labelOf(indicatorStatuses, i.status),
              String(evidenceFor(data, { kind: 'indicator', id: i.id }).length),
              formatDate(i.sourceReviewedAt),
            ]),
          },
          {
            title: 'عناصر الحوكمة',
            headers: ['العنصر', 'الوثيقة', 'القسم في الوثيقة المرجعية', 'الحالة', 'التقييم الذاتي الأولي', 'الشواهد'],
            rows: data.policies.map((x) => [
              x.element,
              v(x.docName),
              docSections(x),
              labelOf(policyStatuses, x.status),
              labelOf(governanceAssessments, x.assessment ?? ''),
              String(evidenceFor(data, { kind: 'policy', id: x.id }).length),
            ]),
          },
        ],
        highlights: data.indicators.filter((i) => i.status === 'internally_complete').map((i) => `${i.code ? `${i.code}: ` : ''}${i.text}`),
        gaps: [
          ...(total ? [] : ['لم تُدخل مؤشرات المقياس الرسمي.']),
          ...data.indicators
            .filter((i) => evidenceFor(data, { kind: 'indicator', id: i.id }).length === 0)
            .map((i) => `المؤشر «${i.code || i.text}» بلا شاهد.`),
          ...data.indicators.filter((i) => i.gap.trim()).map((i) => `${i.code || i.text}: ${i.gap.trim()}`),
        ],
        actions: openTasks(['readiness', 'governance']),
        notes: [
          'هذا التقرير تقييم داخلي للاستعداد. لا يعني أن المدرسة مؤهلة للتقديم أو أن Microsoft وافقت عليها، ولا يضمن الحصول على الاعتراف.',
          'المرجع: دليل التقديم للاعتراف المتقدم 2026–2027 وAI Transformation Rubric. تحققي من أحدث نسخة رسمية.',
        ],
      }
    }
  }
}
