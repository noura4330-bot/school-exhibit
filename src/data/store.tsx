// مخزن البيانات: حالة واحدة للتطبيق تُحفظ في localStorage على هذا الجهاز.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  AppData,
  Attachment,
  BaseRecord,
  CollectionKey,
  InitiativeProfile,
  OfficialLink,
  ProgramStatus,
  Ref,
  Settings,
} from './types'
import { applyProfileV9 } from './profileV9'
import { applyProfileV16 } from './profileV16'
import { applyGovDocs, applyPolicyFile } from './govDocs'
import { applyImpactV12 } from './impactV12'
import { applyImpactV13 } from './impactV13'
import { applyPlanV14 } from './planV14'
import { createSeed, DATA_VERSION, FLUENT_NOTE, initiativeProfileDefaults, OLD_FLUENT_NOTE, previousInitiativeDefaults } from './seed'
import { applyPlanning } from './planning'
import { evaluationDefaults, followUpTaskRecords, plannedActivityRecords, seedTaskDetails } from './planContent'
import { newId, nowIso } from '../lib/util'
import { deleteFile } from '../lib/fileStore'
import { ensureBundledFiles } from '../lib/bundledFiles'

const STORAGE_KEY = 'school-exhibit-data-v1'

type Collections = Pick<AppData, CollectionKey>
type ItemOf<K extends CollectionKey> = Collections[K][number]

/** يدمج البيانات المحفوظة مع البنية الافتراضية حتى لا تنكسر الواجهة عند إضافة حقول جديدة */
export function normalizeData(raw: unknown): AppData {
  const seed = createSeed()
  if (!raw || typeof raw !== 'object') return seed
  const r = raw as Partial<AppData>
  // الإصدار 3: هوية المعرض الكحلية تحل محل البنفسجية، ومحل الأزرق الافتراضي القديم لمن لم يغيّره
  const oldBrand = r.settings?.brand as string | undefined
  const migratedBrand =
    !oldBrand || oldBrand === 'violet' || ((r.version ?? 1) < 2 && oldBrand === 'fluent') ? { brand: 'navy' as const } : {}
  // الإصدار 4: تعبئة تعريف المبادرة في الخانات الفارغة فقط، مع استبدال الاسم والمسؤولة إن بقيا على القيمة الافتراضية القديمة
  const ini: Partial<InitiativeProfile> = { ...(r.initiative ?? {}) }
  if ((r.version ?? 1) < 4) {
    for (const [k, v] of Object.entries(initiativeProfileDefaults) as [keyof typeof initiativeProfileDefaults, string][]) {
      const cur = ini[k]
      const old = previousInitiativeDefaults[k as keyof typeof previousInitiativeDefaults]
      if (typeof cur !== 'string' || !cur.trim() || cur === old) ini[k] = v
    }
  }
  if ((r.version ?? 1) < 9) applyProfileV9(ini)
  // الإصدار 16: الرسالة والقيم والفجوة والممارسات والمخرجات والأثر المنشود، في الخانات الفارغة فقط
  if ((r.version ?? 1) < 16) applyProfileV16(ini)
  // الإصدار 5: التقويم والتحسين ووصف الرحلة في الخانات الفارغة، وأنشطة مخططة ومهام متابعة لا تُكرر إن وُجدت بالعنوان نفسه
  const v5 = (r.version ?? 1) < 5
  if (v5) {
    for (const [k, v] of Object.entries(evaluationDefaults) as [keyof typeof evaluationDefaults, string][]) {
      if (typeof ini[k] !== 'string' || !ini[k]!.trim()) ini[k] = v
    }
  }
  const base = () => ({ id: newId(), createdAt: nowIso(), updatedAt: nowIso() })
  const withTitles = <T extends { title: string }>(existing: T[], extra: T[]) => {
    const have = new Set(existing.map((x) => x.title.trim()))
    return [...existing, ...extra.filter((x) => !have.has(x.title.trim()))]
  }
  const settingsIn = { ...(r.settings ?? {}) }
  if ((r.version ?? 1) < 4 && (!settingsIn.leadName || settingsIn.leadName === previousInitiativeDefaults.lead))
    settingsIn.leadName = initiativeProfileDefaults.lead
  const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback)
  const out: AppData = {
    version: DATA_VERSION,
    lastUpdated: typeof r.lastUpdated === 'string' ? r.lastUpdated : seed.lastUpdated,
    settings: {
      ...seed.settings,
      ...settingsIn,
      ...migratedBrand,
      // الإصدار 7: ملاحظة مرجع التصميم تتبع الهوية الزمردية إن بقيت كما هي
      links: arr<OfficialLink>(r.settings?.links, seed.settings.links).map((l) => (l.note === OLD_FLUENT_NOTE ? { ...l, note: FLUENT_NOTE } : l)),
    },
    initiative: { ...seed.initiative, ...ini },
    program: { ...seed.program, ...(r.program ?? {}) },
    activities: v5 && Array.isArray(r.activities) ? withTitles(r.activities, plannedActivityRecords(base)) : arr(r.activities, seed.activities),
    policies: arr(r.policies, seed.policies).map((p) => ({ ...p, assessment: p.assessment ?? '', assessmentNote: p.assessmentNote ?? '' })),
    workshops: arr(r.workshops, seed.workshops),
    practices: arr(r.practices, seed.practices),
    projects: arr(r.projects, seed.projects),
    evidence: arr(r.evidence, seed.evidence).map((e) => ({ ...e, links: Array.isArray(e.links) ? e.links : [], files: Array.isArray(e.files) ? e.files : [] })),
    areas: arr(r.areas, seed.areas),
    indicators: arr(r.indicators, seed.indicators),
    correspondence: arr(r.correspondence, seed.correspondence),
    impact: arr(r.impact, seed.impact),
    tasks:
      v5 && Array.isArray(r.tasks)
        ? withTitles(
            r.tasks.map((t) =>
              seedTaskDetails[t.title] && !t.owner?.trim()
                ? { ...t, owner: seedTaskDetails[t.title].owner, notes: t.notes?.trim() ? t.notes : seedTaskDetails[t.title].notes }
                : t,
            ),
            followUpTaskRecords(base),
          )
        : arr(r.tasks, seed.tasks),
    // الإصدار 10: وثائق الحوكمة الموحدة (تُنشأ أدناه إن لم توجد)
    govDocs: Array.isArray(r.govDocs) ? r.govDocs : [],
  }
  // الإصدار 6: بيانات مرحلة التخطيط (المبررات، ومسودة السياسة، والتقييم الأولي للحوكمة، ومؤشرات الأثر) في الخانات الفارغة فقط
  const governed = applyPolicyFile(applyGovDocs((r.version ?? 1) < 6 ? applyPlanning(out) : out))
  // الإصدار 12: مؤشرات الأثر الستة من مسؤولة المبادرة، مرة واحدة فقط كي لا يعود ما تحذفه
  const withImpact = (r.version ?? 1) < 12 ? applyImpactV12(governed) : governed
  // الإصدار 13: خمسة مؤشرات أثر أساسية فقط، مرة واحدة
  const withCore = (r.version ?? 1) < 13 ? applyImpactV13(withImpact) : withImpact
  // الإصدار 14: مواعيد خطة التنفيذ ومسؤوليتها، مرة واحدة
  const planned = (r.version ?? 1) < 14 ? applyPlanV14(withCore) : withCore
  // الإصدار 8: توحيد كتابة اسم مسؤولة المبادرة «نوره الزبيدي» في كل البيانات المحفوظة
  const named = (r.version ?? 1) < 8 ? (JSON.parse(JSON.stringify(planned).replaceAll('نورة الزبيدي', 'نوره الزبيدي')) as AppData) : planned
  // الإصدار 15: اسم المدرسة الصحيح «ثانوية أحد بني زيد» دون ضمة، في كل البيانات المحفوظة
  return (r.version ?? 1) < 15 ? (JSON.parse(JSON.stringify(named).replaceAll('أُحد بني زيد', 'أحد بني زيد')) as AppData) : named
}

