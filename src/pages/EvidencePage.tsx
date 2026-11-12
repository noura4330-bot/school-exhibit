// ملف الشواهد: شواهد البرامج، ثم الشواهد السابقة غير المرتبطة ببرنامج إن وُجدت
import { useStore } from '../data/store'
import { PageHeader, Section } from '../components/ui'
import { EvidenceGallery } from '../components/EvidenceGallery'
import { ProgramsBoard } from '../components/ProgramEvidence'
import { navigate } from '../lib/router'

export default function EvidencePage({ focusId }: { focusId: string }) {
  const { data } = useStore()
  const legacy = (e: { programId?: string }) => !e.programId
  const legacyFocus = focusId && data.evidence.some((e) => e.id === focusId && legacy(e)) ? focusId : undefined
  return (
    <>
      <PageHeader title="الشواهد والأدلة" lead="شواهد برامج المبادرة مصنفة حسب البرنامج، مع وصف كل شاهد وصوره." />
      <ProgramsBoard focusId={legacyFocus ? undefined : focusId || undefined} onDone={() => focusId === 'new' && navigate('evidence')} />
      {data.evidence.some(legacy) && (
        <Section title="شواهد سابقة" sub="شواهد أُضيفت قبل نظام البرامج، ويمكن تعديلها أو حذفها.">
          <EvidenceGallery only={legacy} noAdd focusId={legacyFocus} onFocus={(id) => (id ? navigate('evidence', id) : navigate('evidence'))} />
        </Section>
      )}
    </>
  )
}
