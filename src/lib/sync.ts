// حالة الحفظ في قاعدة البيانات المركزية، مشتركة بين المخزن والترويسة ورسائل النجاح.
// رسائل «تم الحفظ» تنتظر نتيجة الحفظ الفعلية قبل أن تظهر (انظر feedback.tsx).
export type SyncStatus = 'idle' | 'saving' | 'error'
export interface SyncState {
  status: SyncStatus
  message: string
  pending: number
}

let state: SyncState = { status: 'idle', message: '', pending: 0 }
const listeners = new Set<(s: SyncState) => void>()
let waiters: ((ok: boolean) => void)[] = []
let retryFn: (() => void) | null = null

export const sync = {
  get: () => state,
  subscribe(fn: (s: SyncState) => void) {
    listeners.add(fn)
    return () => void listeners.delete(fn)
  },
  set(next: Partial<SyncState>) {
    state = { ...state, ...next }
    listeners.forEach((l) => l(state))
    if (state.status !== 'saving') {
      const ok = state.status === 'idle'
      waiters.forEach((w) => w(ok))
      waiters = []
    }
  },
  busy: () => state.status === 'saving',
  /** يُحل عند انتهاء الحفظ الجاري: true عند النجاح، false عند الخطأ */
  settle: () => (state.status === 'saving' ? new Promise<boolean>((r) => waiters.push(r)) : Promise.resolve(state.status === 'idle')),
  onRetry(fn: (() => void) | null) {
    retryFn = fn
  },
  retry: () => retryFn?.(),
}
