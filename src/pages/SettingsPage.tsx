import { useEffect, useRef, useState } from 'react'
import { AddRegular, ArrowDownloadRegular, ArrowUploadRegular, DeleteRegular } from '@fluentui/react-icons'
import { makeBase, useStore } from '../data/store'
import type { AppData, OfficialLink, Settings } from '../data/types'
import { brandOptions } from '../data/options'
import { Message, PageHeader, Section } from '../components/ui'
import { Drawer, useFeedback } from '../components/feedback'
import { FormFields, validateFields, type Errors, type FieldDef } from '../components/form'
import { RecordCollection } from '../components/records'
import { DescList, ExtLink } from '../components/ui'
import {
  blobToDataUrl,
  dataUrlToBlob,
  deleteFile,
  listAllFiles,
  putRawFile,
  saveFile,
} from '../lib/fileStore'
import { downloadBlob, formatDate, todayIso } from '../lib/util'

/** بيانات المدرسة والمعرض ثابتة: تُعرض للقراءة فقط ولا تُعدّل من الموقع (طلب 2026-10-25) */
const fixedInfo: { key: keyof Settings; label: string }[] = [
  { key: 'schoolName', label: 'اسم المدرسة' },
  { key: 'exhibitName', label: 'اسم المعرض' },
  { key: 'department', label: 'الإدارة التعليمية' },
  { key: 'governorate', label: 'المحافظة' },
  { key: 'leadName', label: 'اسم مسؤولة المبادرة' },
]

const infoFields: FieldDef[] = [
  { key: 'academicYear', label: 'السنة الدراسية', type: 'text', placeholder: 'مثال: 1448هـ' },
  { key: 'brand', label: 'لون الأزرار الأساسية', type: 'select', options: brandOptions, required: true },
  { key: 'goals', label: 'الأهداف', type: 'textarea', rows: 4 },
]

const linkFields: FieldDef[] = [
  { key: 'title', label: 'اسم المرجع', type: 'text', required: true, full: true },
  { key: 'url', label: 'الرابط', type: 'url', required: true, full: true },
  { key: 'reviewedAt', label: 'تاريخ آخر مراجعة لمحتواه', type: 'date' },
  { key: 'note', label: 'ملاحظة', type: 'textarea', rows: 2 },
]

interface ExportFile {
  app: 'school-exhibit'
  exportedAt: string
  data: AppData
  files?: { id: string; name: string; type: string; size: number; addedAt: string; dataUrl: string }[]
}

