import { useState } from 'react'
import { ArrowDownloadRegular, PrintRegular } from '@fluentui/react-icons'
import { useStore } from '../data/store'
import { buildReport, reportTypes, type ReportType } from '../data/reports'
import { Message, PageHeader } from '../components/ui'
import { DateRange, SelectFilter } from '../components/filters'
import { useRoute, navigate } from '../lib/router'
import { downloadBlob, formatDate, isEmbedded, toCsv, todayIso } from '../lib/util'

function List({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? (
    <ul>
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  ) : (
    <p className="muted">{empty}</p>
  )
}

export default function ReportsPage() {
  const { data } = useStore()
  const { param } = useRoute()
  const type: ReportType = reportTypes.some((r) => r.value === param) ? (param as ReportType) : 'achievement'
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const r = buildReport(type, data, from, to)
  const s = data.settings
  const period = from || to ? `${from ? formatDate(from) : 'البداية'} — ${to ? formatDate(to) : 'اليوم'}` : 'كل الفترات المسجلة'

  const exportCsv = () => {
    const rows: string[][] = [
      ['التقرير', r.title],
      ['المدرسة', s.schoolName],
      ['الفترة', period],
      ['تاريخ الإعداد', formatDate(todayIso())],
      [],
    ]
    for (const t of r.tables) {
      rows.push([t.title], t.headers, ...t.rows, [])
    }
    void downloadBlob(toCsv([], rows), `report-${type}-${todayIso()}.csv`)
  }

  // نسخة HTML مستقلة من التقرير تُفتح في المتصفح وتُطبع أو تُحفظ PDF (الطباعة لا تعمل داخل الصفحة المنشورة)
  const exportHtml = () => {
    const el = document.querySelector('.report')
    if (!el) return
    const css = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((r) => r.cssText).join('\n')
        } catch {
          return ''
        }
      })
      .join('\n')
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${r.title}</title><style>${css}</style></head><body style="background:#fff"><main style="max-width:960px;margin:0 auto;padding:24px 16px">${el.outerHTML}</main></body></html>`
    void downloadBlob(new Blob([html], { type: 'text/html' }), `report-${type}-${todayIso()}.html`)
  }

  return (
    <>
      <PageHeader
        className="no-print"
        title="التقارير"
        lead="تقارير تُبنى من البيانات المسجلة فعلًا، قابلة للطباعة بتنسيق عربي وللتصدير."
        actions={
          <>
            <button className="btn" onClick={exportCsv}>
              <ArrowDownloadRegular /> تصدير CSV
            </button>
            <button className={`btn${isEmbedded ? ' primary' : ''}`} onClick={exportHtml}>
              <ArrowDownloadRegular /> تنزيل للطباعة (HTML)
            </button>
            {!isEmbedded && (
              <button className="btn primary" onClick={() => window.print()}>
                <PrintRegular /> طباعة أو حفظ PDF
              </button>
            )}
          </>
        }
      />
      <div className="surface no-print">
        <div className="toolbar" style={{ borderBottom: 0, borderRadius: 8 }}>
          <SelectFilter
            label="نوع التقرير"
            value={type}
            onChange={(v) => navigate('reports', v || 'achievement')}
            options={reportTypes}
            allLabel="— اختاري —"
          />
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        </div>
      </div>
      <div className="no-print">
        <Message tone="info">
          {isEmbedded
            ? 'الطباعة المباشرة غير متاحة في هذه النسخة المنشورة. نزّلي التقرير بصيغة HTML، ثم افتحيه في المتصفح واطبعيه أو احفظيه PDF.'
            : 'لحفظ التقرير بصيغة PDF اختاري «طباعة أو حفظ PDF» ثم «حفظ بتنسيق PDF» من نافذة الطباعة في المتصفح.'}{' '}
          ملف CSV يفتح في Excel بالعربية.
        </Message>
      </div>

      <article className="report" aria-labelledby="report-title">
        <header className="report-head">
          <div>
            <div className="caption">{s.schoolName} · {s.department} · {s.governorate}</div>
            <h1 id="report-title" style={{ fontSize: 'var(--t-title3)', lineHeight: 'var(--lh-title3)' }}>
              {r.title}
            </h1>
            <div className="muted">{s.exhibitName}</div>
          </div>
          <div className="caption" style={{ textAlign: 'end' }}>
            <div>الفترة الزمنية: {period}</div>
            <div>السنة الدراسية: {s.academicYear || 'لم تُحدد'}</div>
            <div>تاريخ إعداد التقرير: {formatDate(todayIso())}</div>
          </div>
        </header>

        <h2>الملخص التنفيذي</h2>
        <List items={r.summary} empty="لا توجد بيانات مسجلة." />

        <h2>البيانات الفعلية</h2>
        {r.tables.map((t) => (
          <div key={t.title} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 'var(--t-body)', margin: '8px 0' }}>{t.title}</h3>
            {t.rows.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      {t.headers.map((h) => (
                        <th key={h} scope="col">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((c, j) => (
                          <td key={j} className="pre-line">
                            {c}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">لم تُسجل بيانات بعد.</p>
            )}
          </div>
        ))}

        <h2>أبرز الإنجازات</h2>
        <List items={r.highlights} empty="لا توجد إنجازات موثقة في هذه الفترة." />

        <h2>النواقص</h2>
        <List items={r.gaps} empty="لم تُرصد نواقص في البيانات المسجلة." />

        <h2>الإجراءات المقترحة</h2>
        <List items={r.actions} empty="لا توجد إجراءات مفتوحة مسجلة." />

        <footer className="report-foot">
          {r.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
          <p>أُعد هذا التقرير آليًا من البيانات المسجلة في المعرض على هذا الجهاز بتاريخ {formatDate(todayIso())}. يُراجع قبل اعتماده.</p>
        </footer>
      </article>
    </>
  )
}
