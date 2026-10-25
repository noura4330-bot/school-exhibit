// أنواع البيانات الأساسية للمعرض. تُحفظ في قاعدة البيانات المركزية متى فُعّلت، وإلا محليًا في متصفح المستخدم.

export type ID = string

export interface BaseRecord {
  id: ID
  createdAt: string
  updatedAt: string
}

/** مرجع إلى سجل آخر يُستخدم لربط الشواهد بالعناصر والمؤشرات */
export type RefKind =
  | 'activity'
  | 'policy'
  | 'workshop'
  | 'practice'
  | 'project'
  | 'indicator'
  | 'impact'
  | 'task'
  | 'govdoc'

export interface Ref {
  kind: RefKind
  id: ID
}

/** ملف محفوظ في IndexedDB (البيانات الوصفية فقط، والمحتوى يُحفظ منفصلًا) */
export interface StoredFileMeta {
  id: ID
  name: string
  type: string
  size: number
  addedAt: string
}

export type Attachment = StoredFileMeta

export interface Settings {
  schoolName: string
  exhibitName: string
  department: string
  governorate: string
  leadName: string
  academicYear: string
  goals: string
  logoFileId: ID | null
  brand: 'navy' | 'fluent' | 'deep'
  links: OfficialLink[]
}

export interface OfficialLink {
  id: ID
  title: string
  url: string
  note: string
  reviewedAt: string
}

export interface InitiativeProfile {
  name: string
  domain: string
  vision: string
  rationale: string
  problem: string
  generalGoal: string
  executionGoals: string
  targetGroups: string
  lead: string
  duration: string
  supporters: string
  responsibilities: string
  resources: string
  timeline: string
  kpis: string
  measurementPlan: string
  baseline: string
  target: string
  actualResults: string
  challenges: string
  improvements: string
  achievementReport: string
  journey: string
  /* حقول ملف المبادرة الإضافية (اختيارية، تُترك فارغة حتى تُسجلها مسؤولة المبادرة) */
  mission?: string
  values?: string
  expectedResults?: string
  gap?: string
  scope?: string
  targetPractices?: string
  expectedOutputs?: string
  intendedImpact?: string
  status: 'not_started' | 'drafting' | 'in_progress' | 'completed'
  updatedAt: string
}

export interface Activity extends BaseRecord {
  title: string
  description: string
  date: string
  /** تاريخ نهاية النشاط المخطط (اختياري) */
  endDate?: string
  status: 'planned' | 'implemented' | 'cancelled'
  responsible: string
  domain: string
  notes: string
  /** المخرج المتوقع */
  output?: string
  /** رقم مرحلة الخطة (1–5)؛ إن غاب تُحدد المرحلة من المجال */
  stage?: number
}

export type PolicyStatus = 'not_started' | 'drafting' | 'awaiting_review' | 'approved' | 'applied'

export interface PolicyItem extends BaseRecord {
  element: string
  docName: string
  summary: string
  status: PolicyStatus
  createdOn: string
  reviewedOn: string
  owner: string
  docUrl: string
  reviewNotes: string
  nextAction: string
  /** التقييم الذاتي الأولي للعنصر: لا يكون «قائم بأدلة» دون شاهد مرتبط */
  assessment: GovernanceAssessment
  assessmentNote: string
  /** ربط العنصر بوثيقة الحوكمة الموحدة وأقسامها التي تغطيه */
  docRef?: PolicyDocRef
}

export type CoverageLevel = '' | 'full' | 'partial' | 'none'

export interface PolicyDocRef {
  docId: ID
  sectionIds: string[]
  /** مدى تغطية نص الأقسام للمتطلب. وصف للنص فقط، ولا يثبت الاعتماد أو التطبيق */
  coverage: CoverageLevel
  coverageNote: string
  /** يعرض مراحل الاعتماد والنشر والتطبيق للوثيقة داخل العنصر */
  tracksStages: boolean
}

export type GovDocStatus = 'drafting' | 'under_review' | 'approved' | 'published' | 'superseded'
export type ApprovalStage = 'prepare' | 'review' | 'approve' | 'publish' | 'apply' | 'document'
export type StageStatus = 'not_started' | 'in_progress' | 'done'

export interface GovDocSection {
  id: string
  title: string
  text: string
}

export interface GovDocVersion {
  version: string
  date: string
  note: string
  fileName: string
}

/** وثيقة حوكمة موحدة: تُرفع مرة واحدة وتُربط بأقسامها بأكثر من عنصر حوكمة */
export interface GovernanceDoc extends BaseRecord {
  title: string
  description: string
  version: string
  versionNote: string
  status: GovDocStatus
  url: string
  files: Attachment[]
  sections: GovDocSection[]
  history: GovDocVersion[]
  stages: Record<ApprovalStage, { status: StageStatus; date: string; note: string }>
  /** ملفات مرافقة للوثيقة لا تُعد جزءًا منها (مثل تقرير التحقق والمطابقة) */
  companionFiles?: Attachment[]
}