export default function SettingsPage() {
  const { data, setSettings, replaceAll } = useStore()
  const { toast, confirm } = useFeedback()
  const [draft, setDraft] = useState<Settings>(data.settings)
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => setDraft(data.settings), [data.settings])

  // روابط المراجع تُدار كمجموعة داخل الإعدادات
  const linkCrud = useLinkCrud()

  const saveInfo = () => {
    const errs = validateFields(infoFields, draft as unknown as Record<string, unknown>)
    if (Object.keys(errs).length) {
      setErrors(errs)
      toast('تعذر الحفظ. راجعي الحقول المطلوبة.', 'error')
      return
    }
    setSettings({ academicYear: draft.academicYear, brand: draft.brand, goals: draft.goals })
    toast('تم حفظ الإعدادات.')
  }

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('اختاري ملف صورة للشعار.', 'error')
      return
    }
    try {
      const meta = await saveFile(file)
      if (data.settings.logoFileId) await deleteFile(data.settings.logoFileId).catch(() => undefined)
      setSettings({ logoFileId: meta.id })
      toast('تم حفظ شعار المدرسة.')
    } catch (e) {
      toast(`تعذر حفظ الشعار: ${(e as Error).message}`, 'error')
    } finally {
      if (logoRef.current) logoRef.current.value = ''
    }
  }

  const removeLogo = async () => {
    if (!data.settings.logoFileId) return
    await deleteFile(data.settings.logoFileId).catch(() => undefined)
    setSettings({ logoFileId: null })
    toast('أُزيل الشعار.')
  }

  const exportData = async (withFiles: boolean) => {
    setBusy(true)
    try {
      const payload: ExportFile = { app: 'school-exhibit', exportedAt: new Date().toISOString(), data }
      if (withFiles) {
        const files = await listAllFiles()
        payload.files = await Promise.all(
          files.map(async (f) => ({ id: f.id, name: f.name, type: f.type, size: f.size, addedAt: f.addedAt, dataUrl: await blobToDataUrl(f.blob) })),
        )
      }
      const done = await downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }), `exhibit-backup-${todayIso()}${withFiles ? '-with-files' : ''}.json`)
      if (done) toast('تم تنزيل النسخة الاحتياطية.')
    } catch (e) {
      toast(`تعذر التصدير: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<ExportFile>
      if (parsed.app !== 'school-exhibit' || !parsed.data) throw new Error('الملف ليس نسخة احتياطية من هذا المعرض.')
      const ok = await confirm({
        title: 'استيراد النسخة الاحتياطية؟',
        body: `ستُستبدل كل البيانات الحالية على هذا الجهاز ببيانات النسخة المصدّرة في ${formatDate(parsed.exportedAt?.slice(0, 10))}${parsed.files?.length ? ` مع ${parsed.files.length} ملف` : ''}. ننصح بتصدير نسخة من البيانات الحالية أولًا.`,
        confirmLabel: 'استيراد واستبدال',
        danger: true,
      })
      if (!ok) return
      setBusy(true)
      if (parsed.files?.length) {
        for (const f of parsed.files) {
          const blob = await dataUrlToBlob(f.dataUrl)
          await putRawFile({ id: f.id, name: f.name, type: f.type, size: f.size, addedAt: f.addedAt, blob })
        }
      }
      // بيانات المدرسة والمعرض الثابتة لا تتغير بالاستيراد
      const fixed = Object.fromEntries(fixedInfo.map((f) => [f.key, data.settings[f.key]]))
      replaceAll({ ...parsed.data, settings: { ...parsed.data.settings, ...fixed } })
      toast('تم استيراد البيانات.')
    } catch (e) {
      toast(`تعذر الاستيراد: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <>
      <PageHeader title="الإعدادات والأمان" lead="بيانات المدرسة والهوية، والمراجع الرسمية، والنسخ الاحتياطي، وإرشادات حماية البيانات." />

      <Section title="بيانات المدرسة والمعرض" sub="بيانات ثابتة للعرض فقط، ولا يمكن تعديلها من الموقع">
        <DescList items={fixedInfo.map((f) => ({ label: f.label, value: String(data.settings[f.key] ?? '') }))} />
      </Section>

      <Section
        title="السنة الدراسية والعرض"
        actions={
          <button className="btn primary" onClick={saveInfo}>
            حفظ
          </button>
        }
      >
        <FormFields
          fields={infoFields}
          value={draft as unknown as Record<string, unknown>}
          errors={errors}
          onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
        />
      </Section>

      <Section title="شعار المدرسة" sub="يُستخدم الشعار الرسمي الذي تقدمه المدرسة فقط">
        <div className="row">
          <input ref={logoRef} type="file" accept="image/*" className="sr-only" aria-label="ملف الشعار" onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])} />
          <button className="btn" onClick={() => logoRef.current?.click()}>
            <ArrowUploadRegular /> {data.settings.logoFileId ? 'استبدال الشعار' : 'رفع الشعار'}
          </button>
          {data.settings.logoFileId && (
            <button className="btn danger" onClick={() => void removeLogo()}>
              <DeleteRegular /> إزالة الشعار
            </button>
          )}
          <span className="caption">{data.settings.logoFileId ? 'الشعار ظاهر في الترويسة.' : 'لا يوجد شعار. لم يُنشأ شعار بديل.'}</span>
        </div>
      </Section>

      <Section
        title="روابط المراجع الرسمية"
        actions={
          <button className="btn small" onClick={() => linkCrud.openNew({ ...makeBase(), title: '', url: '', note: '', reviewedAt: '' })}>
            <AddRegular /> إضافة رابط
          </button>
        }
        flush
      >
        <RecordCollection
          view="table"
          items={data.settings.links.map((l) => ({ ...l, createdAt: '', updatedAt: '' }))}
          getTitle={(l) => l.title}
          onOpen={linkCrud.openEdit}
          onEdit={linkCrud.openEdit}
          onDelete={(l) => void linkCrud.askDelete(l)}
          columns={[
            { label: 'الرابط', render: (l) => <ExtLink url={l.url} /> },
            { label: 'آخر مراجعة', render: (l) => formatDate(l.reviewedAt), className: 'nowrap' },
          ]}
          empty={<p className="muted" style={{ padding: 16 }}>لا توجد روابط.</p>}
        />
      </Section>

      <Section title="النسخ الاحتياطي والاستيراد">
        <div className="stack">
          <p className="muted">
            البيانات محفوظة في هذا المتصفح فقط. حذف بيانات التصفح أو تغيير الجهاز يعني فقدانها ما لم توجد نسخة احتياطية. يمكن نقل النسخة
            إلى جهاز آخر واستيرادها هناك.
          </p>
          <div className="row">
            <button className="btn primary" disabled={busy} onClick={() => void exportData(false)}>
              <ArrowDownloadRegular /> تصدير البيانات (JSON)
            </button>
            <button className="btn" disabled={busy} onClick={() => void exportData(true)}>
              <ArrowDownloadRegular /> تصدير البيانات مع الملفات
            </button>
            <input ref={importRef} type="file" accept=".json,application/json" className="sr-only" aria-label="ملف النسخة الاحتياطية" onChange={(e) => e.target.files?.[0] && void importData(e.target.files[0])} />
            <button className="btn" disabled={busy} onClick={() => importRef.current?.click()}>
              <ArrowUploadRegular /> استيراد نسخة احتياطية
            </button>
          </div>
          <p className="caption">النسخة مع الملفات قد تحتوي بيانات شخصية (مثل سجلات الحضور)؛ احفظيها في مكان آمن ولا تشاركيها.</p>
        </div>
      </Section>

      <Section title="الأمان وحماية البيانات" sub="ما يفعله الموقع وما لا يفعله">
        <div className="stack">
          <Message tone="warning" title="الموقع ليس نظامًا آمنًا لتعدد المستخدمين">
            لا توجد مصادقة مستخدمين ولا صلاحيات ولا حماية خادمية. أي شخص يستخدم هذا المتصفح على هذا الجهاز يستطيع رؤية البيانات وتعديلها.
          </Message>
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            <li>لا يطلب الموقع كلمات مرور حسابات Microsoft ولا يحفظ أي بيانات دخول.</li>
            <li>لا يجمع بيانات شخصية عن الطالبات؛ نماذج المشروعات لا تتضمن حقول أسماء.</li>
            <li>لا يرفع أي بيانات أو ملفات إلى خادم أو سحابة؛ كل شيء محفوظ في هذا المتصفح.</li>
            <li>عند إضافة روابط OneDrive أو SharePoint، اجعلي صلاحيتها مقتصرة على المخولين وليست عامة افتراضيًا.</li>
            <li>الشواهد المصنفة «حساس» تظهر بتنبيه قبل أي نشر، ولا تُدرج روابطها في التقارير.</li>
          </ul>
        </div>
      </Section>

      {linkCrud.node}
    </>
  )
}

