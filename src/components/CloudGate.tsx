// بوابة الحفظ المركزي: تسجيل الدخول، والتحقق من الدور، وتحميل البيانات من القاعدة قبل عرض الموقع.
// لا تُعرض أي بيانات قبل الدخول بحساب له صلاحية، ولا تُستعمل نسخة محلية قديمة بدل بيانات القاعدة.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowDownloadRegular, ArrowUploadRegular, SignOutRegular } from '@fluentui/react-icons'
import { canEditRole, must, sb, toCloudError, type Role } from '../lib/cloud'
import { cloudPutRawFile } from '../lib/cloudFiles'
import { localFiles } from '../lib/fileStore'
import { backupFiles, buildBackup, parseBackup, type ExportFile } from '../lib/backup'
import { downloadBlob, todayIso } from '../lib/util'
import { createSeed } from '../data/seed'
import type { AppData } from '../data/types'
import { normalizeData, StoreProvider, type CloudInit } from '../data/store'
import { Message } from './ui'
import { identityHeader } from './identity'
import { FooterBody } from './SiteFooter'

const STORAGE_KEY = 'school-exhibit-data-v1'

export interface CloudUser {
  id: string
  email: string
  name: string
  role: Role
}
interface CloudValue {
  /** null: زائر يشاهد دون تسجيل دخول */
  user: CloudUser | null
  signOut: () => Promise<void>
  /** يفتح شاشة الدخول (لمديرة النظام) */
  signIn: () => void
}
const CloudContext = createContext<CloudValue | null>(null)
/** المستخدم الحالي في الحفظ المركزي، أو null في الحفظ المحلي */
export const useCloud = () => useContext(CloudContext)

const client = () => sb!

// المشاهدة للجميع دون تسجيل دخول (قرار مديرة النظام 2026-10-25)، والتعديل لمن يملك الدور فقط.
type Phase =
  | { kind: 'loading'; text: string }
  | { kind: 'signing-in' }
  | { kind: 'recovery' }
  | { kind: 'not-initialized'; user: CloudUser | null }
  | { kind: 'ready'; user: CloudUser | null; init: CloudInit }
  | { kind: 'error'; text: string; user?: CloudUser | null }

