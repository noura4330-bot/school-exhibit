// إدارة المستخدمين والصلاحيات (لمديرة النظام فقط). تغيير الدور يتم بدالة set_user_role في القاعدة،
// وهي ترفض أي طلب من غير المديرة، فلا تعتمد الحماية على إظهار هذا القسم أو إخفائه.
import { useCallback, useEffect, useState } from 'react'
import { must, roleLabels, sb, toCloudError, type Role } from '../lib/cloud'
import { formatDate } from '../lib/util'
import { useFeedback } from './feedback'
import { Badge, Section } from './ui'
import type { CloudUser } from './CloudGate'

interface ProfileRow {
  id: string
  email: string
  full_name: string
  role: Role
  created_at: string
}

const roleOrder: Role[] = ['admin', 'editor', 'supervisor', 'pending', 'revoked']
const tone: Record<Role, 'brand' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  admin: 'brand',
  editor: 'success',
  supervisor: 'brand',
  pending: 'warning',
  revoked: 'danger',
}

export function UsersAdmin({ me }: { me: CloudUser }) {
  const { toast, confirm } = useFeedback()
  const [rows, setRows] = useState<ProfileRow[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = must(await sb!.from('profiles').select('id, email, full_name, role, created_at').order('created_at')) as ProfileRow[]
      setRows(data)
      setError('')
    } catch (e) {
      setError(toCloudError(e).message)
    }
  }, [])
  useEffect(() => void load(), [load])

  const change = async (u: ProfileRow, role: Role) => {
    if (role === u.role) return
    const risky = role === 'admin' || role === 'revoked'
    if (risky) {
      const ok = await confirm({
        title: role === 'admin' ? 'منح صلاحية مديرة النظام؟' : 'إلغاء صلاحية هذا الحساب؟',
        body:
          role === 'admin'
            ? `سيتمكن ${u.email} من تعديل كل البيانات وإدارة صلاحيات الجميع.`
            : `لن يتمكن ${u.email} من الاطلاع على أي بيانات أو تعديلها، ويسري ذلك فورًا.`,
        confirmLabel: role === 'admin' ? 'منح الصلاحية' : 'إلغاء الصلاحية',
        danger: role === 'revoked',
      })
      if (!ok) return
    }
    setBusy(u.id)
    try {
      must(await sb!.rpc('set_user_role', { target: u.id, new_role: role }))
      // يُعرض الدور كما أكدته القاعدة، لا كما اختير في القائمة
      await load()
      toast(`تم تغيير صلاحية ${u.email} إلى «${roleLabels[role]}».`)
    } catch (e) {
      toast(`تعذر تغيير الصلاحية: ${toCloudError(e).message}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Section
      title="المستخدمون والصلاحيات"
      sub="لمديرة النظام فقط. يُنشئ كل شخص حسابه من صفحة الدخول، فيظهر هنا «بانتظار منح الصلاحية» حتى تحددي دوره"
      actions={
        <button className="btn small" onClick={() => void load()}>
          تحديث القائمة
        </button>
      }
      flush
    >
      {error && <p className="muted" style={{ padding: 16 }} role="alert">{error}</p>}
      {!rows && !error && <p className="muted" style={{ padding: 16 }}>جارٍ التحميل…</p>}
      {rows && (
        <div className="table-wrap">
          <table className="table users-table">
            <thead>
              <tr>
                <th>الحساب</th>
                <th>الصلاحية الحالية</th>
                <th>تاريخ التسجيل</th>
                <th>تغيير الصلاحية</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div>{u.full_name || '—'}</div>
                    <div className="caption ltr">{u.email}</div>
                  </td>
                  <td>
                    <Badge tone={tone[u.role]}>{roleLabels[u.role]}</Badge>
                  </td>
                  <td className="nowrap">{formatDate(u.created_at?.slice(0, 10))}</td>
                  <td>
                    {u.id === me.id ? (
                      <span className="caption">حسابك (لا يمكن تغيير صلاحيتك بنفسك)</span>
                    ) : (
                      <select
                        className="input"
                        aria-label={`صلاحية ${u.email}`}
                        value={u.role}
                        disabled={busy === u.id}
                        onChange={(e) => void change(u, e.target.value as Role)}
                      >
                        {roleOrder.map((r) => (
                          <option key={r} value={r}>
                            {roleLabels[r]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="caption" style={{ padding: '12px 16px' }}>
        المشرفة: اطلاع على كل البيانات والتقارير والشواهد دون تعديل أو حذف. المستخدم المصرّح له: إضافة وتعديل وحذف. مديرة النظام: كل ذلك مع
        إدارة الصلاحيات.
      </div>
    </Section>
  )
}
