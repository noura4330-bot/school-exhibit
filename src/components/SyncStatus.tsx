// حالة الحفظ في قاعدة البيانات المركزية، ظاهرة في الترويسة دائمًا.
import { useEffect, useState } from 'react'
import { sync } from '../lib/sync'

export function SyncStatus() {
  const [s, setS] = useState(sync.get())
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => sync.subscribe(setS), [])
  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
    }
  }, [])
  const state = s.status === 'error' ? 'error' : s.status === 'saving' ? 'saving' : !online ? 'offline' : 'idle'
  const label = {
    idle: 'تم الحفظ',
    saving: 'جارٍ الحفظ…',
    error: s.pending ? 'لم يُحفظ بعد' : 'تعذر الحفظ',
    offline: 'غير متصل',
  }[state]
  return (
    <div className={`sync-status ${state} no-print`} role="status" aria-live="polite" title={s.message || (state === 'idle' ? 'كل التعديلات محفوظة في قاعدة البيانات المركزية' : '')}>
      <span className="dot" aria-hidden />
      <span>{label}</span>
      {state === 'error' && s.pending > 0 && (
        <button className="btn subtle small" onClick={() => sync.retry()}>
          إعادة المحاولة
        </button>
      )}
    </div>
  )
}