function load(): { data: AppData; loadError: string | null; migrated?: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { data: createSeed(), loadError: null }
    const parsed = JSON.parse(raw)
    return { data: normalizeData(parsed), loadError: null, migrated: (parsed?.version ?? 1) < DATA_VERSION }
  } catch {
    return {
      data: createSeed(),
      loadError: 'تعذرت قراءة البيانات المحفوظة على هذا الجهاز، فعُرضت بيانات البداية. لم يُحذف شيء؛ صدّري نسخة احتياطية قبل أي تعديل.',
    }
  }
}

/** كل المرفقات داخل سجل، لحذف ملفاتها عند حذفه */
function attachmentsOf(record: unknown): Attachment[] {
  if (!record || typeof record !== 'object') return []
  return Object.values(record as Record<string, unknown>).flatMap((v) =>
    Array.isArray(v) && v.every((x) => x && typeof x === 'object' && 'size' in x && 'name' in x) ? (v as Attachment[]) : [],
  )
}

const refKindFor: Partial<Record<CollectionKey, Ref['kind']>> = {
  activities: 'activity',
  policies: 'policy',
  workshops: 'workshop',
  practices: 'practice',
  projects: 'project',
  indicators: 'indicator',
  impact: 'impact',
  tasks: 'task',
  govDocs: 'govdoc',
}

