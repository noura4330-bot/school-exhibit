// مخزن البيانات: حالة واحدة للتطبيق. تُحفظ في قاعدة البيانات المركزية متى فُعّلت (CloudInit)، وإلا في localStorage على هذا الجهاز.
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
import { deleteFile, getFile, putRawFile } from '../lib/fileStore'
import { ensureBundledFiles } from '../lib/bundledFiles'
import { must, sb, toCloudError } from '../lib/cloud'
import { sync } from '../lib/sync'

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
  /** للاطلاع فقط (المشرفة): لا يُقبل أي تعديل، والقاعدة ترفضه أيضًا */
  readOnly: boolean
  upsert: <K extends CollectionKey>(key: K, item: ItemOf<K>) => void
  remove: (key: CollectionKey, id: string) => Promise<void>
  setSettings: (patch: Partial<Settings>) => void
  setInitiative: (patch: Partial<InitiativeProfile>) => void
  setProgram: (patch: Partial<ProgramStatus>) => void
  setEvidenceLinks: (ref: Ref, evidenceIds: string[]) => void
  replaceAll: (data: AppData) => void
  resetAll: () => void
}

type Mutation = (d: AppData) => AppData

/** بيانات القاعدة المركزية عند فتح الموقع: آخر نسخة محفوظة ورقم إصدارها ودور المستخدم */
export interface CloudInit {
  data: unknown
  version: number
  canEdit: boolean
}

const StoreContext = createContext<StoreValue | null>(null)

const touch = (d: AppData): AppData => ({ ...d, lastUpdated: nowIso() })

/** يبلّغ واجهة الإشعارات بخطأ حفظ ليظهر للمستخدم فورًا */
const reportError = (message: string) => window.dispatchEvent(new CustomEvent('exhibit:download-error', { detail: message }))