export function CloudGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading', text: 'جارٍ تحميل المعرض…' })
  const [loadKey, setLoadKey] = useState(0)
  const current = useRef<string | null>(null)

  const load = useCallback(async (session: Session | null) => {
    current.current = session?.user.id ?? null
    setPhase({ kind: 'loading', text: 'جارٍ تحميل أحدث البيانات من قاعدة البيانات…' })
    try {
      let user: CloudUser | null = null
      if (session) {
        const p = must(await client().from('profiles').select('email, full_name, role').eq('id', session.user.id).maybeSingle()) as {
          email: string
          full_name: string
          role: Role
        } | null
        user = {
          id: session.user.id,
          email: p?.email || session.user.email || '',
          name: p?.full_name || '',
          role: p?.role ?? 'pending',
        }
      }
      const row = must(await client().from('app_state').select('data, version').eq('id', 'main').maybeSingle()) as {
        data: unknown
        version: number
      } | null
      if (!row) return setPhase({ kind: 'not-initialized', user })
      setPhase({ kind: 'ready', user, init: { data: row.data, version: Number(row.version), canEdit: canEditRole(user?.role) } })
      setLoadKey((k) => k + 1)
    } catch (e) {
      setPhase({ kind: 'error', text: toCloudError(e).message })
    }
  }, [])

  useEffect(() => {
    let alive = true
    void client()
      .auth.getSession()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setPhase({ kind: 'error', text: toCloudError(error).message })
        else void load(data.session)
      })
    const { data: sub } = client().auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') return setPhase({ kind: 'recovery' })
      if (event === 'SIGNED_OUT') return void load(null)
      // تجديد الجلسة لا يعيد تحميل الصفحة؛ الدخول بحساب مختلف يعيده
      if (event === 'SIGNED_IN' && session && session.user.id !== current.current) void load(session)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [load])

  const signOut = useCallback(async () => {
    await client().auth.signOut()
  }, [])
  const reload = () => void client().auth.getSession().then(({ data }) => load(data.session))
  const signIn = useCallback(() => setPhase({ kind: 'signing-in' }), [])

  if (phase.kind === 'ready')
    return (
      <CloudContext.Provider value={{ user: phase.user, signOut, signIn }}>
        <StoreProvider key={`${phase.user?.id ?? 'guest'}-${loadKey}`} cloud={phase.init}>
          {children}
        </StoreProvider>
      </CloudContext.Provider>
    )

  return (
    <GateShell user={'user' in phase ? phase.user ?? undefined : undefined} onSignOut={signOut}>
      {phase.kind === 'loading' && <p className="muted" role="status">{phase.text}</p>}
      {phase.kind === 'signing-in' && <SignIn onBack={reload} />}
      {phase.kind === 'recovery' && <NewPassword onDone={reload} />}
      {phase.kind === 'error' && (
        <Message tone="danger" title="تعذر الوصول إلى قاعدة البيانات">
          {phase.text} لم تُعرض أي نسخة محلية قديمة بدل البيانات المركزية.
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={reload}>
              إعادة المحاولة
            </button>
          </div>
        </Message>
      )}
      {phase.kind === 'not-initialized' &&
        (phase.user?.role === 'admin' ? (
          <Migration onDone={reload} />
        ) : (
          <Message tone="info" title="لم تُنقل بيانات المعرض إلى قاعدة البيانات بعد">
            تنقل مديرة النظام البيانات الحالية أولًا عند أول دخول لها، ثم تظهر هنا.
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={reload}>
                تحديث
              </button>
              {!phase.user && (
                <button className="btn subtle" onClick={signIn}>
                  دخول مديرة النظام
                </button>
              )}
            </div>
          </Message>
        ))}
    </GateShell>
  )
}

/** إطار شاشات الدخول بهوية المعرض نفسها */
function GateShell({ children, user, onSignOut }: { children: ReactNode; user?: CloudUser; onSignOut: () => Promise<void> }) {
  return (
    <div className="gate">
      <header className="app-header gate-head">
        <div className="identity">
          <span className="id-emblem">
            <img src={identityHeader} width={1280} height={426} alt="" />
          </span>
          <div className="id-text">
            <div className="id-top">
              <span className="id-school">ثانوية أحد بني زيد</span>
              <span className="id-dept">إدارة تعليم مكة المكرمة – محافظة القنفذة</span>
            </div>
            <div className="id-exhibit">معرض التمكين المدرسي للذكاء الاصطناعي والتحول الرقمي</div>
          </div>
        </div>
        {user && (
          <button className="btn subtle small" onClick={() => void onSignOut()}>
            <SignOutRegular /> تسجيل الخروج
          </button>
        )}
      </header>
      <main id="main" className="gate-main" tabIndex={-1}>
        <section className="section gate-card">
          <div className="section-body stack">{children}</div>
        </section>
        <FooterBody schoolName="ثانوية أحد بني زيد" withLinks={false} />
      </main>
    </div>
  )
}

function Field({ id, label, ...rest }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" {...rest} />
    </div>
  )
}

const redirectTo = () => window.location.origin + window.location.pathname

