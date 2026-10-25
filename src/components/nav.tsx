// عناصر التنقل الرئيسية ومجموعاتها، مشتركة بين القائمة وعناوين الصفحات.
import type { ReactNode } from 'react'
import {
  ClipboardTaskListRtlRegular,
  DataTrendingRegular,
  DocumentBulletListRegular,
  DocumentTextRegular,
  FolderOpenRegular,
  FolderRegular,
  HatGraduationRegular,
  HomeRegular,
  LightbulbRegular,
  PeopleTeamRegular,
  SettingsRegular,
  ShieldCheckmarkRegular,
} from '@fluentui/react-icons'
import type { RouteId } from '../lib/router'

export const navItems: { id: RouteId; label: string; icon: ReactNode; group: string }[] = [
  { id: 'home', label: 'الرئيسية', icon: <HomeRegular />, group: 'المبادرة' },
  { id: 'initiative', label: 'ملف المبادرة', icon: <DocumentTextRegular />, group: 'المبادرة' },
  { id: 'governance', label: 'السياسات والحوكمة', icon: <ShieldCheckmarkRegular />, group: 'المبادرة' },
  { id: 'professional', label: 'التطوير المهني', icon: <PeopleTeamRegular />, group: 'التنفيذ' },
  { id: 'teaching', label: 'التعليم والتعلم', icon: <HatGraduationRegular />, group: 'التنفيذ' },
  { id: 'projects', label: 'مشروعات الطالبات', icon: <LightbulbRegular />, group: 'التنفيذ' },
  { id: 'evidence', label: 'الشواهد والأدلة', icon: <FolderOpenRegular />, group: 'الشواهد والمتابعة' },
  { id: 'impact', label: 'قياس الأثر', icon: <DataTrendingRegular />, group: 'الشواهد والمتابعة' },
  { id: 'readiness', label: 'لوحة متابعة الجاهزية', icon: <ClipboardTaskListRtlRegular />, group: 'الشواهد والمتابعة' },
  { id: 'reports', label: 'التقارير', icon: <DocumentBulletListRegular />, group: 'الإدارة' },
  { id: 'files', label: 'إدارة الملفات', icon: <FolderRegular />, group: 'الإدارة' },
  { id: 'settings', label: 'الإعدادات', icon: <SettingsRegular />, group: 'الإدارة' },
]