type LinkRecord = OfficialLink & { createdAt: string; updatedAt: string }

/** إدارة روابط المراجع (مخزنة داخل الإعدادات وليست مجموعة مستقلة) */
function useLinkCrud() {
  const { data, setSettings } = useStore()
  const { confirm, toast } = useFeedback()
  const [editing, setEditing] = useState<LinkRecord | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const close = () => {
    setEditing(null)
    setErrors({})
  }
  const save = () => {
    if (!editing) return
    const errs = validateFields(linkFields, editing as unknown as Record<string, unknown>)
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    const { createdAt: _c, updatedAt: _u, ...link } = editing
    void _c
    void _u
    const exists = data.settings.links.some((l) => l.id === link.id)
    setSettings({ links: exists ? data.settings.links.map((l) => (l.id === link.id ? link : l)) : [...data.settings.links, link] })
    toast('تم حفظ الرابط.')
    close()
  }
  const node = editing ? (
    <LinkDrawer value={editing} errors={errors} onChange={setEditing} onSave={save} onClose={close} />
  ) : null
  return {
    node,
    openNew: (l: LinkRecord) => setEditing(l),
    openEdit: (l: LinkRecord) => setEditing(l),
    askDelete: async (l: LinkRecord) => {
      const ok = await confirm({ title: 'حذف الرابط؟', body: `سيُحذف «${l.title}» من المراجع.`, confirmLabel: 'حذف', danger: true })
      if (!ok) return
      setSettings({ links: data.settings.links.filter((x) => x.id !== l.id) })
      toast('تم حذف الرابط.')
    },
  }
}


function LinkDrawer({
  value,
  errors,
  onChange,
  onSave,
  onClose,
}: {
  value: LinkRecord
  errors: Errors
  onChange: (v: LinkRecord) => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <Drawer
      title="رابط مرجع"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn primary" onClick={onSave}>
            حفظ
          </button>
        </>
      }
    >
      <FormFields fields={linkFields} value={value as unknown as Record<string, unknown>} errors={errors} onChange={(k, v) => onChange({ ...value, [k]: v })} />
    </Drawer>
  )
}