function SignIn({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const auth = client().auth
      if (mode === 'in') {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else if (mode === 'up') {
        const { data, error } = await auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo() },
        })
        if (error) throw error
        if (!data.session) setInfo('أُرسل رابط تأكيد إلى بريدك. افتحيه ثم سجّلي الدخول. بعد ذلك تمنحك مديرة النظام الصلاحية.')
      } else {
        const { error } = await auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() })
        if (error) throw error
        setInfo('إن كان البريد مسجلًا فسيصله رابط لتعيين كلمة مرور جديدة.')
      }
    } catch (err) {
      setError(authMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
      <div>
        <h1 className="section-title">{mode === 'in' ? 'تسجيل الدخول' : mode === 'up' ? 'إنشاء حساب' : 'استعادة كلمة المرور'}</h1>
        <p className="muted">
          المشاهدة متاحة للجميع دون تسجيل دخول. الدخول لمديرة النظام لإضافة البيانات وتعديلها.
          {mode === 'up' && ' الحساب الجديد للاطلاع فقط ما لم تمنحه مديرة النظام غير ذلك.'}
        </p>
      </div>
      {mode === 'up' && <Field id="gate-name" label="الاسم" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />}
      <Field id="gate-email" label="البريد الإلكتروني" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      {mode !== 'reset' && (
        <Field
          id="gate-password"
          label="كلمة المرور"
          type="password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
          minLength={8}
          required
        />
      )}
      {error && <Message tone="danger" title="تعذر الإكمال">{error}</Message>}
      {info && <Message tone="success" title="تم">{info}</Message>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy || !email.trim() || (mode !== 'reset' && password.length < (mode === 'up' ? 8 : 1))}>
          {busy ? 'جارٍ…' : mode === 'in' ? 'دخول' : mode === 'up' ? 'إنشاء الحساب' : 'إرسال الرابط'}
        </button>
        {mode !== 'in' && (
          <button type="button" className="btn subtle" onClick={() => setMode('in')}>
            لدي حساب
          </button>
        )}
        {mode !== 'up' && (
          <button type="button" className="btn subtle" onClick={() => setMode('up')}>
            إنشاء حساب
          </button>
        )}
        {mode === 'in' && (
          <button type="button" className="btn subtle" onClick={() => setMode('reset')}>
            نسيت كلمة المرور
          </button>
        )}
        <button type="button" className="btn subtle" onClick={onBack}>
          العودة إلى المعرض
        </button>
      </div>
      <p className="caption">لا يطلب الموقع كلمات مرور حسابات Microsoft. استخدمي كلمة مرور خاصة بهذا الموقع (8 أحرف على الأقل).</p>
    </form>
  )
}

function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await client().auth.updateUser({ password })
    setBusy(false)
    if (error) setError(authMessage(error))
    else onDone()
  }
  return (
    <form className="stack" onSubmit={(e) => void submit(e)}>
      <h1 className="section-title">تعيين كلمة مرور جديدة</h1>
      <Field id="gate-new-password" label="كلمة المرور الجديدة" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} />
      {error && <Message tone="danger" title="تعذر الحفظ">{error}</Message>}
      <div className="row">
        <button className="btn primary" disabled={busy || password.length < 8}>
          حفظ كلمة المرور
        </button>
      </div>
    </form>
  )
}

function authMessage(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? e)
  if (/Invalid login credentials/i.test(msg)) return 'البريد أو كلمة المرور غير صحيحة.'
  if (/Email not confirmed/i.test(msg)) return 'لم يُؤكَّد البريد بعد. افتحي رابط التأكيد المرسل إلى بريدك.'
  if (/already registered|already been registered|User already/i.test(msg)) return 'هذا البريد مسجل مسبقًا. سجّلي الدخول أو استعيدي كلمة المرور.'
  if (/Password should be|password.*characters|weak/i.test(msg)) return 'كلمة المرور ضعيفة أو قصيرة. استخدمي 8 أحرف على الأقل.'
  if (/rate limit|too many/i.test(msg)) return 'محاولات كثيرة متتالية. انتظري قليلًا ثم أعيدي المحاولة.'
  if (/Signups not allowed/i.test(msg)) return 'إنشاء الحسابات معطّل. تواصلي مع مديرة النظام.'
  return toCloudError(e).message
}

