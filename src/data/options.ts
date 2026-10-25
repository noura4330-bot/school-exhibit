// القوائم والتسميات العربية للحالات والتصنيفات.
// tone يحدد لون الحالة وفق دلالات Fluent: success / warning / danger / brand / neutral

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

export interface Option<T extends string = string> {
  value: T
  label: string
  tone?: Tone
}

export const policyStatuses: Option[] = [
  { value: 'not_started', label: 'لم يبدأ', tone: 'neutral' },
  { value: 'drafting', label: 'قيد الإعداد (مسودة)', tone: 'warning' },
  { value: 'awaiting_review', label: 'بانتظار المراجعة', tone: 'brand' },
  { value: 'approved', label: 'معتمد', tone: 'success' },
  { value: 'applied', label: 'مطبق', tone: 'success' },
]

/** تصنيف التقييم الذاتي لعناصر الحوكمة */
export const governanceAssessments: Option[] = [
  { value: '', label: 'لم يُقيَّم', tone: 'neutral' },
  { value: 'evidenced', label: 'ممارسة قائمة بأدلة', tone: 'success' },
  { value: 'needs_development', label: 'تحتاج إلى تطوير', tone: 'warning' },
  { value: 'planned', label: 'مخطط لتنفيذها', tone: 'neutral' },
  { value: 'insufficient_info', label: 'لا يمكن تقييمها بعد', tone: 'danger' },
]

export const activityStatuses: Option[] = [
  { value: 'planned', label: 'مخطط', tone: 'neutral' },
  { value: 'implemented', label: 'منفذ', tone: 'success' },
  { value: 'cancelled', label: 'ملغى', tone: 'danger' },
]

export const initiativeStatuses: Option[] = [
  { value: 'not_started', label: 'لم يبدأ', tone: 'neutral' },
  { value: 'drafting', label: 'قيد الإعداد', tone: 'warning' },
  { value: 'in_progress', label: 'قيد التنفيذ', tone: 'brand' },
  { value: 'completed', label: 'مكتمل', tone: 'success' },
]

export const taskStatuses: Option[] = [
  { value: 'not_started', label: 'لم يبدأ', tone: 'neutral' },
  { value: 'drafting', label: 'قيد الإعداد', tone: 'warning' },
  { value: 'in_progress', label: 'قيد التنفيذ', tone: 'brand' },
  { value: 'done', label: 'مكتمل', tone: 'success' },
]

export const taskPriorities: Option[] = [
  { value: '', label: 'غير محددة' },
  { value: 'high', label: 'عالية', tone: 'danger' },
  { value: 'medium', label: 'متوسطة', tone: 'warning' },
  { value: 'low', label: 'عادية', tone: 'neutral' },
]

/** حالات المتطلبات في لوحة الجاهزية */
export const reqStatuses: Option[] = [
  { value: 'done', label: 'مكتمل', tone: 'success' },
  { value: 'in_progress', label: 'قيد التنفيذ', tone: 'brand' },
  { value: 'not_started', label: 'لم يبدأ', tone: 'neutral' },
  { value: 'review', label: 'يحتاج إلى مراجعة', tone: 'warning' },
]

export const evidenceTypes: Option[] = [
  { value: 'pdf', label: 'مستند PDF' },
  { value: 'presentation', label: 'عرض تقديمي' },
  { value: 'image', label: 'صورة' },
  { value: 'text', label: 'ملف نصي' },
  { value: 'spreadsheet', label: 'جدول بيانات' },
  { value: 'link', label: 'رابط إلكتروني' },
  { value: 'video', label: 'تسجيل أو مادة مرئية' },
]

export const reviewStatuses: Option[] = [
  { value: 'not_reviewed', label: 'لم تتم المراجعة', tone: 'neutral' },
  { value: 'pending', label: 'بانتظار المراجعة', tone: 'brand' },
  { value: 'reviewed', label: 'تمت المراجعة', tone: 'success' },
  { value: 'needs_completion', label: 'يحتاج إلى استكمال', tone: 'warning' },
]

export const sensitivityLevels: Option[] = [
  { value: 'public', label: 'عام (قابل للعرض)', tone: 'neutral' },
  { value: 'internal', label: 'داخلي (للمدرسة فقط)', tone: 'warning' },
  { value: 'sensitive', label: 'حساس (بيانات شخصية)', tone: 'danger' },
]

export const fileCategories: Option[] = [
  { value: 'draft', label: 'مسودة' },
  { value: 'approved_doc', label: 'وثيقة معتمدة' },
  { value: 'execution', label: 'شاهد تنفيذ' },
  { value: 'report', label: 'تقرير' },
]

export const yesNo: Option[] = [
  { value: '', label: 'لم يُحدد' },
  { value: 'yes', label: 'نعم' },
  { value: 'no', label: 'لا' },
]

/** مجالات عمل المعرض (للتصنيف الداخلي، وليست مجالات المقياس الرسمي) */
export const siteDomains: Option[] = [
  { value: 'initiative', label: 'خطة المبادرة' },
  { value: 'governance', label: 'السياسات والحوكمة' },
  { value: 'professional', label: 'التطوير المهني' },
  { value: 'teaching', label: 'التعليم والتعلم' },
  { value: 'projects', label: 'مشروعات الطالبات' },
  { value: 'impact', label: 'قياس الأثر' },
  { value: 'readiness', label: 'متطلبات Microsoft Elevate' },
]