export function StoreProvider({ children, cloud }: { children: ReactNode; cloud?: CloudInit }) {
  const initial = useRef(
    cloud
      ? { data: normalizeData(cloud.data), loadError: null, migrated: ((cloud.data as AppData)?.version ?? 1) < DATA_VERSION }
      : load(),
  )
  const [data, setData] = useState<AppData>(initial.current.data)
  const [saveError, setSaveError] = useState<string | null>(null)
  const first = useRef(true)
  const dataRef = useRef(data)
  dataRef.current = data
  const readOnly = Boolean(cloud && !cloud.canEdit)

  // ---------- الحفظ المركزي ----------
  // server: آخر نسخة أكدت القاعدة حفظها. pending: تعديلات لم تُحفظ بعد، تُطبَّق فوقها بالترتيب.
  const server = useRef({ data: initial.current.data, version: cloud?.version ?? 0 })
  const pending = useRef<Mutation[]>([])
  const inflight = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const retryDelay = useRef(0)
  const view = () => pending.current.reduce((d, f) => f(d), server.current.data)

  /** يجلب أحدث نسخة من القاعدة، ويعيد تطبيق التعديلات غير المحفوظة فوقها */
  const refresh = useCallback(async () => {
    if (!cloud || !sb) return
    const row = must(await sb.from('app_state').select('data, version').eq('id', 'main').maybeSingle()) as { data: unknown; version: number } | null
    if (!row || row.version <= server.current.version) return
    server.current = { data: normalizeData(row.data), version: Number(row.version) }
    setData(view())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(async () => {
    if (!sb || inflight.current || !pending.current.length) return
    inflight.current = true
    let again = false
    try {
      const n = pending.current.length
      const next = pending.current.slice(0, n).reduce((d, f) => f(d), server.current.data)
      const version = Number(must(await sb.rpc('save_state', { p_data: next, p_version: server.current.version })))
      server.current = { data: next, version }
      pending.current.splice(0, n)
      retryDelay.current = 0
      again = pending.current.length > 0
      if (!again) {
        setSaveError(null)
        sync.set({ status: 'idle', message: '', pending: 0 })
      }
    } catch (e) {
      const err = toCloudError(e)
      if (err.kind === 'conflict') {
        // عدّل مستخدم آخر في الوقت نفسه: تُجلب نسخته ثم يُعاد تطبيق تعديلاتنا فوقها، فلا يضيع أي منهما
        try {
          await refresh()
          again = true
        } catch (e2) {
          handleRetryable(toCloudError(e2).message)
        }
      } else if (err.kind === 'network' || err.kind === 'auth' || err.kind === 'other') {
        handleRetryable(err.message)
      } else {
        // مرفوض من القاعدة (لا صلاحية): تُلغى التعديلات وتعود البيانات كما في القاعدة
        pending.current = []
        setData(server.current.data)
        const msg = `${err.message} لم تُحفظ التعديلات الأخيرة.`
        setSaveError(msg)
        sync.set({ status: 'error', message: msg, pending: 0 })
        reportError(msg)
      }
    } finally {
      inflight.current = false
    }
    if (again) void flush()
  }, [refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  /** خطأ مؤقت: تبقى التعديلات معروضة ومحفوظة في الذاكرة، ويُعاد الحفظ تلقائيًا */
  function handleRetryable(reason: string) {
    retryDelay.current = Math.min(retryDelay.current ? retryDelay.current * 2 : 3000, 60000)
    const msg = `لم تُحفظ التعديلات في قاعدة البيانات بعد. ${reason} ستُعاد المحاولة تلقائيًا؛ لا تغلقي الصفحة.`
    setSaveError(msg)
    sync.set({ status: 'error', message: msg, pending: pending.current.length })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), retryDelay.current)
  }

  const schedule = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), 250)
  }, [flush])

  /** كل تعديل يمر من هنا: محليًا يُطبَّق ويُحفظ في المتصفح، ومركزيًا يُرسل إلى القاعدة */
  const commit = useCallback(
    (fn: Mutation) => {
      if (!cloud) {
        setData(fn)
        return
      }
      if (!cloud.canEdit) {
        const msg = 'حسابك للاطلاع فقط، فلا يمكن حفظ التعديلات.'
        sync.set({ status: 'error', message: msg, pending: 0 })
        reportError(msg)
        return
      }
      pending.current.push(fn)
      setData(view())
      sync.set({ status: 'saving', message: '', pending: pending.current.length })
      schedule()
    },
    [schedule], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // التحديث من الأجهزة الأخرى: فوريًا عبر Realtime، ودوريًا وعند العودة للصفحة أو الاتصال احتياطًا
  useEffect(() => {
    if (!cloud || !sb) return
    const client = sb
    const quiet = () => void refresh().catch(() => undefined)
    const channel = client
      .channel('app_state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, quiet)
      .subscribe()
    const poll = window.setInterval(quiet, 20000)
    const onOnline = () => {
      quiet()
      if (pending.current.length) void flush()
    }
    const onVisible = () => document.visibilityState === 'visible' && quiet()
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', quiet)
    document.addEventListener('visibilitychange', onVisible)
    // تنبيه قبل إغلاق الصفحة إن بقيت تعديلات لم تُحفظ
    const onUnload = (e: BeforeUnloadEvent) => {
      if (pending.current.length) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onUnload)
    sync.onRetry(() => {
      retryDelay.current = 0
      void flush()
    })
    return () => {
      void client.removeChannel(channel)
      window.clearInterval(poll)
      window.clearTimeout(timer.current)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', quiet)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('beforeunload', onUnload)
      sync.onRetry(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ملف السياسة وتقريرها المرافق يُحفظان في مخزن الملفات المحلي عند أول فتح (مركزيًا يُقرآن من الموقع مباشرة)
  useEffect(() => {
    if (!cloud) void ensureBundledFiles(data, { getFile, putRawFile }).catch(() => undefined)
  }, [data.govDocs]) // eslint-disable-line react-hooks/exhaustive-deps

  // الحفظ المحلي في المتصفح (حين لا تكون القاعدة المركزية مفعّلة)
  useEffect(() => {
    if (first.current) {
      first.current = false
      // البيانات المحفوظة بإصدار أقدم تُحفظ فور ترقيتها كي لا تتكرر الترقية عند كل فتح
      if (!initial.current.migrated) return
      if (cloud) {
        if (cloud.canEdit) commit((d) => d)
        return
      }
    }
    if (cloud) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      setSaveError(null)
    } catch {
      setSaveError('تعذر حفظ التعديلات الأخيرة على هذا الجهاز (قد تكون مساحة التخزين ممتلئة). صدّري نسخة احتياطية فورًا.')
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const upsert = useCallback(<K extends CollectionKey>(key: K, item: ItemOf<K>) => {
    commit((d) => {
      const list = d[key] as unknown as BaseRecord[]
      const rec = { ...(item as BaseRecord), updatedAt: nowIso() }
      const exists = list.some((x) => x.id === rec.id)
      const next = exists ? list.map((x) => (x.id === rec.id ? rec : x)) : [...list, rec]
      return touch({ ...d, [key]: next })
    })
  }, [commit])

  const remove = useCallback(async (key: CollectionKey, id: string) => {
    if (readOnly) return commit((d) => d)
    const removed = (dataRef.current[key] as unknown as BaseRecord[]).find((x) => x.id === id)
    commit((d) => {
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
    // حذف الملفات المرتبطة بالسجل بعد تأكيد حذفه
    if (cloud && !(await sync.settle())) return
    await Promise.all(attachmentsOf(removed).map((a) => deleteFile(a.id).catch(() => undefined)))
  }, [commit, readOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  const setSettings = useCallback((patch: Partial<Settings>) => {
    commit((d) => touch({ ...d, settings: { ...d.settings, ...patch } }))
  }, [commit])

  const setInitiative = useCallback((patch: Partial<InitiativeProfile>) => {
    commit((d) => touch({ ...d, initiative: { ...d.initiative, ...patch, updatedAt: nowIso() } }))
  }, [commit])

  const setProgram = useCallback((patch: Partial<ProgramStatus>) => {
    commit((d) => touch({ ...d, program: { ...d.program, ...patch } }))
  }, [commit])

  const setEvidenceLinks = useCallback((ref: Ref, evidenceIds: string[]) => {
    commit((d) => {
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
  }, [commit])

  const replaceAll = useCallback((next: AppData) => commit(() => touch(normalizeData(next))), [commit])
  const resetAll = useCallback(() => commit(() => createSeed()), [commit])

  const value = useMemo<StoreValue>(
    () => ({
      data,
      saveError,
      loadError: initial.current.loadError,
      readOnly,
      upsert,
      remove,
      setSettings,
      setInitiative,
      setProgram,
      setEvidenceLinks,
      replaceAll,
      resetAll,
    }),
    [data, saveError, readOnly, upsert, remove, setSettings, setInitiative, setProgram, setEvidenceLinks, replaceAll, resetAll],
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