/** نقل البيانات الحالية إلى القاعدة عند أول دخول للمديرة: نسخة احتياطية أولًا، ثم النقل مرة واحدة */
function Migration({ onDone }: { onDone: () => void }) {
  const local = readLocal()
  const [backedUp, setBackedUp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  const backup = async () => {
    setError('')
    setBusy(true)
    try {
      const files = await localFiles.listAll().catch(() => [])
      const payload = await buildBackup(local as AppData, files)
      const ok = await downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }), `exhibit-backup-before-migration-${todayIso()}.json`)
      if (ok) setBackedUp(true)
      else setError('لم يكتمل تنزيل النسخة الاحتياطية، فلم يبدأ النقل.')
    } catch (e) {
      setError(`تعذر تنزيل النسخة الاحتياطية: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  /** الملفات أولًا ثم البيانات، كي لا يشير سجل إلى ملف غير موجود */
  const run = async (data: unknown, files: AsyncIterable<Parameters<typeof cloudPutRawFile>[0]>) => {
    setError('')
    setBusy(true)
    try {
      let n = 0
      for await (const f of files) {
        setProgress(`جارٍ رفع الملفات… (${++n})`)
        await cloudPutRawFile(f)
      }
      setProgress('جارٍ حفظ البيانات…')
      must(await client().rpc('init_state', { p_data: normalizeData(data) }))
      onDone()
    } catch (e) {
      const err = toCloudError(e)
      if (err.kind === 'already_initialized') return onDone()
      setError(`${err.message} لم تُحذف أي بيانات من هذا المتصفح، ويمكن إعادة المحاولة دون تكرار الملفات.`)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function* localIter() {
    for (const f of await localFiles.listAll().catch(() => [])) yield f
  }

  const fromBackup = async (file: File) => {
    let parsed: ExportFile
    try {
      parsed = await parseBackup(file)
    } catch (e) {
      setError((e as Error).message)
      return
    }
    await run(parsed.data, backupFiles(parsed))
    if (importRef.current) importRef.current.value = ''
  }

  return (
    <div className="stack">
      <div>
        <h1 className="section-title">نقل بيانات المعرض إلى قاعدة البيانات المركزية</h1>
        <p className="muted">قاعدة البيانات فارغة. اختاري مصدر البيانات مرة واحدة؛ بعدها يرى كل المصرّح لهم البيانات نفسها من أي جهاز.</p>
      </div>
      {local ? (
        <Message tone="info" title="وُجدت بيانات محفوظة في هذا المتصفح">
          <ol style={{ margin: '4px 0 0', paddingInlineStart: 20 }}>
            <li>نزّلي نسخة احتياطية كاملة منها أولًا (مع الملفات).</li>
            <li>ثم انقليها إلى قاعدة البيانات. تبقى النسخة المحلية كما هي ولا تُحذف.</li>
          </ol>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={busy} onClick={() => void backup()}>
              <ArrowDownloadRegular /> {backedUp ? 'نُزّلت النسخة الاحتياطية ✓' : '١. تنزيل نسخة احتياطية'}
            </button>
            <button className="btn primary" disabled={busy || !backedUp} onClick={() => void run(local, localIter())}>
              ٢. نقل البيانات والملفات
            </button>
          </div>
        </Message>
      ) : (
        <p className="caption">لا توجد بيانات محفوظة في هذا المتصفح. إن كانت البيانات على جهاز آخر أو في النسخة السابقة من الموقع، فصدّري منها نسخة احتياطية (مع الملفات) من صفحة الإعدادات ثم استورديها هنا.</p>
      )}
      <div className="row">
        <input ref={importRef} type="file" accept=".json,application/json" className="sr-only" aria-label="ملف النسخة الاحتياطية" onChange={(e) => e.target.files?.[0] && void fromBackup(e.target.files[0])} />
        <button className="btn" disabled={busy} onClick={() => importRef.current?.click()}>
          <ArrowUploadRegular /> استيراد ملف نسخة احتياطية
        </button>
        {!local && (
          <button className="btn subtle" disabled={busy} onClick={() => void run(createSeed(), (async function* () {})())}>
            البدء ببيانات المعرض الأساسية
          </button>
        )}
      </div>
      {progress && <p className="muted" role="status">{progress}</p>}
      {error && <Message tone="danger" title="لم يكتمل النقل">{error}</Message>}
    </div>
  )
}

function readLocal(): unknown | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
