// ملف الشواهد: صورة كل شاهد ووصفه تحتها فقط (طلب مديرة النظام 2026-11-12)
import { PageHeader } from '../components/ui'
import { EvidenceGallery } from '../components/EvidenceGallery'
import { navigate } from '../lib/router'

export default function EvidencePage({ focusId }: { focusId: string }) {
  return (
    <>
      <PageHeader title="الشواهد والأدلة" lead="صور شواهد المبادرة، ووصف كل شاهد تحت صورته." />
      <EvidenceGallery focusId={focusId || undefined} onFocus={(id) => (id ? navigate('evidence', id) : navigate('evidence'))} />
    </>
  )
}