interface StoreValue {
  data: AppData
  saveError: string | null
  loadError: string | null
  upsert: <K extends CollectionKey>(key: K, item: ItemOf<K>) => void
  remove: (key: CollectionKey, id: string) => Promise<void>
  setSettings: (patch: Partial<Settings>) => void
  setInitiative: (patch: Partial<InitiativeProfile>) => void
  setProgram: (patch: Partial<ProgramStatus>) => void
  setEvidenceLinks: (ref: Ref, evidenceIds: string[]) => void
  replaceAll: (data: AppData) => void
  resetAll: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useRef(load())
  const [data, setData] = useState<AppData>(initial.current.data)
  const [saveError, setSaveError] = useState<string | null>(null)
  const first = useRef(true)
  const dataRef = useRef(data)
  dataRef.current = data

  // ملف السياسة وتقريرها المرافق يُحفظان في مخزن الملفات عند أول فتح
  useEffect(() => {
    void ensureBundledFiles(data).catch(() => undefined)
  }, [data.govDocs]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (first.current) {
      first.current = false
      // البيانات المحفوظة بإصدار أقدم تُحفظ فور ترقيتها كي لا تتكرر الترقية عند كل فتح
      if (!initial.current.migrated) return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      setSaveError(null)
    } catch {
      setSaveError('تعذر حفظ التعديلات الأخيرة على هذا الجهاز (قد تكون مساحة التخزين ممتلئة). صدّري نسخة احتياطية فورًا.')
    }
  }, [data])

  const touch = (d: AppData): AppData => ({ ...d, lastUpdated: nowIso() })

  const upsert = useCallback(<K extends CollectionKey>(key: K, item: ItemOf<K>) => {
    setData((d) => {
      const list = d[key] as unknown as BaseRecord[]
      const rec = { ...(item as BaseRecord), updatedAt: nowIso() }
      const exists = list.some((x) => x.id === rec.id)
      const next = exists ? list.map((x) => (x.id === rec.id ? rec : x)) : [...list, rec]
      return touch({ ...d, [key]: next })
    })
  }, [])

  const remove = useCallback(async (key: CollectionKey, id: string) => {
    const removed = (dataRef.current[key] as unknown as BaseRecord[]).find((x) => x.id === id)
    setData((d) => {
      const list = d[key] as unknown as BaseRecord[]
      const next: AppData = { ...d, [key]: list.filter((x) => x.id !== id) }
      const kind = refKindFor[key]
      if (kind) {
        next.evidence = next.evidence.map((e) =>
          e.links.some((l) => l.kind === kind && l.id === id)
            ? { ...e, links: e.links.filter((l) => !(l.kind === kind && l.id === id)) }
            : e,
        )
      }
      if (key === 'areas') next.indicators = next.indicators.map((i) => (i.areaId === id ? { ...i, areaId: '' } : i))
      return touch(next)
    })
    // حذف الملفات المرتبطة بالسجل من مخزن الملفات المحلي
    await Promise.all(attachmentsOf(removed).map((a) => deleteFile(a.id).catch(() => undefined)))
  }, [])

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => touch({ ...d, settings: { ...d.settings, ...patch } }))
  }, [])

  const setInitiative = useCallback((patch: Partial<InitiativeProfile>) => {
    setData((d) => touch({ ...d, initiative: { ...d.initiative, ...patch, updatedAt: nowIso() } }))
  }, [])

  const setProgram = useCallback((patch: Partial<ProgramStatus>) => {
    setData((d) => touch({ ...d, program: { ...d.program, ...patch } }))
  }, [])

  const setEvidenceLinks = useCallback((ref: Ref, evidenceIds: string[]) => {
    setData((d) => {
      const wanted = new Set(evidenceIds)
      let changed = false
      const evidence = d.evidence.map((e) => {
        const has = e.links.some((l) => l.kind === ref.kind && l.id === ref.id)
        if (wanted.has(e.id) && !has) {
          changed = true
          return { ...e, links: [...e.links, ref], updatedAt: nowIso() }
        }
        if (!wanted.has(e.id) && has) {
          changed = true
          return { ...e, links: e.links.filter((l) => !(l.kind === ref.kind && l.id === ref.id)), updatedAt: nowIso() }
        }
        return e
      })
      return changed ? touch({ ...d, evidence }) : d
    })
  }, [])

  const replaceAll = useCallback((next: AppData) => setData(touch(normalizeData(next))), [])
  const resetAll = useCallback(() => setData(createSeed()), [])

  const value = useMemo<StoreValue>(
    () => ({
      data,
      saveError,
      loadError: initial.current.loadError,
      upsert,
      remove,
      setSettings,
      setInitiative,
      setProgram,
      setEvidenceLinks,
      replaceAll,
      resetAll,
    }),
    [data, saveError, upsert, remove, setSettings, setInitiative, setProgram, setEvidenceLinks, replaceAll, resetAll],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

export const makeBase = () => {
  const now = nowIso()
  return { id: newId(), createdAt: now, updatedAt: now }
}
