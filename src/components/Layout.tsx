import { useEffect, useState, type ReactNode } from 'react'
import { DismissRegular, EditRegular, NavigationRegular, PersonRegular, SignOutRegular } from '@fluentui/react-icons'
import { href, type RouteId } from '../lib/router'
import { navItems } from './nav'
import { useStore } from '../data/store'
import { formatDateTime } from '../lib/util'
import { getFile } from '../lib/fileStore'
import { Modal, useFeedback } from './feedback'
import { SiteFooter } from './SiteFooter'
import { identityHeader } from './identity'
import { useReveal } from '../lib/motion'
import { useCloud } from './CloudGate'
import { SyncStatus } from './SyncStatus'
import { roleLabels } from '../lib/cloud'

function useLogo(fileId: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    if (!fileId) {
      setUrl(null)
      return
    }
    getFile(fileId)
      .then((f) => {
        if (alive && f) {
          made = URL.createObjectURL(f.blob)
          setUrl(made)
        }
      })
      .catch(() => setUrl(null))
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [fileId])
  return url
}

export function Layout({ route, children }: { route: RouteId; children: ReactNode }) {
  const { data, setSettings, readOnly } = useStore()
  const { toast } = useFeedback()
  const cloud = useCloud()
  const [menuOpen, setMenuOpen] = useState(false)
  const [yearOpen, setYearOpen] = useState(false)
  const [year, setYear] = useState('')
  const logo = useLogo(data.settings.logoFileId)
  const s = data.settings

  useEffect(() => setMenuOpen(false), [route])
  useReveal(route)
  // القائمة على الجوال: Escape يغلقها ويعيد التركيز إلى زرها
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
      document.querySelector<HTMLButtonElement>('.menu-toggle')?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])
  useEffect(() => {
    document.documentElement.dataset.brand = s.brand
  }, [s.brand])
  // حساب الاطلاع فقط: تُخفى أدوات التعديل (والقاعدة ترفض أي تعديل على كل حال)
  useEffect(() => {
    if (readOnly) document.documentElement.dataset.access = 'read'
    else delete document.documentElement.dataset.access
  }, [readOnly])
  useEffect(() => {
    const label = navItems.find((n) => n.id === route)?.label
    document.title = `${label ? `${label} | ` : ''}${s.exhibitName}`
  }, [route, s.exhibitName])

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        تخطي إلى المحتوى
      </a>
      <header className="app-header">
        <button
          className="btn subtle icon menu-toggle"
          aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={menuOpen}
          aria-controls="app-nav"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <DismissRegular /> : <NavigationRegular />}
        </button>
        {/* الترويسة الموحدة لكل الصفحات: الشعار المصور ثم اسم المدرسة والجهة واسم المعرض */}
        <a className="identity" href={href('home')} aria-label={`${s.exhibitName}، ${s.schoolName}: الصفحة الرئيسية`}>
          <span className="id-emblem">
            {logo ? (
              <img className="logo" src={logo} alt="" />
            ) : (
              <img src={identityHeader} width={1280} height={426} alt="" />
            )}
          </span>
          <span className="id-text">
            <span className="id-top">
              <span className="id-school">{s.schoolName}</span>
              <span className="id-dept">
                {s.department}
                {s.governorate && ` – محافظة ${s.governorate}`}
              </span>
            </span>
            <span className="id-exhibit">{s.exhibitName}</span>
          </span>
        </a>
        <div className="header-meta">
          {cloud && <SyncStatus />}
          <div className="meta-item year">
            <span>السنة الدراسية</span>
            <span className="row" style={{ gap: 2 }}>
              <strong>{s.academicYear || 'لم تُحدد'}</strong>
              <button
                className="btn subtle small icon no-print edit-only"
                aria-label="تعديل السنة الدراسية"
                title="تعديل السنة الدراسية"
                onClick={() => {
                  setYear(s.academicYear)
                  setYearOpen(true)
                }}
              >
                <EditRegular />
              </button>
            </span>
          </div>
          <div className="meta-item hide-sm">
            <span>آخر تحديث</span>
            <strong>{formatDateTime(data.lastUpdated)}</strong>
          </div>
        </div>
      </header>

      {menuOpen && <div className="nav-scrim" onClick={() => setMenuOpen(false)} aria-hidden />}
      <nav id="app-nav" className={`app-nav${menuOpen ? ' open' : ''}`} aria-label="التنقل الرئيسي">
        <ul>
          {navItems.map((n, i) => {
            const head = i === 0 || navItems[i - 1].group !== n.group ? n.group : null
            return (
              <li key={n.id}>
                {head && <div className="nav-group-label">{head}</div>}
                <a className="nav-link" href={href(n.id)} aria-current={route === n.id ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
                  {n.icon}
                  <span>{n.label}</span>
                </a>
              </li>
            )
          })}
        </ul>
        {cloud ? (
          cloud.user ? (
            <div className="nav-footer nav-user">
              <div>
                <strong>{cloud.user.name || cloud.user.email}</strong>
                <div>{roleLabels[cloud.user.role]}</div>
              </div>
              <button className="btn subtle small" onClick={() => void cloud.signOut()}>
                <SignOutRegular /> تسجيل الخروج
              </button>
            </div>
          ) : (
            <div className="nav-footer nav-user">
              <div>تصفح المعرض متاح للجميع.</div>
              <button className="btn subtle small" onClick={cloud.signIn}>
                <PersonRegular /> دخول مديرة النظام
              </button>
            </div>
          )
        ) : (
          <div className="nav-footer">
            البيانات محفوظة في متصفح هذا الجهاز فقط، وليست على خادم أو سحابة. صدّري نسخة احتياطية بانتظام من الإعدادات.
          </div>
        )}
      </nav>

      <main id="main" className="app-main" tabIndex={-1}>
        {children}
        <SiteFooter />
      </main>

      {yearOpen && (
        <Modal onClose={() => setYearOpen(false)} labelledBy="year-title" center>
          <form
            className="dialog"
            onSubmit={(e) => {
              e.preventDefault()
              setSettings({ academicYear: year.trim() })
              setYearOpen(false)
              toast('تم تحديث السنة الدراسية.')
            }}
          >
            <div className="dialog-head">
              <h2 id="year-title">السنة الدراسية</h2>
            </div>
            <div className="dialog-body">
              <div className="field">
                <label htmlFor="year-input">السنة الدراسية الحالية</label>
                <input
                  id="year-input"
                  className="input"
                  value={year}
                  placeholder="مثال: 1448هـ أو 2026–2027"
                  onChange={(e) => setYear(e.target.value)}
                  data-autofocus
                />
              </div>
            </div>
            <div className="dialog-foot">
              <button type="button" className="btn" onClick={() => setYearOpen(false)}>
                إلغاء
              </button>
              <button type="submit" className="btn primary">
                حفظ
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
