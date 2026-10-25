import { useCallback, useEffect, useMemo, useState } from 'react'
import { cloudEnabled } from '../lib/cloud'
import { ArrowDownloadRegular, ArrowSyncRegular, DeleteRegular, OpenRegular } from '@fluentui/react-icons'
import { useStore } from '../data/store'
import type { AppData, Attachment, FileCategory } from '../data/types'
import { fileCategories, labelOf } from '../data/options'
import { evidenceCompleteness, refKindLabels, refTitle } from '../data/selectors'
import { Badge, EmptyState, Message, PageHeader, Progress, Section } from '../components/ui'
import { useFeedback } from '../components/feedback'
import { ClearFilters, DateRange, SearchBox, SelectFilter } from '../components/filters'
import { deleteFile, downloadStoredFile, listFilesMeta, listFileIds, openStoredFile, storageEstimate } from '../lib/fileStore'
import { href } from '../lib/router'
import { formatDate, formatSize, inRange, isValidUrl, matches } from '../lib/util'

interface Entry {
  key: string
  title: string
  owner: string
  route: string
  category: FileCategory
  date: string
  linked: string[]
  file?: Attachment
  url?: string
  completeness: number
}

function buildIndex(data: AppData): Entry[] {
  const out: Entry[] = []
  for (const e of data.evidence) {
    const linked = e.links.map((l) => `${refKindLabels[l.kind]}: ${refTitle(data, l) ?? 'عنصر محذوف'}`)
    const pct = evidenceCompleteness(e).pct
    const base = { owner: `شاهد: ${e.title}`, route: `evidence/${e.id}`, category: e.category, date: e.executedOn || e.createdAt.slice(0, 10), linked, completeness: pct }
    e.files.forEach((f) => out.push({ ...base, key: `ef-${f.id}`, title: f.name, file: f }))
    if (e.url) out.push({ ...base, key: `eu-${e.id}`, title: e.title, url: e.url })
    if (!e.files.length && !e.url) out.push({ ...base, key: `en-${e.id}`, title: e.title })
  }
  for (const d of data.govDocs) {
    const linked = data.policies.filter((p) => p.docRef?.docId === d.id).map((p) => `عنصر حوكمة: ${p.element}`)
    const base = {
      owner: `وثيقة حوكمة: ${d.title}`,
      route: 'governance',
      category: (d.stages.approve.status === 'done' ? 'approved_doc' : 'draft') as Entry['category'],
      date: d.updatedAt.slice(0, 10),
      linked,
      completeness: d.files.length || d.url ? 100 : 0,
    }
    d.files.forEach((f) => out.push({ ...base, key: `gf-${f.id}`, title: f.name, file: f }))
    ;(d.companionFiles ?? []).forEach((f) =>
      out.push({ ...base, owner: `مرافق لوثيقة: ${d.title}`, category: 'report', key: `gc-${f.id}`, title: f.name, file: f }),
    )
    if (d.url) out.push({ ...base, key: `gu-${d.id}`, title: d.title, url: d.url })
  }
  for (const p of data.policies) {
    if (!p.docUrl) continue
    // الرابط نفسه معروض مع الوثيقة المرجعية، فلا يتكرر
    if (data.govDocs.some((d) => d.id === p.docRef?.docId && d.url === p.docUrl)) continue
    const filled = [p.docName, p.summary, p.owner, p.createdOn, p.reviewedOn].filter((x) => x.trim()).length
    out.push({
      key: `p-${p.id}`,
      title: p.docName || p.element,
      owner: `حوكمة: ${p.element}`,
      route: 'governance',
      category: p.status === 'approved' || p.status === 'applied' ? 'approved_doc' : 'draft',
      date: p.reviewedOn || p.createdOn,
      linked: [`عنصر حوكمة: ${p.element}`],
      url: p.docUrl,
      completeness: Math.round((filled / 5) * 100),
    })
  }
  for (const w of data.workshops) {
    const groups: [Attachment[], string][] = [
      [w.presentation, 'ملف العرض'],
      [w.attendance, 'سجل الحضور'],
      [w.photos, 'صور التنفيذ'],
    ]
    for (const [list, label] of groups)
      list.forEach((f) =>
        out.push({
          key: `w-${f.id}`,
          title: f.name,
          owner: `ورشة: ${w.title} (${label})`,
          route: 'professional',
          category: 'execution',
          date: w.date,
          linked: [`ورشة: ${w.title}`],
          file: f,
          completeness: 100,
        }),
      )
  }
  for (const p of data.projects)
    p.photos.forEach((f) =>
      out.push({
        key: `pr-${f.id}`,
        title: f.name,
        owner: `مشروع: ${p.title}`,
        route: 'projects',
        category: 'execution',
        date: p.date,
        linked: [`مشروع طالبات: ${p.title}`],
        file: f,
        completeness: 100,
      }),
    )
  for (const c of data.correspondence)
    if (c.url)
      out.push({
        key: `c-${c.id}`,
        title: c.subject,
        owner: 'مراسلات البرنامج',
        route: 'readiness',
        category: 'execution',
        date: c.date,
        linked: ['مراسلات Microsoft Elevate'],
        url: c.url,
        completeness: 100,
      })
  return out
}