export const indicatorStatuses: Option[] = [
  { value: 'not_reviewed', label: 'لم تتم المراجعة', tone: 'neutral' },
  { value: 'not_started', label: 'لم يبدأ', tone: 'neutral' },
  { value: 'in_progress', label: 'قيد التنفيذ', tone: 'brand' },
  { value: 'evidence_ready', label: 'الشاهد جاهز', tone: 'brand' },
  { value: 'awaiting_review', label: 'بانتظار المراجعة', tone: 'warning' },
  { value: 'internally_complete', label: 'مكتمل داخليًا', tone: 'success' },
  { value: 'needs_improvement', label: 'يحتاج إلى تحسين', tone: 'danger' },
]

export const practiceCategories: Option[] = [
  { value: 'applied', label: 'الدروس التطبيقية' },
  { value: 'ai', label: 'توظيف الذكاء الاصطناعي' },
  { value: 'stem', label: 'التصميم الهندسي STEM' },
  { value: 'pbl', label: 'التعلم القائم على حل المشكلات' },
  { value: 'collab', label: 'التعلم التعاوني' },
  { value: 'critical', label: 'التفكير الناقد' },
  { value: 'assessment', label: 'التقييم والتغذية الراجعة' },
  { value: 'mstools', label: 'توظيف أدوات Microsoft في التعليم' },
]

export const consentOptions: Option[] = [
  { value: 'unknown', label: 'لم يُتحقق بعد', tone: 'warning' },
  { value: 'none', label: 'لا توجد موافقات', tone: 'danger' },
  { value: 'partial', label: 'موافقات جزئية', tone: 'warning' },
  { value: 'full', label: 'موافقات مكتملة وموثقة', tone: 'success' },
]

export const pathfinderStatuses: Option[] = [
  { value: 'unknown', label: 'لم يُسجل بعد', tone: 'neutral' },
  { value: 'not_joined', label: 'لم تنضم المدرسة', tone: 'neutral' },
  { value: 'in_progress', label: 'التسجيل قيد التنفيذ', tone: 'brand' },
  { value: 'joined', label: 'منضمة (بحسب دليل مسجل)', tone: 'success' },
]

export const showcaseStatuses: Option[] = [
  { value: 'not_started', label: 'لم يبدأ إعداد الطلب', tone: 'neutral' },
  { value: 'preparing', label: 'الطلب قيد الإعداد', tone: 'brand' },
  { value: 'submitted', label: 'تم تقديم الطلب', tone: 'warning' },
  { value: 'decision_received', label: 'وصل رد رسمي (انظر حالة الاعتراف)', tone: 'neutral' },
]

export const correspondenceDirections: Option[] = [
  { value: 'outgoing', label: 'صادر' },
  { value: 'incoming', label: 'وارد' },
]

export const brandOptions: Option[] = [
  { value: 'navy', label: 'أزرق ملكي (هوية المعرض)' },
  { value: 'fluent', label: 'أزرار بالأزرق الداكن' },
  { value: 'deep', label: 'أزرار بالأزرق العميق' },
]

export const labelOf = (opts: Option[], value: string): string =>
  opts.find((o) => o.value === value)?.label ?? (value || '—')

export const toneOf = (opts: Option[], value: string): Tone =>
  opts.find((o) => o.value === value)?.tone ?? 'neutral'

export const govDocStatuses: Option[] = [
  { value: 'drafting', label: 'مسودة', tone: 'warning' },
  { value: 'under_review', label: 'قيد المراجعة', tone: 'brand' },
  { value: 'approved', label: 'معتمدة', tone: 'success' },
  { value: 'published', label: 'معتمدة ومنشورة', tone: 'success' },
  { value: 'superseded', label: 'مستبدلة بإصدار أحدث', tone: 'neutral' },
]

export const coverageLevels: Option[] = [
  { value: '', label: 'لم تُقيَّم التغطية', tone: 'neutral' },
  { value: 'full', label: 'مغطى بالكامل في النص', tone: 'success' },
  { value: 'partial', label: 'مغطى جزئيًا', tone: 'warning' },
  { value: 'none', label: 'غير مغطى', tone: 'danger' },
]

export const stageStatuses: Option[] = [
  { value: 'not_started', label: 'لم تبدأ', tone: 'neutral' },
  { value: 'in_progress', label: 'جارية', tone: 'brand' },
  { value: 'done', label: 'مكتملة', tone: 'success' },
]

/** مراحل الاعتماد والنشر والتطبيق بالترتيب. المراحل التي تتطلب دليلًا لا تكتمل دون شاهد مرتبط بالوثيقة */
export const approvalStages: { key: 'prepare' | 'review' | 'approve' | 'publish' | 'apply' | 'document'; label: string; needsEvidence: boolean }[] = [
  { key: 'prepare', label: 'إعداد السياسة', needsEvidence: false },
  { key: 'review', label: 'مراجعتها', needsEvidence: false },
  { key: 'approve', label: 'اعتمادها من صاحبة الصلاحية', needsEvidence: true },
  { key: 'publish', label: 'نشرها بالطريقة المعتمدة', needsEvidence: true },
  { key: 'apply', label: 'تطبيقها فعليًا', needsEvidence: true },
  { key: 'document', label: 'توثيق التطبيق', needsEvidence: true },
]
