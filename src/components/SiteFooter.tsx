// تذييل موحّد لكل الصفحات: العلامة، ثم روابط الصفحات المهمة، ثم وصف مختصر وإخلاء المسؤولية، ثم سطر الحقوق. كل العناصر في المنتصف.
import { useStore } from '../data/store'
import { href } from '../lib/router'

const links = [
  { route: 'initiative', label: 'ملف المبادرة' },
  { route: 'evidence', label: 'الشواهد والأدلة' },
  { route: 'reports', label: 'التقارير' },
  { route: 'settings', label: 'الخصوصية وحماية البيانات' },
]

export function SiteFooter() {
  const { data } = useStore()
  return (
    <footer className="site-footer no-print">
      <div className="site-footer-inner">
        <div className="site-footer-id">
          <p className="site-footer-name">التمكين المدرسي</p>
          <p className="site-footer-school">{data.settings.schoolName}</p>
        </div>
        <nav aria-label="روابط التذييل">
          <ul className="site-footer-links">
            {links.map((l) => (
              <li key={l.route}>
                <a href={href(l.route)}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="site-footer-about">
          نحو تعليم رقمي مسؤول، وممارسات تعليمية أكثر ابتكارًا. أداة داخلية للتوثيق، ولا تعني حصول المدرسة على اعتراف من Microsoft.
        </p>
        <p className="site-footer-copy">© 2026 جميع الحقوق محفوظة لنورة الزبيدي.</p>
      </div>
    </footer>
  )
}
