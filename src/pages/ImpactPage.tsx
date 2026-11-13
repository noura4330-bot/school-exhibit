// صفحة قياس الأثر: مؤشرات البرامج ثم المرفقات الداعمة. حُذفت مؤشرات الأثر العامة السابقة بطلب مديرة النظام (2026-11-13).
import { PageHeader } from '../components/ui'
import { ImpactFiles } from '../components/ImpactFiles'
import { ProgramMeasures } from '../components/ProgramMeasures'

export default function ImpactPage() {
  return (
    <>
      <PageHeader title="قياس الأثر" lead="مؤشرات قياس أثر كل برنامج من برامج الشواهد: المستهدف والنتيجة الفعلية ووصف مختصر للنتيجة." />
      <ProgramMeasures />
      <ImpactFiles />
    </>
  )
}
