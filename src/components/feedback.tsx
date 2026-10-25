// الإشعارات ونوافذ التأكيد والدرج الجانبي للنماذج.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckmarkCircleRegular, DismissRegular, ErrorCircleRegular, InfoRegular } from '@fluentui/react-icons'
import { newId } from '../lib/util'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: string
  kind: ToastKind
  text: string
}

interface ConfirmOptions {
  title: string
  body?: ReactNode
  confirmLabel?: string
  danger?: boolean
}

interface FeedbackValue {
  toast: (text: string, kind?: ToastKind) => void
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackValue | null>(null)

const toastIcon = { success: CheckmarkCircleRegular, error: ErrorCircleRegular, info: InfoRegular }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)

  const toast = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = newId()
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000)
  }, [])

  useEffect(() => {
    const on = (e: Event) => toast(String((e as CustomEvent).detail), 'error')
    window.addEventListener('exhibit:download-error', on)
    return () => window.removeEventListener('exhibit:download-error', on)
  }, [toast])

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  )

  const close = (v: boolean) => {
    pending?.resolve(v)
    setPending(null)
  }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => {
          const Icon = toastIcon[t.kind]
          return (
            <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
              <Icon aria-hidden />
              <div style={{ flex: 1 }}>{t.text}</div>
              <button
                className="btn subtle small icon"
                aria-label="إغلاق الإشعار"
                onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              >
                <DismissRegular />
              </button>
            </div>
          )
        })}
      </div>
      {pending && (
        <Modal onClose={() => close(false)} labelledBy="confirm-title" center>
          <div className="dialog">
            <div className="dialog-head">
              <h2 id="confirm-title">{pending.title}</h2>
            </div>
            {pending.body && <div className="dialog-body">{pending.body}</div>}
            <div className="dialog-foot">
              <button className="btn" onClick={() => close(false)}>
                إلغاء
              </button>
              <button className={`btn ${pending.danger ? 'danger-solid' : 'primary'}`} onClick={() => close(true)} data-autofocus>
                {pending.confirmLabel ?? 'تأكيد'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </FeedbackContext.Provider>
  )
}

export function useFeedback(): FeedbackValue {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used inside FeedbackProvider')
  return ctx
}

const focusableSel =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** طبقة نافذة مع حبس التركيز والإغلاق بمفتاح Escape */
export function Modal({
  children,
  onClose,
  labelledBy,
  center,
}: {
  children: ReactNode
  onClose: () => void
  labelledBy: string
  center?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const root = ref.current
    const first = root?.querySelector<HTMLElement>('[data-autofocus]') ?? root?.querySelector<HTMLElement>(focusableSel)
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
      if (e.key === 'Tab' && root) {
        const items = Array.from(root.querySelectorAll<HTMLElement>(focusableSel)).filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const firstEl = items[0]
        const lastEl = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    root?.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      root?.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [])

  return (
    <div
      className={`overlay${center ? ' center' : ''}`}
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {children}
    </div>
  )
}

export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Modal onClose={onClose} labelledBy="drawer-title">
      <div className="drawer">
        <div className="drawer-head">
          <h2 id="drawer-title">{title}</h2>
          <button className="btn subtle icon" aria-label="إغلاق" onClick={onClose}>
            <DismissRegular />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </Modal>
  )
}
