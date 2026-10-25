// عميل قاعدة البيانات المركزية (Supabase) ورسائل أخطائها بالعربية.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cloudConfig } from '../cloud.config'

const env = import.meta.env
const url = (env.VITE_SUPABASE_URL as string | undefined) || cloudConfig.url
const anonKey = (env.VITE_SUPABASE_ANON_KEY as string | undefined) || cloudConfig.anonKey

/** الحفظ المركزي مفعّل متى وُجد الإعداد، إلا في نسخة الصفحة الواحدة (VITE_LOCAL_ONLY) */
export const cloudEnabled = Boolean(url && anonKey) && env.VITE_LOCAL_ONLY !== '1'

export const sb: SupabaseClient | null = cloudEnabled
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

export const FILES_BUCKET = 'exhibit-files'


export type Role = 'pending' | 'admin' | 'editor' | 'supervisor' | 'revoked'
export const roleLabels: Record<Role, string> = {
  admin: 'مديرة النظام',
  editor: 'مستخدم مصرّح له بالتعديل',
  supervisor: 'اطلاع فقط (المشرفة والمستخدمون)',
  pending: 'بانتظار منح الصلاحية',
  revoked: 'صلاحية ملغاة',
}
export const canReadRole = (r: Role | null | undefined) => r === 'admin' || r === 'editor' || r === 'supervisor'
export const canEditRole = (r: Role | null | undefined) => r === 'admin' || r === 'editor'

/** خطأ قاعدة البيانات أو الشبكة برسالة عربية واضحة، مع نوعه للتعامل معه */
export type CloudErrorKind = 'network' | 'forbidden' | 'conflict' | 'auth' | 'not_initialized' | 'already_initialized' | 'other'
export class CloudError extends Error {
  kind: CloudErrorKind
  constructor(message: string, kind: CloudErrorKind) {
    super(message)
    this.kind = kind
  }
}

export function toCloudError(e: unknown): CloudError {
  if (e instanceof CloudError) return e
  const err = (e ?? {}) as { code?: string; message?: string; status?: number; name?: string }
  const msg = String(err.message ?? e ?? '')
  const code = String(err.code ?? '')
  if (code === '40001' || /conflict/.test(msg)) return new CloudError('عدّل شخص آخر البيانات في الوقت نفسه.', 'conflict')
  if (code === '42501' || /forbidden|permission denied|row-level security/i.test(msg) || err.status === 403)
    return new CloudError('ليست لديك صلاحية لهذا الإجراء.', 'forbidden')
  if (code === 'P0002' && /not_initialized/.test(msg)) return new CloudError('لم تُهيأ قاعدة البيانات بعد.', 'not_initialized')
  if (code === '23505' && /already_initialized/.test(msg)) return new CloudError('قاعدة البيانات مهيأة مسبقًا، فلم يُكرر نقل البيانات.', 'already_initialized')
  if (code === 'PGRST301' || /JWT|jwt|token is expired|refresh token|session/i.test(msg) || err.status === 401)
    return new CloudError('انتهت جلسة الدخول. سجّلي الدخول من جديد.', 'auth')
  if (/Failed to fetch|NetworkError|network|fetch failed|Load failed|timeout/i.test(msg) || err.name === 'TypeError')
    return new CloudError('تعذر الاتصال بقاعدة البيانات. تحققي من الاتصال بالإنترنت.', 'network')
  return new CloudError(`تعذرت العملية: ${msg || 'خطأ غير معروف'}`, 'other')
}

/** يرمي الخطأ إن وُجد في رد Supabase */
export function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw toCloudError(res.error)
  return res.data
}
