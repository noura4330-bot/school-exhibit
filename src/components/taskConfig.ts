// نموذج المهمة المشترك بين ملف المبادرة ولوحة الجاهزية والرئيسية.
import type { Task } from '../data/types'
import { siteDomains, taskPriorities, taskStatuses } from '../data/options'
import type { FieldDef } from './form'
import type { EditorConfig } from './records'

export const taskFields: FieldDef[] = [
  { key: 'title', label: 'المهمة', type: 'text', required: true, full: true },
  { key: 'area', label: 'المجال', type: 'select', options: siteDomains },
  { key: 'status', label: 'الحالة', type: 'select', options: taskStatuses, required: true },
  { key: 'priority', label: 'الأولوية', type: 'select', options: taskPriorities },
  { key: 'owner', label: 'المسؤول', type: 'text' },
  { key: 'due', label: 'الموعد المستهدف', type: 'date' },
  { key: 'notes', label: 'ملاحظات', type: 'textarea', rows: 2 },
]

export const taskConfig: EditorConfig<Task> = { title: 'مهمة', fields: taskFields, linkKind: 'task', linkLabel: 'الشواهد' }