export default function FilesPage() {
  const { data } = useStore()
  const { toast, confirm } = useFeedback()
  const [stored, setStored] = useState<Set<string> | null>(null)
  const [orphans, setOrphans] = useState<{ id: string; name: string; size: number }[]>([])
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [linkState, setLinkState] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const index = useMemo(() => buildIndex(data), [data])

  const refresh = useCallback(async () => {
    try {
      const [ids, all, est] = await Promise.all([listFileIds(), listFilesMeta(), storageEstimate()])
      setStored(new Set(ids))
      const referenced = new Set(index.filter((e) => e.file).map((e) => e.file!.id))
      if (data.settings.logoFileId) referenced.add(data.settings.logoFileId)
      setOrphans(all.filter((f) => !referenced.has(f.id)).map((f) => ({ id: f.id, name: f.name, size: f.size })))
      setUsage(est)
    } catch {
      setStored(new Set())
      toast(cloudEnabled ? 'تعذر قراءة قائمة الملفات من قاعدة البيانات. تحققي من الاتصال.' : 'تعذر قراءة مخزن الملفات المحلي في هذا المتصفح.', 'error')
    }
  }, [index, data.settings.logoFileId, toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const status = (e: Entry): { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string; ok: boolean } => {
    if (e.file) {
      if (!stored) return { tone: 'neutral', label: 'جارٍ الفحص', ok: true }
      return stored.has(e.file.id) ? { tone: 'success', label: cloudEnabled ? 'ملف متاح' : 'ملف محلي متاح', ok: true } : { tone: 'danger', label: cloudEnabled ? 'ملف مفقود من القاعدة' : 'ملف مفقود من هذا الجهاز', ok: false }
    }
    if (e.url) return isValidUrl(e.url) ? { tone: 'neutral', label: 'رابط خارجي', ok: true } : { tone: 'danger', label: 'رابط غير صالح', ok: false }
    return { tone: 'warning', label: 'بلا ملف أو رابط', ok: false }
  }

  const items = index.filter((e) => {
    const st = status(e)
    return (
      matches(q, e.title, e.owner) &&
      (!cat || e.category === cat) &&
      inRange(e.date, from, to) &&
      (!linkState || (linkState === 'missing' ? !st.ok : st.ok))
    )
  })
  const missingCount = index.filter((e) => !status(e).ok).length

  const cleanOrphans = async () => {
    const ok = await confirm({
      title: 'حذف الملفات غير المرتبطة؟',
      body: `سيُحذف ${orphans.length} ملف محفوظ في المتصفح لا يرتبط بأي سجل. لا يمكن التراجع.`,
      confirmLabel: 'حذف الملفات',
      danger: true,
    })
    if (!ok) return
    await Promise.all(orphans.map((o) => deleteFile(o.id).catch(() => undefined)))
    toast('تم حذف الملفات غير المرتبطة.')
    void refresh()
  }

  return (
    <>
      <PageHeader
        title="إدارة الملفات"
        lead="فهرس لجميع الوثائق والشواهد المسجلة، مع حالة الروابط واكتمال البيانات."
        actions={
          <button className="btn" onClick={() => void refresh()}>
            <ArrowSyncRegular /> إعادة الفحص
          </button>
        }
      />
      <Message tone="info">
        {cloudEnabled
          ? 'الملفات محفوظة في قاعدة البيانات المركزية ومتاحة لكل زوار الموقع، و«مفقود» يعني أن السجل يشير إلى ملف غير موجود فيها. الروابط الخارجية يُفحص شكلها فقط.'
          : 'الملفات محفوظة في متصفح هذا الجهاز، و«مفقود» يعني أنها غير موجودة فيه (مثل فتح المعرض من جهاز آخر). الروابط الخارجية يُفحص شكلها فقط.'}
        {usage && usage.quota > 0 && <> المساحة المستخدمة: {formatSize(usage.usage)} من {formatSize(usage.quota)} متاحة للموقع.</>}
      </Message>

      <Section title="فهرس الملفات" sub={`${items.length} من ${index.length} · ${missingCount} مفقود أو ناقص`} flush>
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} label="البحث بالعنوان" placeholder="اسم الملف أو العنصر" />
          <SelectFilter label="التصنيف" value={cat} onChange={setCat} options={fileCategories} />
          <SelectFilter
            label="حالة الرابط"
            value={linkState}
            onChange={setLinkState}
            options={[
              { value: 'ok', label: 'متاح' },
              { value: 'missing', label: 'مفقود أو ناقص' },
            ]}
          />
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <ClearFilters
            active={Boolean(q || cat || linkState || from || to)}
            onClear={() => {
              setQ('')
              setCat('')
              setLinkState('')
              setFrom('')
              setTo('')
            }}
          />
        </div>
        {items.length === 0 ? (
          <EmptyState title={index.length ? 'لا توجد ملفات مطابقة' : 'لا توجد ملفات أو وثائق مسجلة بعد'}>
            {index.length ? null : 'تظهر هنا ملفات الشواهد والورش والمشروعات وروابط الوثائق بعد إضافتها.'}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">العنوان</th>
                  <th scope="col">التصنيف</th>
                  <th scope="col">التاريخ</th>
                  <th scope="col">العناصر المرتبطة</th>
                  <th scope="col">الحالة</th>
                  <th scope="col">اكتمال البيانات</th>
                  <th scope="col">
                    <span className="sr-only">إجراءات</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const st = status(e)
                  return (
                    <tr key={e.key}>
                      <td className="title-cell">
                        <bdi>{e.title}</bdi>
                        <div className="caption">
                          <a href={href(e.route.split('/')[0], e.route.split('/')[1])}>{e.owner}</a>
                          {e.file && ` · ${formatSize(e.file.size)}`}
                        </div>
                      </td>
                      <td>{labelOf(fileCategories, e.category)}</td>
                      <td className="nowrap">{formatDate(e.date)}</td>
                      <td className="caption">{e.linked.length ? e.linked.join('، ') : <span className="empty-value">غير مرتبط</span>}</td>
                      <td>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td style={{ minWidth: 80 }}>
                        <Progress pct={e.completeness} tone={e.completeness === 100 ? 'success' : 'warning'} />
                        <span className="caption">{e.completeness}%</span>
                      </td>
                      <td className="actions">
                        {e.file && stored?.has(e.file.id) && (
                          <>
                            <button className="btn subtle small icon" aria-label={`فتح ${e.title}`} onClick={() => void openStoredFile(e.file!.id)}>
                              <OpenRegular />
                            </button>
                            <button className="btn subtle small icon" aria-label={`تنزيل ${e.title}`} onClick={() => void downloadStoredFile(e.file!.id)}>
                              <ArrowDownloadRegular />
                            </button>
                          </>
                        )}
                        {e.url && isValidUrl(e.url) && (
                          <a className="btn subtle small icon" href={e.url} target="_blank" rel="noopener noreferrer" aria-label={`فتح رابط ${e.title}`}>
                            <OpenRegular />
                          </a>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {orphans.length > 0 && (
        <Section
          title="ملفات غير مرتبطة بأي سجل"
          sub="بقايا رفع لم يُحفظ أو سجلات حُذفت"
          actions={
            <button className="btn small danger edit-only" onClick={() => void cleanOrphans()}>
              <DeleteRegular /> حذفها
            </button>
          }
          flush
        >
          <ul className="list">
            {orphans.map((o) => (
              <li key={o.id}>
                <div className="item-main">
                  <bdi>{o.name}</bdi> <span className="caption">· {formatSize(o.size)}</span>
                </div>
                <button className="btn subtle small icon" aria-label={`تنزيل ${o.name}`} onClick={() => void downloadStoredFile(o.id)}>
                  <ArrowDownloadRegular />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}