export type GovernanceAssessment = '' | 'evidenced' | 'needs_development' | 'planned' | 'insufficient_info'

export interface Workshop extends BaseRecord {
  title: string
  description: string
  objectives: string
  date: string
  presenter: string
  topic: string
  audience: string
  participants: string
  presentation: Attachment[]
  attendance: Attachment[]
  photos: Attachment[]
  skills: string
  application: string
  measureTool: string
  results: string
  finalReport: string
}

export interface Practice extends BaseRecord {
  title: string
  category: string
  subject: string
  stage: string
  objective: string
  need: string
  strategy: string
  tool: string
  implementation: string
  teacherRole: string
  studentRole: string
  outcome: string
  assessment: string
  results: string
  improvement: string
  isTemplate: boolean
}

export interface StudentProject extends BaseRecord {
  title: string
  field: string
  subject: string
  date: string
  problem: string
  idea: string
  solution: string
  tools: string
  aiRole: string
  steps: string
  testing: string
  finalProduct: string
  successCriteria: string
  futureSkills: string
  consent: 'unknown' | 'none' | 'partial' | 'full'
  photos: Attachment[]
  evaluation: string
  improvementNotes: string
}

export type EvidenceType = 'pdf' | 'presentation' | 'image' | 'text' | 'spreadsheet' | 'link' | 'video'
export type ReviewStatus = 'not_reviewed' | 'pending' | 'reviewed' | 'needs_completion'
export type Sensitivity = 'public' | 'internal' | 'sensitive'
export type FileCategory = 'draft' | 'approved_doc' | 'execution' | 'report'

export interface Evidence extends BaseRecord {
  title: string
  description: string
  type: EvidenceType
  executedOn: string
  source: string
  domain: string
  links: Ref[]
  reviewStatus: ReviewStatus
  owner: string
  notes: string
  url: string
  files: Attachment[]
  sensitivity: Sensitivity
  category: FileCategory
  proves: string
  howLinked: string
  visibleProof: string
  needsCompletion: 'yes' | 'no' | ''
  hasPersonalData: 'yes' | 'no' | ''
}

export type IndicatorStatus =
  | 'not_reviewed'
  | 'not_started'
  | 'in_progress'
  | 'evidence_ready'
  | 'awaiting_review'
  | 'internally_complete'
  | 'needs_improvement'

export interface RubricArea extends BaseRecord {
  name: string
  isPolicyGovernance: boolean
  targeted: boolean
  selfLevel: string
  levelReviewed: boolean
  source: string
  sourceReviewedAt: string
  notes: string
}

export interface Indicator extends BaseRecord {
  areaId: ID
  code: string
  text: string
  level: string
  status: IndicatorStatus
  source: string
  sourceReviewedAt: string
  gap: string
  notes: string
}

export interface Correspondence extends BaseRecord {
  date: string
  direction: 'incoming' | 'outgoing'
  party: string
  subject: string
  summary: string
  url: string
}

export interface ProgramStatus {
  pathfinderStatus: 'unknown' | 'not_joined' | 'in_progress' | 'joined'
  pathfinderEvidence: string
  showcaseStatus: 'not_started' | 'preparing' | 'submitted' | 'decision_received'
  submissionDate: string
  recognitionStatus: 'none' | 'recorded'
  recognitionDate: string
  recognitionEvidenceUrl: string
  recognitionNote: string
  /** مسودة إجابات أسئلة نموذج Showcase */
  questionsStatus?: 'not_started' | 'in_progress' | 'done'
  /** Showcase Evidence Template (الشريحة 3) مصدّرًا PDF */
  templateStatus?: 'not_started' | 'in_progress' | 'done'
}

export interface ImpactMeasure extends BaseRecord {
  title: string
  unit: string
  baseline: string
  target: string
  actual: string
  method: string
  measuredOn: string
  dataSource: string
  notes: string
  causalDesign: boolean
}

export type TaskStatus = 'not_started' | 'drafting' | 'in_progress' | 'done'

export interface Task extends BaseRecord {
  title: string
  area: string
  owner: string
  due: string
  status: TaskStatus
  notes: string
  /** الأولوية؛ إن غابت تُقترح من مجال المهمة */
  priority?: '' | 'high' | 'medium' | 'low'
}

export interface AppData {
  version: number
  lastUpdated: string
  settings: Settings
  initiative: InitiativeProfile
  activities: Activity[]
  policies: PolicyItem[]
  workshops: Workshop[]
  practices: Practice[]
  projects: StudentProject[]
  evidence: Evidence[]
  areas: RubricArea[]
  indicators: Indicator[]
  correspondence: Correspondence[]
  program: ProgramStatus
  impact: ImpactMeasure[]
  tasks: Task[]
  govDocs: GovernanceDoc[]
}

export type CollectionKey =
  | 'activities'
  | 'policies'
  | 'workshops'
  | 'practices'
  | 'projects'
  | 'evidence'
  | 'areas'
  | 'indicators'
  | 'correspondence'
  | 'impact'
  | 'tasks'
  | 'govDocs'
